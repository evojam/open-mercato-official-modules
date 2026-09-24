# Bookings — implementation deltas

Where the code departs from `.ai/specs/2026-08-10-bookings-module.md`, and why.

Kept out of the specification file on purpose: the specification is under review on its own
pull request and still moves. This file records what the implementation decided, so the two
never conflict in git. When a delta is accepted by the maintainers, it moves into the
specification's changelog and disappears from here.

## Data model

### D1 — Five tables became eight

*spec §7*

The specification names five tables: `bookings_bookings`, `bookings_participants`,
`bookings_subjects`, `bookings_targets`, `bookings_settings`. The schema adds three more,
each because a list of variable length was living inside a settings column:
`bookings_subject_categories`, `bookings_holidays`, `bookings_conflict_policy_exceptions`.
Details in D2–D4.

Database schema is an additive-only contract surface, so the three additions cost nothing
later; splitting a column into a table after the first release does not.

### D2 — Subject category is an entity, not a text column

*spec §7.3, §9*

The specification gives the subject a `category` column and the settings a list of categories
the conflict policy treats strictly. Both sides held free text, and nothing tied them
together: `doctor` on the subject and `Doctor` in the policy are two different values, so the
stricter policy silently stops applying. A save that should be refused goes through and no
one is told.

`bookings_subject_categories` holds the list once — name, icon, colour — and both sides point
at it with a foreign key. The unique index is on `lower(name)` among rows that are not
deleted, so one spelling wins. Icon and colour also give the timeline what it needs to group
and paint rows, which the specification asks for in §11 without saying where they live.

### D3 — Holidays are rows, not a list in the settings

*spec §7.5*

The specification holds holidays as a list inside the settings row. They are added and
removed one at a time, imported a year at a time, and each one has a name — so they are
rows. `bookings_holidays` carries a real `date` column, which the database validates, a
label, and a unique index per organization and date, so the same day cannot be entered twice.

The platform has no holiday table anywhere else; `staff` states outright that it holds no
calendar data. This module's working calendar is the first one on the platform.

### D4 — Conflict policy exceptions are rows, not a column

*spec §7.5, §9*

The specification carries the policy as two columns: the default mode and the categories that
get the other one. The exceptions are a list of variable length that points at another table,
which is a row shape. `bookings_conflict_policy_exceptions` holds one row per category, with
the mode, unique per organization and category. A missing row means the organization default.

The column shape also could not grow a third mode; the table can.

### D5 — Free weekdays are seven boolean columns

*spec §7.5*

The set is closed and never grows, so it stays in the settings row — but as seven named
columns rather than an array, so every day has a type and `psql` shows the calendar without
parsing. A rule like "every second Monday" is recurrence, not a free day, and is out of the
first version either way.

### D6 — A target may carry its own time zone

*spec §7.4, §8*

The specification resolves every day and every day boundary in the organization's zone, and the
target holds nothing but a name. That holds for a clinic, whose patients come to one building.
It breaks for the case the module is meant to serve: dispatching people and equipment to places
that are somewhere else.

A technician sent across the border is due at 13:00 local time at the place of work. The
dispatcher entering that sits in another zone, and the organization's zone is the dispatcher's,
not the destination's. Resolved in the organization's zone, the visit lands two hours off, on
the wrong side of a working day, and the coverage warning counts to the wrong date.

Two sides of a booking are expressed in two different zones, so both carry one:

| column | whose zone | what it decides |
|---|---|---|
| `bookings_settings.time_zone` | the organization | the default written into the two below, and everything with no target |
| `bookings_targets.time_zone` | where the work happens | the wall time and the day of a booking |
| `bookings_subjects.time_zone` | the subject's own calendar | the day of its leave and of its inspections |

A technician's leave belongs to the technician: entered by HR in their own calendar, it does not
move because a booking sends them abroad. The visit does.

**On the day scale the two are compared as days, not as instants.** A leave Monday in Lisbon and
a visit Tuesday in Warsaw share an hour of wall clock, and an instant comparison calls that a
conflict — the very case this delta exists for. The booking's days are resolved in the target's
zone, the window's days in the subject's, and the rule intersects the two sets of dates.
Instants only decide once bookings are placed by the minute (D9).

The engine itself still knows no zone, as spec §8 asks. The conversion sits at the edge, in
`lib/time/day-ranges.ts`: `bookingDays(window, target zone)` and
`unavailabilityDays(window, { subject, organization })` turn stored instants into a half-open
range of dates, and `detectConflicts` compares those ranges.

A whole-day unavailability window departs from §8. Planner stores it as two instants with no
zone, and each write path anchors "midnight" differently — HR at UTC midnight, planner's own
editors at the server's or the author's browser's. The middle-of-the-window rule of §8 reads
the right day only within eleven hours of UTC; in Auckland or Tonga a Monday leave from HR
lands on Tuesday. So the day is recognised from the anchor instead: a window whose both ends
are midnights of the subject's zone (what this module's own form writes), of UTC (what HR
writes) or of the organization's zone (a planner editor on a server in the company's zone)
covers exactly those dates, in any zone and across a clock change. Only a window anchored to a
midnight none of the three owns falls back to the middle rule, for any whole number of days.
This works around planner's storage, not a rule of ours: a zone on the stored window, or the
hourly scale, would make it unnecessary.

This module itself never reads the browser's zone. Every instant it writes — a booking's
window, or an unavailability window its form sends to planner's endpoint — is computed in the
zone of the one it belongs to, the target's or the subject's, before it leaves the server or
the form.

Candidate queries must widen their window. The engine compares dates in each owner's zone,
while `start_at` / `end_at` and `bookings_bookings_open_window_idx` hold instants: two visits
on 2 June, one on Kiritimati (UTC+14) and one in Honolulu (UTC−10), are the same date but
disjoint instants. A command or read that loads candidates by instants widens the range by
fourteen hours on each side and lets the engine decide.

"Today" for the coverage warning is the target's today, for the same reason: a deadline belongs
to the place of work. The scan still turns over once per organization's local day; inside it,
each booking is judged against `today` in its own target's zone.

A booking has exactly one target, so the rule stays unambiguous even when its participants come
from different places: the zone of the destination decides the booking, never the zone of the
people travelling.

All three are **required**, and the organization's has no database default: an installation that
has not chosen its zone must choose it before anything is booked, instead of freezing `UTC` into
every row it creates in the meantime. The settings row therefore appears on the first save of the
settings screen, not at tenant creation — reads answer from the built-in defaults until then,
which is what the specification describes anyway (§7.5).

The other two are written from the organization's zone when the row is created, rather than
nullable with a fallback. A read then never resolves anything — the row states its
answer — and a zone is a property of a place, so moving the head office does not move a site
abroad. The price is accepted and matches how the specification already treats the calendar:
changing the organization's zone leaves existing rows alone, and correcting one is an edit.

**What an installation sees before the zone is chosen.** Every path that would write a zone into
a row — creating a target, creating or syncing a subject, placing a booking — stops with
`409 settings_required`, and the screen sends the administrator to the settings first. Reads are
unaffected: empty lists need no zone. This is the second departure from §7.5, which has the
settings row seeded at tenant creation and an organization working from built-in defaults from
its first minute; with a required zone there is no sensible default to seed, so the module asks
once instead of guessing forever. The daily scan skips an organization with no settings row
rather than creating one (`architecture.md › The scan`).

The columns exist from the first migration; the resolution itself lands with the working
calendar, where the time vocabulary (a bare date, an instant, a wall time) and the daylight
saving rules are built.

## Conventions

### D7 — Entity classes are one per file, under the domain folder

*`AGENTS.md › Structure`*

`data/entities.ts` is a barrel over `data/entities/<domain>/<name>.entity.ts`. The generator
reads the barrel, so discovery is unchanged. Core keeps every entity of a module in one file;
this package follows its own structure rule instead, and the same domain split is used by
`commands/`, `services/` and `__tests__/`.

### D8 — Lists are native columns or tables, never `jsonb`

Core reaches for `jsonb` for small lists. Nothing in this module has a variable shape, so
`jsonb` would only cost the type and the constraints. Every list here is either a table
(D3, D4) or a set of typed columns (D5).

### D9 — Duration is a value plus a unit, and both units exist from day one

*spec §4, §7.1*

The specification stores a duration in working days, in steps of half a day, and defers
minute-level scheduling to a later phase. The column is `duration_value` with a
`duration_unit` of `working_days` or `minutes`; the first version writes only `working_days`,
and the half-day rule is part of the check only for that unit:

```sql
duration_value > 0 and (duration_unit <> 'working_days' or duration_value * 2 = floor(duration_value * 2))
```

A working day is a calendar unit, not a length of time — two working days across a weekend
span four calendar days — so minutes cannot be derived from it later. Adding a second column
then would leave the "exactly one of two columns" shape the review already made us remove from
the target. Carrying `minutes` in the check now means the later switch is a change in the
screen and the engine, with no migration. The window columns are already `timestamptz`, so a
booking of 13:30–14:00 needs nothing else from the schema.

This is the same principle the review applied to participants: the first version writes one
shape, but the model allows the second.

### D10 — The timeline is built on `vis-timeline` before the dependency is signed off

*spec §11, §16*

The specification proposes `vis-timeline` and leaves the decision to the maintainers; the
review of 4 September recommends accepting it. The timeline is built on that library now
rather than after the answer, because waiting buys nothing and the cost of being wrong is
known and small: the library is loaded lazily, every import of it lives in
`lib/timeline/vis-timeline.adapter.ts`, and a guard test fails both an import outside that
file and an adapter that holds no import at all. A refusal therefore means rewriting one
file, not the timeline.

### D11 — Dates go through `date-fns`, behind one adapter file

*spec §8, §16*

Zone conversions use `date-fns` 4 with `@date-fns/tz` — the zone package published by the
`date-fns` authors — both production dependencies of this package, `^4.4.0` and `^1.5.0`. Core
and ui pin `date-fns` exactly (4.3.0 in the release this package builds against, 4.4.0 on
`develop`), so until core moves to 4.4.0 a host holds two copies and a browser bundle that
loads the timeline can carry both. The cost is bounded: `date-fns` is split per function and the
adapter imports one. Core's own zone helper is the older third-party `date-fns-tz`, which this
package does not add. Arithmetic on bare dates needs no library and is done on UTC day
numbers inside the adapter — the daily scan runs it for every open booking.

Every import of either library lives in `lib/time/date-fns.adapter.ts`, which exposes the
module's own vocabulary (`IsoDate`, `WallTime`, `Weekday`, `DayRange` in `lib/time/types.ts`)
and never lets a `TZDate` out. The same guard test as for `vis-timeline` fails an import
anywhere else in `src`, and a second one fails any file outside `src/lib` that imports the
adapter itself: `src/modules` reaches dates only through `lib/time/day-ranges.ts`
(`todayIn`, `dayStartIn`, `bookingDays`, `unavailabilityDays`, `isValidTimeZone`). Swapping the
library means rewriting one file.

Clock changes are resolved by hand in the adapter, not by `TZDate`: its constructor
disambiguates a repeated or skipped wall time through the host's own zone, so the server and
the browser would store two different instants for the same entry — exactly what §8 forbids.

## Behaviour

### D12 — A start on a free day is allowed and flagged

*spec §2, §4*

The specification says the calendar blocks nothing and work on Saturday is allowed, but does
not say how a duration counts when the start itself is a free day. The start day always counts
as the booking's first working day — the dispatcher put it there on purpose — and the free days
after it are skipped: a three-day booking starting on Saturday covers Saturday, Monday and
Tuesday. The write goes through and the response flags the free start; the place and move
commands carry that flag, the engine rule does not.

Open, for the maintainers: a job that really covers a whole weekend cannot be expressed in
working days. The natural answer is a third duration unit, `calendar_days`, next to
`working_days` and `minutes` (D9) — a value in the unit check and a branch in the engine. Until
then such a job is two bookings.
