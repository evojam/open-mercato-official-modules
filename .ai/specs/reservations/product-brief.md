# Reservations module — product brief

- Date: 2026-09-09 · Mode: own idea, with the three existing-product sections added
  because the module lands in a running platform (What stays unchanged, Impact on existing
  data and users, Compatibility surfaces touched) · Owner: Jacek Zabilowicz (JacekZ96, Evojam)
- Coverage: 121 claims — 119 sourced (interview 0, data 0, document 55, product 61, benchmark 3), 0 synthetic, 2 assumed; 0 entries on the collection plan
- Definition of Ready signed by: team — Jacek Zabilowicz, 2026-09-09; riskiest assumption
  A03 accepted untested (D05); the ranking of the assumptions is the agent's (D07)
- Location: `.ai/specs/reservations/` — this repository hosts many independent modules, so
  the brief lives in the module's own folder rather than at `.ai/specs/product-brief.md`,
  where one brief per repository would collide with the next module's. The decision
  records from the session are kept in this file (last section) instead of separate files
  under `research/decisions/`, so the PR carries one document. The file name and structure
  follow the `om-discover` contract; the folder can move on the maintainers' request.
- Sources:
  - `.ai/specs/2026-08-10-reservations-module.md` — the spec, v3.1 of 2026-09-07
  - PR #33 reviews by Mat Gren (2026-08-26, 2026-09-04)
  - PR #33 author comments (2026-09-04, 2026-09-07 ×2)
  - PR #53 body and `SPEC-009-2026-08-21-appointment-layer.md` on its branch
  - PR #32 `2026-08-06-patient-cases-module.md` on its branch (the live-deployment evidence)
  - `open-mercato/open-mercato`: PR #4207 (v1 proposal, review 2026-07-26), issue #4316,
    issue #5862, `BACKWARD_COMPATIBILITY.md`, `.ai/specs/2026-06-11-crm-calendar.md`,
    `packages/core/src/modules/planner/di.ts`
  - decision records D01–D07, D15 and D18 from the discovery session of 2026-09-09, in the
    *Decision records* section at the end of this file (D08–D14, D16, D17 rest on the PR
    documents)
  - merged-PR history of `official-modules`; benchmark pages checked 2026-09-09

## Vision

Any product built on Open Mercato that must know whether a resource is busy takes that
from one module — reservations, conflicts, a timeline — instead of writing it from
scratch. `[PRODUCT]` spec §1, §3 — signed by the owner on 2026-09-09 (Q01)

The first product Evojam intends to build on it is a dispatch application; it does not
exist yet, and the intent is that real people use the module for their business needs.
`[DOCUMENT]` Decision records, D18

## Target group and stakeholders

- Customer (pays): nobody — the module is a free open-source contribution funded by
  Evojam's own time. `[DOCUMENT]` Decision records, D02
- User (uses): the dispatcher who places equipment and crews on sites and decides what to
  do about a clash — the user of the dispatch application Evojam intends to build (D18);
  no such user exists today. `[PRODUCT]` spec §1, §9 ("a person decides")
- User (uses): the reception desk that books visits and the practice owner who needs the
  no-show rate — the users of the consumer described in PR #53, if it builds on the
  module. `[DOCUMENT]` PR #53 SPEC-009, User Stories
- Not a user of this module: the person assigning people in the CRM calendar (core issue
  #4316) — nothing in phase 1 reaches that calendar (N01); the issue counts as demand for
  the idea under A04. `[DOCUMENT]` core issue #4316; the owner had no view on it
  (session 2026-09-09)
- Stakeholders (reviews): Mat Gren reviewed PR #33 twice and calls the dependency decision
  "a platform call rather than a review one"; the v1 proposal was reviewed in core by
  wojciechszyjka (read-only account) and triaged by Piotr Karwatka.
  `[DOCUMENT]` PR #33 review 2026-09-04; core PR #4207
- Stakeholders (decides — merge rights): every PR merged in `official-modules` so far
  (18 of 18) was merged by Dominik Palatyński; who accepts the core method is not named in
  any source. `[DOCUMENT]` merged-PR history of `official-modules`, checked 2026-09-09
- The owner does not know the Open Mercato people and does not need a name: "someone with
  the rights has to accept it; who, does not matter to me".
  `[DOCUMENT]` Decision records, D18 (session answers)
- Stakeholders (blocks or benefits): the author of PR #53, whose appointment module would
  consume the engine and who offered to close their proposal if #33 takes their six
  requirements. `[DOCUMENT]` PR #53 body, Q1
- Stakeholders (operates): the author of core issue #5862, who filed the planner timezone
  defect surfaced by the review of PR #33 and wrote that they would continue working on
  it. `[DOCUMENT]` core issue #5862 and its comment (2026-09-03)
- Stakeholders (originates): Paweł Dybcio filed the v1 proposal in core (PDF, 2026-07-16)
  and announced the rewrite that became PR #33. `[DOCUMENT]` core PR #4207 comment 2026-08-03
- Decider for scope decisions: Jacek Zabilowicz for the Evojam side; acceptance itself
  sits with the Open Mercato maintainers through the review of PR #33.
  `[DOCUMENT]` Decision records, D01
- Second signer on the Evojam side: the project manager, by role — no name given; the
  owner signs day to day, as the one currently developing the module. (Q09)

## Problems, with evidence

- Open Mercato has no place that answers "is this resource busy": the CRM calendar records
  meetings, knows nothing about unavailability and does not detect two meetings taking the
  same resource. `[PRODUCT]` spec §1
- The CRM calendar's conflict rule is "two non-cancelled items overlap and share an owner
  or a participant user" — resources and leave are outside it.
  `[PRODUCT]` core `.ai/specs/2026-06-11-crm-calendar.md` (Conflict definition)
- In a live deployment — a manufacturer of made-to-measure devices for patients, client
  anonymised, migrated to Open Mercato — the visit calendar had to be built from scratch,
  including all conflict and availability handling, because core has no appointment
  concept. `[DOCUMENT]` PR #32 SPEC-005 (`2026-08-06-patient-cases-module.md`),
  "Evidence from a live deployment", item 1; repeated in PR #53 SPEC-009, Problem Statement
- In the CRM calendar you can assign someone who is on approved leave and nothing warns
  you; staff availability rules and leave requests are ignored by the conflict engine.
  `[DOCUMENT]` core issue #4316 (2026-07-20)
- "Every vertical that schedules anything rebuilds the same thing" — the PR #53 author's
  argument for a shared engine, not a measured finding. `[DOCUMENT]` PR #53 SPEC-009, Overview
- Open Mercato's own calendar mockups carried a "Reservations NEW" entry in the sidebar;
  the calendar spec lists it as existing app shell, not part of that feature, and nothing
  says what the designer meant — a placeholder, not demand.
  `[PRODUCT]` core `.ai/specs/2026-06-11-crm-calendar.md`, mockup notes table
- How often these problems occur and what they cost has not been measured: no interview or
  usage data exists, and the owner chose to write this brief from documents alone.
  `[DOCUMENT]` Decision records, D03
- That the problem is frequent enough to justify a shared module rather than product-local
  code is a belief, not a measurement. `[ASSUMPTION]` tested by A04

## Product and how it stands out

- What it is: a module that stores who is busy, when, and for what; finds reservations
  that overlap and reservations that fall into unavailability; warns when a reservation
  without dates nears its expected start; shows everything on a timeline with one row per
  subject; stands on the existing registries (`resources`, `staff`) and availability
  schedules (`planner`), to which it adds one read method. `[PRODUCT]` spec TLDR
- What makes it different: the same mechanism for equipment, space and people; a day scale
  first; a person decides — conflicts warn by default and reject only where the
  organization says so; leave approved in HR becomes unavailability with no work on the
  module's side. `[PRODUCT]` spec §2, §3, §5, §9
- What makes it different: the conflict engine and the working-day arithmetic are pure
  functions that run on the server and in the browser, so a clash is visible while
  dragging a bar. `[PRODUCT]` spec §9, §11

Benchmark (each checked on 2026-09-09):

- **HL7 FHIR Appointment / Schedule / Slot** — https://hl7.org/fhir/appointment.html
  - Does well: multi-actor bookings (practitioner, device, location) with per-participant
    status; a rich status set including `noshow`; timezone carried on recurrence
    templates. `[BENCHMARK]`
  - Falls short for our users: appointment-centric at minute scale; availability through
    materialised Slots; no dispatch timeline; no stated conflict or rejection rule.
- **Odoo Planning** — https://www.odoo.com/app/planning
  - Does well: Gantt with one row per employee or resource, drag-and-drop shifts, a warning
    when shifts overlap for one employee, open (unassigned) shifts, time-off integration.
    `[BENCHMARK]`
  - Falls short for our users: a shift-planning application for people, not an engine other
    modules can build on; no notion of a reservation target.
- **Cal.com** — https://cal.com/
  - Does well: event types with a set duration (15m–1h), buffer before and after an event,
    per-user availability by weekday and hours, a displayed timezone, round-robin team
    scheduling, and cross-referencing of calendars to prevent double bookings. `[BENCHMARK]`
  - Falls short for our users: appointment booking for people at minute scale; not
    equipment, not day-scale dispatch; an application, not a module another module builds on.

## Goals and success criteria

- Business goal: visibility of Evojam in the Open Mercato community and advancing Open
  Mercato itself; no revenue is attached and no date was set.
  `[DOCUMENT]` Decision records, D02
- User outcome: a dispatcher sees a clash — two reservations on one subject, or a
  reservation on a leave or an inspection — in the response to the write or on the next
  timeline read, and sees which unplaced reservations are running out of time before it is
  too late. `[PRODUCT]` spec §2, §9
- Primary metric: consumers outside Evojam building on the module — baseline 0,
  threshold 1. `[DOCUMENT]` Decision records, D04
- Primary metric, date: six months after the module's first release — accepted by the
  owner at the confirmation on 2026-09-09 (Q02). `[DOCUMENT]` Decision records, D04
- What must not get worse: planner's behaviour and stored rules — the contribution adds
  one read method and changes no write path, no screen, no type list. `[PRODUCT]` spec §5
- What must not get worse: the `ui` calendar view and the CRM calendar stay as they are;
  the module replaces neither. `[PRODUCT]` spec §1, §11
- What must not get worse: enabling the module on a running installation only adds tables;
  disabling it leaves data in place and nothing outside depends on it. `[PRODUCT]` spec §14

## Scope

- **Now (phase 1):** reservations with status, duration and expected start; overlap and
  unavailability conflicts with a per-organization policy (advisory default, reject per
  category); coverage-gap warnings with a threshold; the organization's working calendar
  and time zone; permanent targets picked from a list; subjects from `resources` and
  `staff` through provider plugins; a day-scale timeline with one row per subject; exactly
  one participant written per reservation. `[PRODUCT]` spec §4, §6, §7.2, §9
  — confirmed as phase 1 by the owner. `[DOCUMENT]` Decision records, D06
- **Later (phase 2 and after):** a rules engine; qualification matching; requests and
  assignment from the target side; cascading moves; capacity (seats); an hourly axis;
  calendar exceptions per subject; minute-level scheduling, buffers, non-attendance as its
  own state, availability computed from rules; a second participant in the UI.
  `[PRODUCT]` spec §4, §7.2 — "not rejected forever, just not now"
- **Later:** extracting the shared overlap core out of the `customers` calendar into
  `shared`, as a separate core change with its own tests.
  `[DOCUMENT]` PR #33 comment 2026-09-04 (M7)
- **Later:** the module's final shape is expected to evolve in the open once it is public;
  rework after phase 1 is acceptable to the owner. `[DOCUMENT]` Decision records, D07
- **Not doing:** see Non-goals

## Domain glossary

Each term: meaning · owned by · visible to. Sources: spec §2, §6, §7, §9, §12. `[PRODUCT]`

- **Subject** — the thing that becomes busy: equipment, a room, a person; a row in the
  module's subject list pointing at a provider record · reservations · dispatcher, timeline
- **Target** — the reason for reserving: a site, a patient, a customer; permanent, picked
  from a list, extended by the product · reservations (name only) · dispatcher
- **Reservation** — "{subject} is busy from {from} to {to}, for {target}"; may exist
  without dates · reservations · dispatcher, other modules via the occupancy service
- **Participant** — one subject's part in a reservation, with a role; phase 1 writes one
  per reservation · reservations · engine, timeline
- **Unplaced** — a reservation with no dates yet; a normal state · reservations ·
  dispatcher ("unplaced" list)
- **Provider (plugin)** — the adapter between the module and one registry: create, name
  and card, unavailability windows, paged list · reservations (registry), `resources` and
  `staff` plugins shipped by the package · administrator
- **Unavailability window** — a flat interval when a subject cannot be used; expanded from
  planner rules or a leave · `planner` (rules), `staff` (leave) · engine, timeline background
- **Conflict** — two open reservations of one subject overlap, or a reservation falls into
  an unavailability window; half-open intervals, touching does not conflict ·
  reservations · dispatcher, alerts
- **Conflict policy** — `advisory` (warn, save) or `reject` (refuse), per organization
  with per-category exceptions · reservations settings · administrator
- **Coverage gap** — an unplaced open reservation with few working days left until its
  expected start · reservations · dispatcher, alerts
- **Working calendar** — free weekdays, holidays and the organization's time zone;
  arithmetic only, blocks nothing · reservations settings · administrator
- **Occupancy** — per subject, the busy intervals from open reservations; the only
  server-side entry for other modules · reservations · other modules
- **Scan** — the daily job that reports new conflicts with unavailability and coverage
  gaps, per organization, with a watermark · reservations worker · alerts

## Key flows

- Current state: a product on Open Mercato that needs occupancy writes it alone; the CRM
  calendar shows meetings and flags overlaps only when two items share an owner or
  participant user; approved leave lands as planner rules that no calendar reads.
  `[PRODUCT]` spec §1; `[DOCUMENT]` core issue #4316
- Future state, place a reservation: the dispatcher picks a start day → the server
  computes the end from the duration and the working calendar → under `reject` the command
  locks the subject, checks overlaps and writes in one transaction; under `advisory` it
  writes and computes after commit → conflicts come back in the response → an event goes
  out → alerts merge by subject. `[PRODUCT]` spec §7.1, §9, §12
- Future state, add a subject: choose person or non-person → the provider plugin writes
  the record in `staff` or `resources` through the command bus → the module writes its own
  row; on a failure after the first write the screen offers "attach existing" instead of
  repeating the write. `[PRODUCT]` spec §6
- Future state, enter unavailability: the module's own form posts straight to planner's
  existing rule endpoint under planner's permission → the browser then asks the module's
  conflict read for that subject → the timeline shows the effect. `[PRODUCT]` spec §10
- Future state, leave approved in HR: `staff` creates one-off planner rules → the module's
  read method expands them as stored (start plus duration) → the conflict engine sees the
  leave as an unavailability window. `[PRODUCT]` spec §5
  — mechanism verified by the reviewer. `[DOCUMENT]` PR #33 review 2026-09-04, "Claims that hold"
- Future state, the daily scan: one system-level scheduler entry → the worker walks
  organizations, each with a watermark of the last local date → reports only conflicts new
  since that date and coverage gaps whose day count changed. `[PRODUCT]` spec §9

## Business rules

Every rule: owner Jacek Zabilowicz · status active · required path to change: a
superseding row approved by the owner plus a spec changelog entry. Review by: after
phase 1 ships, unless the entry says otherwise.

- **R01** — A reservation occupies its participants; phase 1 writes exactly one
  participant, the table allows several.
  - Applies to: reservations, engine · Source: `[PRODUCT]` spec §7.2
- **R02** — Intervals are closed on the left, open on the right; touching intervals do not
  conflict.
  - Applies to: engine · Source: `[PRODUCT]` spec §7.1
- **R03** — Only open reservations (planned, active) occupy; status transitions follow the
  closed matrix in spec §7.1; a person changes status, never the clock.
  - Applies to: reservations · Source: `[PRODUCT]` spec §7.1
- **R04** — The organization's time zone decides which day it is — not the viewer's, not
  UTC; one zone per organization; only IANA names are accepted.
  - Applies to: all dates · Source: `[PRODUCT]` spec §8 · See D19
- **R05** — Conflict policy is data: `advisory` by default, `reject` per organization or
  per subject category; with several participants the stricter mode wins.
  - Applies to: writes · Source: `[PRODUCT]` spec §9
- **R06** — A conflict with an unavailability window always warns and never blocks, in
  both directions.
  - Applies to: writes, scan · Source: `[PRODUCT]` spec §9, §10
- **R07** — Under `reject`, the lock on the subjects (fixed order), the overlap check and
  the write are phases of the command's own transaction; the lock code asserts it runs
  inside one.
  - Applies to: place, move, resize, reopen, undo · Source: `[PRODUCT]` spec §9, §12
- **R08** — Duration is the input in working days in half-day steps; the end is computed
  from the working calendar and never given directly.
  - Applies to: reservations · Source: `[PRODUCT]` spec §7.1
- **R09** — A target is picked from a list; free text is not accepted.
  - Applies to: reservation form · Source: `[PRODUCT]` spec §7.4
- **R10** — Unavailability lives only in `planner`; the module keeps no table of its own
  and copies nothing from there.
  - Applies to: unavailability · Source: `[PRODUCT]` spec §10
- **R11** — The module never copies its truth into foreign tables; it reads foreign
  registries through the query engine and writes them through the command bus.
  - Applies to: providers · Source: `[PRODUCT]` spec §6, §15
- **R12** — Conflicts are computed on committed database state, never on the search index;
  the daily scan is the source of truth for conflicts with unavailability and reports only
  conflicts new since the organization's last scan date.
  - Applies to: engine, scan · Source: `[PRODUCT]` spec §9
- **R13** — An all-day planner window is placed on the date of its middle in the
  organization's zone; a window with real hours blocks every calendar day it touches.
  - Applies to: day-scale conflicts · Source: `[PRODUCT]` spec §8
  - Review by: when core issue #5862 is resolved · See Q05
- **R14** — Every row belongs to a tenant and an organization and every query filters by
  both; table names carry the module prefix and are plural.
  - Applies to: data model · Source: `[PRODUCT]` spec §7

## Non-goals

Every non-goal: owner Jacek Zabilowicz · status active · required path to change: a
superseding row approved by the owner plus a spec changelog entry. Review by: after
phase 1 ships, unless the entry says otherwise.

- **N01** — We are not building a replacement for the CRM calendar in `customers`.
  - Why: it is a record of meetings, not of occupancy; a product that wants a meeting on
    the timeline creates a reservation for it. `[PRODUCT]` spec §1
- **N02** — We are not building a suggestion engine or automatic assignment.
  - Why: the timeline shows free subjects of the same category; a person decides.
    `[PRODUCT]` spec §2, §4
- **N03** — We are not building the module's own unavailability table or a copy of planner
  rules.
  - Why: a leave entered in HR would be invisible; two copies drift. `[PRODUCT]` spec §5, §10
- **N04** — We are not building per-rule timezone conversion of planner windows.
  - Why: the platform stores the zone and reads it nowhere; converting on our side would
    show different days than every planner screen. `[PRODUCT]` spec §8
  - Review by: when core issue #5862 is resolved · See Q05
- **N05** — We are not making any change to `planner` beyond one additive read method — no
  enum widening, no write-path change, no migration of stored rules.
  - Why: a behaviour change in a working module with its own migration question; out of
    scope. `[PRODUCT]` spec §5, §8
  - Agreed by the reviewer. `[DOCUMENT]` PR #33 review 2026-09-04
  - Review by: after the core PR for the method merges
- **N06** — We are not building a core module.
  - Why: reservations are a layer above registries, HR and schedules, not a foundation they
    stand on. `[PRODUCT]` spec §14
  - Asked to decide by the reviewer. `[DOCUMENT]` PR #33 review 2026-08-26 (M8)
- **N07** — We are not building a fourth calendar surface in `ui` or a change to the shared
  schedule contract.
  - Why: the ready view lacks rows per subject, drag and resize, and counts days in the
    browser's zone; the module ships its own props-fed timeline and leaves `ui` alone.
    `[PRODUCT]` spec §11

## Decisions

Every decision: owner Jacek Zabilowicz · status active · required path to change: a
superseding row approved by the owner, unless the entry says otherwise.

- **D01** (2026-08-10) — Reservations are proposed as an Open Mercato module contributed by
  Evojam, not a feature inside the dispatch application.
  - Why: nothing in the mechanism depends on the industry; the product adds meaning, the
    module adds reservations, conflicts, timeline. `[PRODUCT]` spec §1
  - The idea was first filed in core as PR #4207 on 2026-07-16 by Paweł Dybcio and
    rewritten after its format review. `[DOCUMENT]` core PR #4207
  - Review by: after phase 1 ships
- **D02** (2026-09-09) — The contribution is free and open source; nobody pays; Evojam's
  goal is visibility in the Open Mercato community and advancing Open Mercato.
  - Why: stated by the owner in the discovery session. `[DOCUMENT]` Decision records, D02
  - Review by: 2027-03-09
- **D03** (2026-09-09) — This brief rests on documents, not interviews; no interview or
  data collection is planned for it.
  - Why: the owner did not want a "go ask someone" entry; the problem section says plainly
    what it rests on. `[DOCUMENT]` Decision records, D03
  - Review by: after phase 1 ships
- **D04** (2026-09-09) — Success means at least one consumer outside Evojam builds on the
  module.
  - Why: chosen over "spec merged" and "dispatch in production" as the only outcome that
    proves value for Open Mercato. `[DOCUMENT]` Decision records, D04
  - Tension with D06: the only known candidate (PR #53) needs minute-level scheduling,
    which is phase 2 (A01) — phase 1 as scoped wins this metric only if that author accepts
    the deferral (Q08) or another consumer appears.
  - Review by: at the date set in Q02
- **D05** (2026-09-09) — No kill criterion: the team adapts to the maintainers' review
  until the spec is accepted; if the core method is refused, another way is found.
  - Why: stated by the owner. `[DOCUMENT]` Decision records, D05
  - Review by: after the core PR for the method is decided
- **D06** (2026-09-09) — Spec §4 "first version" is phase 1; every deferred item is phase 2
  or later, not rejected.
  - Why: stated by the owner. `[DOCUMENT]` Decision records, D06
  - Matches the spec's own wording. `[PRODUCT]` spec §4
  - Review by: after phase 1 ships
- **D07** (2026-09-09) — The module's final shape will evolve in the open; rework after
  phase 1 is acceptable.
  - Why: stated by the owner. `[DOCUMENT]` Decision records, D07
  - Review by: after phase 1 ships
- **D08** (2026-09-04) — Planner gets one additive read method — unavailability windows for
  `{ subjectType, subjectId, ruleSetId? }` items in a range — on
  `plannerAvailabilityService`; the "untouched planner" claim is dropped; one-off rules
  are expanded on the new path as stored.
  - Why: the mechanism the earlier version relied on did not exist (B1); planner cannot
    resolve schedules itself because `resources` and `staff` depend on it.
    `[DOCUMENT]` PR #33 comment 2026-09-04
  - Shape accepted with two conditions by Mat Gren.
    `[DOCUMENT]` PR #33 review 2026-09-04, "Your two questions"
  - Owner: Jacek Zabilowicz; confirmed by Mat Gren (reviewer)
  - Review by: when the core PR for the method merges
  - Required path to change: superseding row approved by the owner and the planner maintainers
- **D09** (2026-09-04) — Conflict policy is data — `advisory` or `reject` — instead of
  advisory-only.
  - Why: a write path with no way to refuse was a blocker (B3).
    `[DOCUMENT]` PR #33 review 2026-08-26
  - Answered in the author's reply. `[DOCUMENT]` PR #33 comment 2026-09-04
  - Review by: after phase 1 ships
- **D10** (2026-09-04) — Participants live in their own table; phase 1 writes one.
  - Why: a reservation binding one subject cannot express a fitting that takes a doctor and
    a room (B2). `[DOCUMENT]` PR #33 review 2026-08-26; PR #53 requirement 3
  - Review by: after phase 1 ships
- **D11** (2026-09-04) — The module is an official module, not core; of the six core guard
  tests named in spec §14, five are brought into the package (three copies, two rewrites)
  and the core-only UI sweep is covered by the workspace sweep.
  - Why: the repo-wide guards stop at the core repository (M8).
    `[DOCUMENT]` PR #33 reviews 2026-08-26, 2026-09-04; `[PRODUCT]` spec §14
  - Review by: after phase 1 ships
- **D12** (2026-09-04) — `vis-timeline` is a new production dependency, lazy-loaded and
  isolated in one file, guarded by an import-boundary test.
  - Why: the ready `ui` view lacks rows per subject, drag and resize and zoom; a timeline
    engine from scratch is more code. `[PRODUCT]` spec §11
  - Recommended yes by the reviewer, subject to the maintainers' sign-off.
    `[DOCUMENT]` PR #33 review 2026-09-04
  - Fallback (owner, 2026-09-09): the case for the library is made in the spec; if the
    maintainers refuse, we negotiate — more reasons, or dropping the library entirely.
    Today it is the sensible choice. `[DOCUMENT]` Decision records, D12 addendum
  - Status: active on Evojam's side; maintainers' sign-off open (Q03)
  - Review by: when the maintainers decide
- **D13** (2026-09-07) — The built-in plugins read `resources` and `staff` through the
  query engine; the index delay is accepted for schedule assignments; writes go through
  the command bus.
  - Why: neither registry exposes a read service; a static import crosses the module
    boundary; HTTP is not a platform pattern.
    `[DOCUMENT]` PR #33 review 2026-09-04 (blocker) and comment 2026-09-07
  - Review by: after phase 1 ships
- **D14** (2026-09-07) — The day of an all-day planner window is the date of its middle in
  the organization's zone.
  - Why: planner's write paths anchor midnight to different zones (M1 of 2026-09-04); the
    middle is far from every boundary for zones within eleven hours of UTC.
    `[DOCUMENT]` PR #33 comment 2026-09-07; `[PRODUCT]` spec §8
  - Review by: when core issue #5862 is resolved
- **D15** (2026-09-09) — Keep rule R13 as it is and record in the spec that core is
  changing planner's timezone handling (issue #5862), so the rule is revisited when that
  lands.
  - Why: proposed by the agent, signed by the owner at the confirmation.
    `[DOCUMENT]` Decision records, D15
  - Review by: when core issue #5862 is resolved · See Q05
- **D16** (2026-09-04) — Reject mode uses a per-subject advisory lock inside the
  transaction, not a database exclusion constraint.
  - Why: an exclusion constraint needs `btree_gist`, and no module migration has created an
    extension; the reviewer accepted either.
    `[DOCUMENT]` PR #33 review 2026-08-26 (B3), comment 2026-09-04
  - Review by: after phase 1 ships
- **D17** (2026-09-04) — People are full subjects through `staff`, and `staff` is a hard
  dependency of the module.
  - Why: without `staff`'s access service planner refuses every unavailability write, even
    for equipment. `[DOCUMENT]` PR #33 review 2026-08-26 (B1 qualification), comment 2026-09-04
  - Stated in the spec. `[PRODUCT]` spec §5, §14
  - Review by: after phase 1 ships
- **D18** (2026-09-09) — The dispatch application does not exist yet; Evojam intends to
  build it on the module in time, so that real people use the module for their business
  needs. The owner needs no name for who accepts the contribution on the Open Mercato side.
  - Why: stated by the owner in answer to the skeptic's questions.
    `[DOCUMENT]` Decision records, D18
  - Review by: when the dispatch application has a dated plan
- **D19** (2026-09-09) — One organization = one time zone, for now. A company that needs
  sites in several time zones creates several organizations; no per-site zone in phase 1.
  - Why: stated by the owner; matches the platform's tenant → organizations model and
    spec §8 (R04). `[DOCUMENT]` Decision records, D19
  - Review by: the first user who needs several zones inside one organization

## Riskiest assumptions

Every assumption: owner Jacek Zabilowicz · result untested, unless the entry says
otherwise. The ranking is the agent's (D07).

- **A01** — A day scale is enough for the first users (equipment dispatch).
  - Importance: high
  - Evidence today: none for dispatchers — the dispatch application does not exist yet
    (D18); against: the one known consumer outside Evojam needs minutes.
    `[DOCUMENT]` PR #53 requirement 1
  - If false: the timeline and the "whole days conflict" rule are reworked; an hourly axis
    needs no data change. `[PRODUCT]` spec §4
  - Smallest test: the first production month of whichever consumer runs first — dispatch
    once built, or the PR #53 module: count reservations that needed an hour
  - By when: first consumer in production
- **A02** — Dispatchers prefer a warning to a refused save.
  - Importance: medium
  - Evidence today: weak: the spec's own reasoning; no dispatcher exists to ask (D18).
    `[PRODUCT]` spec §9
  - If false: the default flips to `reject` — a setting, no code
  - Smallest test: in the first consumer's first production month, count conflicts saved
    then moved by hand
  - By when: first consumer in production
- **A03** — The planner read method lands in core in the shape of spec §5.
  - Importance: high
  - Evidence today: some: the reviewer accepted the shape with two conditions; no core PR
    exists yet. `[DOCUMENT]` PR #33 review 2026-09-04
  - If false: the module copies rule expansion or waits; D05 says the team adapts
  - Smallest test: open the core spec and PR; the maintainers' first review is the test
  - By when: when PR #33 is accepted
  - Result: accepted untested (D05, confirmed by the owner 2026-09-09)
- **A04** — Someone outside Evojam builds on the module.
  - Importance: high
  - Evidence today: some: the PR #53 author would consume it if it takes their
    requirements. `[DOCUMENT]` PR #53 Q1
  - A core issue asks for leave-aware conflicts in the CRM calendar — demand for the idea,
    not a user of this module. `[DOCUMENT]` core issue #4316
  - The "Reservations NEW" mockup entry is a placeholder and counts for nothing.
  - If false: the metric in D04 fails; Evojam has an open-source module nobody else uses
  - Smallest test: ask the PR #53 author whether phase 1 plus the deferred list works as
    their acceptance criteria
  - By when: before phase 1 ships
- **A05** — The team can carry two repositories at once — the core PR for the method and
  the module.
  - Importance: medium
  - Evidence today: none
  - If false: phase 1 is delayed by the core release cycle; peer dependency and startup
    check already cover the ordering. `[PRODUCT]` spec §14
  - Smallest test: the core spec and PR are opened within a month of PR #33's acceptance
  - By when: one month after acceptance
- **A06** — Core's fix for planner timezones (#5862) does not change how stored all-day
  windows are anchored before phase 1 ships.
  - Importance: medium
  - Evidence today: weak: the issue names a "resolution fork" still to be decided.
    `[DOCUMENT]` core issue #5862
  - If false: R13 and D14 become redundant or wrong; the read method's one-off expansion
    may need to follow the new anchoring
  - Smallest test: follow #5862; re-read spec §5 and §8 when it resolves
  - By when: when #5862 resolves
- **A07** — One time zone per organization is enough.
  - Importance: low
  - Evidence today: none; the owner raised the point in the session ("one company can
    operate in more than one zone") without deciding anything — no record, so `[ASSUMPTION]`
  - If false: a company with sites in several zones either maps them onto several
    organizations or needs a per-site zone
  - Smallest test: ask the first multi-site user; see D19
  - By when: first multi-site deployment
  - Result: accepted untested (D19, 2026-09-09) — several sites in several zones means
    several organizations
- **A08** — Evojam builds the dispatch application on the module, so the module gets its
  first real users.
  - Importance: medium
  - Evidence today: none beyond the owner's stated intent. `[DOCUMENT]` Decision records, D18
  - If false: the module has no consumer of Evojam's own; A01 and A02 can only be tested on
    someone else's product
  - Smallest test: a dated plan for the dispatch application
  - By when: not set

## Kill criteria

None set. The owner decided (D05) that the team adapts to the maintainers' review until
the spec is accepted, and looks for another way if the core method is refused. The brief
records this as a conscious absence, not an oversight.

## Hypotheses to test

None: no persona walkthrough or simulated interview was run, so nothing carries the
`[SYNTHETIC]` tag.

## Open questions

- **Q01** — Does the owner sign the vision sentence as written, or reword it?
  - Blocking: no · Who can answer: Jacek Zabilowicz
  - Status: closed 2026-09-09 — signed as written
- **Q02** — By what date should the first consumer outside Evojam exist (D04)? Proposal:
  six months after the first release.
  - Blocking: no · Who can answer: Jacek Zabilowicz
  - Status: closed 2026-09-09 — six months after the first release
- **Q03** — Do the Open Mercato maintainers (the people with merge rights, not the
  library's authors) accept `vis-timeline` as a new production dependency of the module?
  - Blocking: yes, for implementation of the timeline
  - Who can answer: whoever holds merge rights in `official-modules` (merge history:
    Dominik Palatyński); the owner needs no name (D18)
  - Status: open — recommended yes by the reviewer; our stance and fallback are recorded
    in D12 (2026-09-09): argue it, negotiate, or drop the library if refused
- **Q04** — Does the planner read method get accepted in core in the §5 shape, on its own
  spec and PR?
  - Blocking: yes, for the conflict engine to see unavailability
  - Who can answer: the core maintainer who reviews the method's own PR — not named in any
    source
  - Status: open — shape accepted in review, PR not yet opened
- **Q05** — Does the resolution of core issue #5862 change the anchoring of stored all-day
  windows, and with it R13 and D14?
  - Blocking: no
  - Who can answer: the author of #5862, who took it on by comment; a planner owner's
    decision on the issue's "resolution fork"
  - Status: open — assessed 2026-09-09 against the issue's two forks: (a) planner windows
    stay UTC instants and only the write path is made deterministic; (b) floating local
    time plus an IANA zone, expanded in the zone. R13 survives both — the middle of a
    24-hour window lands on the right day whichever midnight the writer used. Under (b)
    only the expansion path in spec §5 changes: reuse planner's zone-aware expander
    instead of "start plus duration" as stored. Closes when #5862 is decided.
- **Q06** — Does any deployment sit more than eleven hours from UTC, where R13's
  middle-of-window rule can miss by a day?
  - Blocking: no · Who can answer: Open Mercato maintainers
  - Status: open — no such deployment is known. Core issue #5862 itself uses
    `Pacific/Auckland` (+12/+13) as its example, so the maintainers have that zone in
    mind; there a leave stored at UTC midnight has its middle at local midnight and R13
    lands it a day late. Mitigation is #5862's deterministic write (its "layer 1"), not a
    change on our side.
- **Q07** — A company operating in several time zones: several organizations each with its
  own zone, or a per-site zone the spec does not have?
  - Blocking: no · Who can answer: Jacek Zabilowicz, with the first multi-site user
  - Status: closed 2026-09-09 — D19: one organization = one time zone for now; a company
    with sites in several zones creates several organizations
- **Q08** — Does the author of PR #53 accept phase 1 plus the deferred list as their
  acceptance criteria (their Q1)?
  - Blocking: no for this module; yes for theirs · Who can answer: the PR #53 author
  - Where their six requirements stand: participants (3) and server-side rejection (4) are
    in phase 1; availability from planner rules (6) is how the module reads unavailability;
    minute-level scheduling (1), per-type duration and buffers (2) and no-show as its own
    state (5) are phase 2 (spec §4).
  - Owner's stance (2026-09-09): minute scale will come, probably in phase 2 — the data is
    already timestamps, it is a matter of polishing; a no-show state makes sense and may
    be added, the topic can return; per-type buffers only make sense once the scale is
    minutes, so they go with (1).
  - Status: open — the author has not been asked yet
- **Q09** — Who beyond the owner co-signs scope on the Evojam side — the originator of v1,
  a project manager, nobody?
  - Blocking: no · Who can answer: Jacek Zabilowicz
  - Status: closed 2026-09-09 — the project manager, by role, no name given; not the
    originator of v1; the owner signs day to day
- **Q10** — Does the owner sign D15 (keep R13 and note core issue #5862 in the spec), or
  replace it?
  - Blocking: no · Who can answer: Jacek Zabilowicz
  - Status: closed 2026-09-09 — signed
- **Q11** — Who decides acceptance by name — merging PR #33 in `official-modules` (merge
  history points at Dominik Palatyński) and accepting the planner method in core (no name
  in any source)?
  - Blocking: no — the owner does not need a name; acceptance is by whoever holds the
    rights (D18)
  - Who can answer: the Open Mercato maintainers themselves
  - Status: closed 2026-09-09 — not needed; the owner does not need a name (D18)

## What stays unchanged

- `planner`'s write paths, screens, stored rules and the public availability function; the
  contribution adds one read method to the availability service planner registers in the
  container. `[PRODUCT]` spec §5; `[PRODUCT]` core `packages/core/src/modules/planner/di.ts`
- That service has "zero production callers today, only tests", so the addition changes
  nothing that runs. `[DOCUMENT]` PR #33 review 2026-09-04, "Your two questions"
- The `ui` schedule view and its `ScheduleItem` contract; the CRM calendar in `customers`.
  `[PRODUCT]` spec §11, N01, N07
- `resources` and `staff`: no schema, route or service change; the module reads them
  through the query engine and writes through their existing commands. `[PRODUCT]` spec §6

## Impact on existing data and users

- No existing table changes; the module adds its own five tables and migrations touch
  nothing already in the database. `[PRODUCT]` spec §14
- Existing planner rules are read as they are stored; nothing is migrated or normalised.
  `[PRODUCT]` spec §8
- Existing users see nothing new until the module is enabled; after enabling, the
  administrator gets three permissions and a regular employee gets view, after a one-time
  role-permission sync on existing installations. `[PRODUCT]` spec §12, §14
- Migration and rollback path: enable = additive migrations plus setup; disable =
  deactivation with data left in place; the module fails registration with a clear message
  on a core version without the read method. `[PRODUCT]` spec §14
- A forced dependency: an application that enables reservations must enable `staff`,
  `resources`, `planner` and `scheduler` too — an installation that reserves only equipment
  must switch on HR, because without it planner refuses every unavailability write.
  `[PRODUCT]` spec §5, §14

## Compatibility surfaces touched

Read against core's `BACKWARD_COMPATIBILITY.md` (checked 2026-09-09 on the local
`develop` checkout):

- §9 DI service names and §2 type definitions: `plannerAvailabilityService` gains one
  method; the existing method and its signature stay — additive.
  `[PRODUCT]` spec §5; core `BACKWARD_COMPATIBILITY.md` §2, §9
- §8 Database schema (additive-only): five new module-prefixed tables, no change to
  existing ones. `[PRODUCT]` spec §7, §14
- §5 Event IDs (frozen once released): nine new `reservations.*` events, named in spec
  §12; none existing is touched. `[PRODUCT]` spec §12
- §10 ACL feature IDs: three new `reservations.*` features. `[PRODUCT]` spec §12
- §11 Notification type IDs: two new types, `reservations.conflict` and
  `reservations.coverage_gap`. `[PRODUCT]` spec §12
- Not touched: the `ScheduleItem.subjectType` union in `ui` — the earlier plan to widen it
  was dropped. `[DOCUMENT]` core PR #4207 review 2026-07-26 (Backward compatibility); `[PRODUCT]` spec §11

## Definition of Ready addendum (own idea, in a running platform)

- Riskiest assumption: A03 (the core method lands). Test result: none yet. Recorded
  decision to build without it: D05, confirmed by the owner on 2026-09-09.
- Existing-product items: migration and rollback path — see *Impact on existing data and
  users*; affected screens and user groups — only new screens (timeline, subjects, targets,
  settings, the unavailability form posting to planner); no existing screen changes.
  `[PRODUCT]` spec §11, §12, §14
- Ticket-level tier of the Definition of Ready: the problem and who has it rest on the spec
  and on tracker documents (tiers 3–4), not on interviews; the expected outcome and its
  check are spec §2 and the test table in spec §13; out of scope is spec §4 and the
  Non-goals; blocking questions Q03 and Q04 sit with the maintainers and are answered by
  the review, not by this brief.

## Collection plan

No entries. The owner decided (D03) to write from documents; how often the problem occurs
and what it costs stays unmeasured, and the brief says so where it matters (Problems, A01,
A04).

## Decision records (discovery session, 2026-09-09)

The protocol behind the session decisions cited above as `Decision records, Dnn`. Each
record: date and owner, the context and options weighed, the decision in the owner's own
words, the consequences and what would make us revisit it. D08–D14, D16 and D17 rest on
the PR documents and have no record here.

### D01 — Reservations as an Open Mercato module contributed by Evojam, not a dispatch feature

- Date, owner: 2026-08-10 (spec filed as PR #33); confirmed in the discovery session of
  2026-09-09 by Jacek Zabilowicz, who makes the scope decisions on the Evojam side.
  Acceptance itself rests with the Open Mercato maintainers through the review of PR #33.
- Context and the options weighed: the idea was first filed in core as
  `open-mercato/open-mercato` PR #4207 on 2026-07-16 by Paweł Dybcio (a Polish PDF); the
  core review of 2026-07-26 asked for Markdown in English, and the author announced a
  rewrite in a separate PR on 2026-08-03. That rewrite is PR #33 in `official-modules`.
  The alternative — keep occupancy as product code inside the dispatch application — was
  rejected in the spec's §1.
- Decision and why: nothing in the mechanism (reservation, conflict, timeline) depends on
  the industry; only what a subject and a target are changes. A module lets the next
  reservation product on Open Mercato pay for the product, not the platform.
- Consequences, and what would make us revisit it: the contribution follows the
  maintainers' review and the repository's conventions; the module depends on a core
  release carrying the planner read method (spec §5, §14). Revisit if the maintainers
  decline the module as a whole.
- Status: active

### D02 — Free open-source contribution; nobody pays; goal: Evojam's visibility and advancing OM

- Date, owner: 2026-09-09, Jacek Zabilowicz
- Context and the options weighed: the discovery session asked whether a paying client
  stands behind the dispatch product and what Evojam gains from giving the module away.
  Options named: less own code to maintain in dispatch, influence on the direction of
  core, visibility of Evojam in the community.
- Decision and why: the owner's words — "to jest chyba własny pomysł, my chcemy ten moduł
  zrobić za darmo dla Open Mercato w formie naszej kontrybucji open source"; "nikt nie
  płaci"; the goal is "widoczność Evojam w społeczności OM i ogólna chęć rozwijania OM".
- Consequences, and what would make us revisit it: the business goal in the brief carries
  no revenue, no measure and no date; the brief says so. Revisit if a client or a
  commercial arrangement appears behind the dispatch product.
- Status: active

### D03 — This brief rests on documents, not interviews; no collection is planned for it

- Date, owner: 2026-09-09, Jacek Zabilowicz
- Context and the options weighed: no interview notes, usage data or support extracts exist
  in the repository. The session offered to put "two interviews with a dispatcher, via the
  project manager" on a collection plan. The owner had not done such research himself and
  did not want the brief to carry an entry that says "go ask someone".
- Decision and why: the owner's words — "nie chcę zapisywać 'by kogoś pytać' raczej". The
  problem section is written from the spec (PR #33), the consumer proposals (PR #32,
  PR #53), and core issue #4316, and states plainly that frequency and cost are not
  measured.
- Consequences, and what would make us revisit it: the "who has the problem" claims rest on
  tiers 3–4 (document, product), which the Definition of Ready accepts; A01 and A04 stay
  untested until a consumer runs. Revisit if the project manager's notes from real
  dispatchers or reception desks land in the repository.
- Status: active

### D04 — Success means at least one consumer outside Evojam builds on the module

- Date, owner: 2026-09-09, Jacek Zabilowicz
- Context and the options weighed: (a) the spec is merged by the maintainers; (b) the
  dispatch application runs the module in production as its only source of occupancy;
  (c) a consumer outside Evojam builds on the module.
- Decision and why: the owner chose (c) — "ja tu bym dał C raczej". It is the one outcome
  that proves value for Open Mercato rather than for Evojam alone.
- Consequences, and what would make us revisit it: baseline 0, threshold 1; date: six
  months after the module's first release — proposed by the agent, accepted by the owner
  at the confirmation on 2026-09-09 (Q02 closed). Revisit if no consumer appears by that
  date.
- Status: active

### D05 — No kill criterion: the team adapts to the maintainers' review until the spec is accepted

- Date, owner: 2026-09-09, Jacek Zabilowicz
- Context and the options weighed: two open questions in the spec could stop the work — the
  maintainers refusing the planner read method, or refusing `vis-timeline`. The session
  asked which result means "stop or plan B" and who calls it.
- Decision and why: the owner's words — "tu się raczej dostosujemy, ale raczej liczymy na
  akceptację specki albo nie, jeśli będzie 'nie' to poszukamy sposobu by było ok". No stop
  condition; the riskiest assumption A03 (the method lands in core) is accepted untested.
- Consequences, and what would make us revisit it: the brief records the absence as
  conscious. Revisit when the core PR for the method is decided.
- Status: active

### D06 — Spec §4 "first version" is phase 1; every deferred item is phase 2 or later, not rejected

- Date, owner: 2026-09-09, Jacek Zabilowicz
- Context and the options weighed: spec §4 lists what is in the first version and what is
  not ("not rejected forever — just not now"). PR #53 asks for five of the deferred items
  (minute-level scheduling, buffers, non-attendance state, availability from rules, plus
  the two already taken: participants and rejection).
- Decision and why: the owner's words — "ten zakres który teraz daliśmy jest na fazę 1,
  a reszta będzie w fazie 2 lub później".
- Consequences, and what would make us revisit it: Scope "Now" and "Later" in the brief
  follow §4; the non-goals are the spec's permanent stances, not the deferred list.
  Revisit after phase 1 ships, or if PR #53's author needs a deferred item to adopt the
  module (Q08).
- Status: active

### D07 — The module's final shape will evolve in the open; rework after phase 1 is acceptable

- Date, owner: 2026-09-09, Jacek Zabilowicz
- Context and the options weighed: the session asked which assumptions, if false, would
  force a rework. The owner's stance is that the current design is a set of project
  assumptions with no guarantee they hold as the module grows in open source.
- Decision and why: the owner's words — "nie ma gwarancji, że z czasem i rozwojem apki nie
  wyjdzie, że trzeba zrobić pewne zmiany by był moduł po prostu lepszy, w przeróbkach nie
  ma niczego złego, nie od razu Rzym zbudowano".
- Consequences, and what would make us revisit it: the riskiest assumptions A01–A08 are
  ranked by the agent (A03, A01, A04 on top) and marked as the agent's choice; the owner
  accepts rework as a normal outcome. Revisit when the first external consumer's
  requirements are known.
- Status: active

### D12 addendum — Fallback if the maintainers refuse `vis-timeline`

- Date, owner: 2026-09-09, Jacek Zabilowicz
- Context: D12 (2026-09-04) chose `vis-timeline`; the reviewer recommended yes but left
  the call to the maintainers (Q03). The session asked what we do if they refuse.
- Decision and why: the owner's words — "my wyraziliśmy swoją opinię i swoje powody
  dlaczego tego używać, a jeśli oni się nie zgodzą to spróbujemy się dogadać w inny
  sposób, być może odstąpimy od tej biblioteki całkowicie a być może spróbujemy podać
  kolejne powody dlaczego ona ma sens, dla nas ona teraz jest bardzo sensownym wyborem".
- Consequences: Q03 stays open until the maintainers decide; no work on the timeline
  starts before that. Revisit on their answer.
- Status: active

### D15 — Keep the middle-of-window rule (R13, spec §8); note core issue #5862 in the spec

- Date, owner: 2026-09-09, Jacek Zabilowicz
- Context and the options weighed: spec §8 reads the day of an all-day planner window from
  its middle in the organization's zone, because planner's write paths anchor midnight to
  different zones. On 2026-09-03 core issue #5862 was filed for exactly that defect, and
  its author wrote they would continue working on it. Options: (a) keep R13 and note the
  dependency; (b) hold §5 and §8 until #5862 is decided.
- Decision and why: (a). Proposed by the agent during the session; the owner did not want
  to reopen the timezone design ("u nas strefy czasowe mają sensowne uzasadnienie") and
  signed the proposal at the confirmation. One sentence in the spec, no risk: if core
  normalises stored windows, R13 becomes redundant and is removed then.
- Consequences, and what would make us revisit it: assumption A06 and open question Q05
  track #5862; the spec gets a note pointing at the issue. Revisit when #5862 is resolved.
- Status: active

### D18 — The dispatch application does not exist yet; Evojam intends to build it on the module

- Date, owner: 2026-09-09, Jacek Zabilowicz
- Context and the options weighed: the skeptic's cold read found that the vision named
  "Evojam's dispatch application" as the first product and that two assumption tests
  (A01, A02) relied on its first production month, while no source showed the application
  had users or a date. Three answers were given in the same session:
  1. On who accepts the contribution on the Open Mercato side — "no ja nie znam ludzi
     z OM, więc ktoś tam musi od nich to zaakceptować, ktoś z uprawnieniami a kto to nie
     ma dla mnie znaczenia".
  2. On the dispatch application — "teraz jeszcze nie istnieje ale chcemy by istniało
     z czasem, żeby prawdziwi ludzie mogli używać tego modułu i spełniać swoje biznesowe
     potrzeby".
  3. On whether the CRM-calendar requester (core issue #4316) is a user of this module —
     "nie wiem w sumie".
- Decision and why: the vision keeps dispatch as the intended first consumer, stated as
  intent, not as an existing product; A01 and A02 are tested on whichever consumer reaches
  production first; the acceptance question Q11 is left open and not pursued; the #4316
  requester is recorded as demand evidence (A04), not as a user.
- Consequences, and what would make us revisit it: assumption A08 (Evojam builds dispatch
  on the module) enters the assumption map with no date. Revisit when the dispatch
  application has a dated plan, or when another consumer reaches production first.
- Status: active

### D19 — One organization = one time zone, for now

- Date, owner: 2026-09-09, Jacek Zabilowicz
- Context and the options weighed: spec §8 keeps one time zone per organization (R04). The
  owner had remarked earlier that one company can operate in more than one zone (A07,
  Q07). Options: (a) one zone per organization, several sites in several zones = several
  organizations; (b) a per-site zone on the target or the subject, with day arithmetic per
  site — not in phase 1.
- Decision and why: (a). The owner's words — "jedna firma = 1 timezone na razie, takie
  jest założenie, jak firma będzie miała potrzebę posiadania kilku siedzib w różnych
  timezone to założy sobie kilka kont organizacji po prostu". It matches the platform's
  tenant → organizations model, so phase 1 adds nothing.
- Consequences, and what would make us revisit it: Q07 closed; A07 accepted untested.
  Revisit when a user needs several zones inside one organization.
- Status: active
