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

## Conventions

### D6 — Entity classes are one per file, under the domain folder

*`AGENTS.md › Structure`*

`data/entities.ts` is a barrel over `data/entities/<domain>/<name>.entity.ts`. The generator
reads the barrel, so discovery is unchanged. Core keeps every entity of a module in one file;
this package follows its own structure rule instead, and the same domain split is used by
`commands/`, `services/` and `__tests__/`.

### D7 — Lists are native columns or tables, never `jsonb`

Core reaches for `jsonb` for small lists. Nothing in this module has a variable shape, so
`jsonb` would only cost the type and the constraints. Every list here is either a table
(D3, D4) or a set of typed columns (D5).
