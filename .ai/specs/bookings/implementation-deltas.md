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

Not solved yet: the engine shipped with the conflict rule compares instants, so this case is
still reported wrongly. Nothing calls it, and the fix belongs with the working calendar, where
the bare-date type and the zone conversions are built. Stated here rather than left to be
discovered.

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
