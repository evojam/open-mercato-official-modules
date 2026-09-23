# Bookings Package — Agent Guidelines

`@open-mercato/bookings` adds bookings to Open Mercato: who is busy, when, and for what. It
finds overlaps and clashes with unavailability, warns before a coverage gap, and shows
everything on a timeline with one row per subject. It stands on `resources`, `staff`,
`planner` and `scheduler`.

Design authority: `.ai/specs/2026-08-10-bookings-module.md` (v3.2). When this file and the
spec disagree, the spec wins and this file gets fixed. Where the code departs from the spec
on purpose: `.ai/specs/bookings/implementation-deltas.md`. Product context:
`.ai/specs/bookings/product-brief.md`. How the module is built and why:
`.ai/specs/bookings/architecture.md`.

Prose says "reservation" for the thing being booked; every identifier says `bookings`.

## Always

1. Keep `src/lib/**` (`pure-engine`, `timeline`) free of `@open-mercato/*` runtime, MikroORM
   and Node-only imports (`node:*`, `fs`, `path`). These blocks run on the server and in the
   browser from the same source. `src/modules/**` imports from them, never the other way.
2. Compute conflicts from committed state (`em` / SQL), never from the query index. The index
   catches up later through the queue, so a check right after a write would miss that write.
3. Under `reject`, run the overlap check inside the command's transaction:
   `withAtomicFlush(em, phases, { transaction: true })` — the default is no transaction. Take
   an advisory lock on the subject first; with several participants, lock them in a fixed
   order (by subject id). Before locking, assert `em.isInTransaction()`. Reason: command
   handlers open no transaction on their own, and two parallel writes that both check "free?"
   before either commits would both pass.
4. Read unavailability windows only through `plannerAvailabilityService.getUnavailabilityWindows`
   (the method we add to planner in core). Do not copy planner's private rule code into this
   package, and do not use `getMergedAvailabilityWindows` for unavailability. Reason: a copy
   would drift from planner with no shared tests, and the public function never turns one-off
   rules (leave) into windows.
5. Under `advisory`, a write that creates a conflict succeeds and returns the conflicts in the
   response. Under `reject`, the write fails with an error that names the subject and the
   slot. Every conflict the module returns carries its kind (`overlap` / `unavailability`) and
   the other side. Undo is a write like any other and goes through the same check.
6. Read a foreign record — a subject's name, card or schedule in `resources` or `staff` —
   through the query engine over that module's entities. Write to those registries through
   the command bus, by command name. Never import their entity classes. Reason: neither
   module exposes a read service, an entity import is a compile-time dependency across a
   module boundary, and the index delay is fine here because a schedule assignment is
   configuration, not a booking.
7. Use `enforceCommandOptimisticLockWithGuards`, never the older `enforceCommandOptimisticLock`.
   Reason: core's coverage test fails any new direct call of the older helper, and this
   package runs a copy of that test.
8. Conflict policy is data, never a constant in code: `bookings_settings.conflict_policy` is
   `advisory` (default — the write goes through, the conflict is reported) or `reject` (a
   write that creates an overlap fails), with exceptions per subject category in
   `bookings_conflict_policy_exceptions`; with several participants from different categories
   the stricter mode applies. Reason: dispatching equipment leaves the decision to a person,
   booking visits must refuse the second person for the same slot — one module serves both.
9. Business errors extend `CrudHttpError` from `@open-mercato/shared/lib/crud/errors`, with
   a body `{ error, code, details }`. Reason: the platform's undo route passes only
   `CrudHttpError` through; any other error becomes a plain 400 "Undo failed" and loses the
   status and the reason.
10. Entity classes go one per file in `data/entities/<domain>/<name>.entity.ts`, re-exported
    from the `data/entities.ts` barrel. Property order is `id` → scope (`organizationId`,
    `tenantId`) → relations → own columns → timestamps, because property order is column
    order in the generated migration.

## Ask First

- Adding a production dependency. `vis-timeline` is proposed in spec §11 — loaded lazily,
  isolated in one file, guarded by an import-boundary test — recommended by the reviewer,
  still waiting for the maintainers' sign-off (spec §16).
- Anything that needs code in `planner`, `staff` or `resources`. That is a separate spec and
  PR in `open-mercato/open-mercato`, merged and published before this package can depend on
  it — `getUnavailabilityWindows` is the first such case.
- Any table beyond the eight below, and any change to one of them once a migration has
  shipped. Database schema is an additive-only contract surface.

## Never

- Never write to planner from this module's server, and never mirror bookings there —
  occupancy and conflicts stay in this module's tables. The one write toward planner, an
  unavailability window from our form, goes from the browser straight to planner's own rule
  endpoint under planner's permission; our server does not see it and learns about it from
  the scan or from the browser's follow-up conflict read. Reason: a mirror is a dual write
  with no shared transaction, and a server-side write would mean copying planner's
  permission check.
- Never let a conflict with an unavailability window block a save — in both policies, in
  both directions (a booking written into a window, a window written over a booking). It is
  reported in the response and in the scan. Reason: a breakdown or an urgent inspection does
  not ask the schedule first; only two bookings of one subject overlapping can be refused.
- Never declare a cross-module join once for all with `defineLink` — the platform does not
  use it outside its own test. A join across a module boundary is written in the query that
  needs it (`QueryOptions.joins`).
- Never import `vis-timeline` (or `vis-data`) anywhere except
  `src/lib/timeline/vis-timeline.adapter.ts`, and load it lazily there. Swapping the library
  must mean replacing one file. The guard test fails on an import outside the adapter and on
  an adapter that has no import at all.
- Never store a list of variable length in a column. It is a table (categories, holidays,
  policy exceptions) or a set of typed columns (free weekdays).

## Validation Commands

```bash
yarn workspace @open-mercato/bookings typecheck
yarn workspace @open-mercato/bookings test
yarn workspace @open-mercato/bookings build
yarn generate
```

## Guard Tests

Core's audits stop at the core repository, so this package runs its own set in
`src/__tests__/guards/` (spec §14). Copies pointed at our paths:
`optimistic-lock-command-coverage`, `optimistic-lock-ui-coverage-workspace`,
`crud-indexer-config`. Rewrites against our own entity list, because the originals read a
hard-coded core map: `optimistic-lock-editable-entities`, `record-locks-coverage`. The
core-only UI sweep is not ported — the workspace one covers it. Our own: purity of
`src/lib/**` (the purity rule above), the `vis-timeline` import boundary (the Never above),
modelled on core's `xyflow-import-boundary` test, and the live-updates coverage test
(`architecture.md › Live updates`).

## Public Contract Surfaces

Categories follow `BACKWARD_COMPATIBILITY.md` in `open-mercato/open-mercato`.

### Database (BC #8 — ADDITIVE-ONLY)

```
bookings_bookings          bookings_participants
bookings_subjects          bookings_subject_categories
bookings_targets           bookings_settings
bookings_holidays          bookings_conflict_policy_exceptions
```

The spec names five; the last three are implementation deltas D2–D4. Foreign keys inside the
package are real; the link to `resources` / `staff` is a `provider_key` + `provider_record_id`
pointer with no foreign key, so a disabled provider module leaves history intact.

### Event IDs (BC #5 — FROZEN)

```
bookings.booking.created / .updated / .deleted
bookings.booking.placed / .moved / .resized / .cancelled
bookings.conflict.detected
bookings.coverage_gap.detected
```

Booking events carry `clientBroadcast: true`. Complete, reopen and no-show ride `.updated`
with the status change in the payload; only cancel has its own name.

### API routes (BC #7 — STABLE) — TODO: URLs are fixed here when the routes exist

Operations from spec §12:

```
targets                        factory — write and read
subjects                       factory — read and list; create goes through the provider plugin
subject categories             factory — write and read
bookings                       list, details, single-field edits
place / move / resize / change-status   undoable commands; cancel is an alias of change-status
timeline read                  one request: rows, bars, unavailability windows, calendar state;
                               filters: category, conflictsOnly, hideUnavailable
conflict read                  conflicts of subjects in a range, each with kind and other side
unplaced list                  separate cheap read
settings                       read and write, including holidays and policy exceptions
unavailability                 no write endpoint of its own — the form posts to planner's endpoint
```

Every route exports `openApi`, factory and hand-written alike. `updatedAt` is listed
explicitly among list fields. Write commands accept a list of participants; the first
version's screen sends exactly one.

### DI services (BC #9 — STABLE)

`bookingsOccupancyService` — the only server-side entry for other modules.

- Input: subjects and a date range, capped at one year; a longer question is rejected.
- Output: per subject, busy intervals with booking id and target id.
- Open bookings only (`planned`, `active`); no unavailability (that is the provider plugins'
  answer).
- Bulk, no paging.

### ACL feature IDs (BC #10 — FROZEN)

`bookings.view`, `bookings.manage_bookings`, `bookings.manage_settings`.

### Notification type IDs (BC #11 — FROZEN)

`bookings.conflict`, `bookings.coverage_gap`. Merged by grouping key — conflicts by subject,
gaps by target. Recipients: holders of `bookings.manage_bookings` in the organization. Each
is created with its source — the subject for a conflict, the target for a gap — and removed
for every recipient through `deleteBySource` once what it reported is gone, after a write and
in the daily scan (spec §9, §12).

## Internal-Only Surfaces

Subject to change without deprecation; nothing outside this package may import them: entity
classes under `data/entities/`, `services/`, `commands/`, `components/`, `lib/`, migrations,
backend pages and widgets. Other modules reach this module only through the API routes, the
events and `bookingsOccupancyService` listed above.

## Dependencies

`requires: ['staff', 'scheduler']` — `planner` and `resources` follow from `staff`. These are
hard dependencies, not soft-optional peers: without `staff` no unavailability rule can be
written (`403 staff_module_not_loaded`), so the module cannot run without them. Confirmed by
the reviewer on 2026-09-04. `requires` is a generator check, not enabling — an application
must enable all four (spec §5, §14).

Peer dependency on the first core release that carries `getUnavailabilityWindows`; the module
checks for the method when it registers its services.

## Structure

```
packages/bookings/src/
├── index.ts                  package barrel: export { metadata }
├── lib/                      PUBLIC and pure — the purity rule. Imported as
│   │                         @open-mercato/bookings/lib/<block>
│   ├── pure-engine/          conflicts, working days, coverage gap, window days — *.rule.ts
│   └── timeline/             ui/ (React), layout/ (pure), vis-timeline.adapter.ts, types.ts
├── __tests__/guards/         purity, vis-timeline import boundary, audits ported from core
└── modules/bookings/         everything Open Mercato discovers
    ├── index.ts              ModuleInfo metadata, re-exports features
    ├── acl.ts setup.ts di.ts events.ts notifications.ts search.ts
    ├── data/                 entities.ts, validators.ts — barrels over entities/<domain>/,
    │                         validators/<domain>/
    ├── api/                  folder = URL; no domain folders here
    ├── backend/              folder = page path; no domain folders here
    ├── commands/<domain>/    thin registerCommand wrappers, discovered by the generator
    ├── services/<domain>/    logic shared by a command and a worker; subjects/providers/ =
    │                         plugin interface + registry
    ├── components/<domain>/  React pieces used by pages; *.presenter.ts next to its component
    ├── subscribers/<domain>/ workers/<domain>/   discovered recursively; the subfolder joins the id
    ├── lib/                  technical helpers with no business rules: api paths, entity ids,
    │                         queue names, error classes, the live-updates table
    └── __tests__/<domain>/   __integration__/   i18n/   migrations/   widgets/
```

Six domains — `bookings`, `targets`, `subjects`, `scheduling`, `unavailability`, `settings` —
appear as subfolders in every folder that is ours and has content for them, never in `api/` or
`backend/`, where the folder name is the address. What each domain holds:
`architecture.md › Domain map`.

Persistence follows the platform: commands write through `em` inside `withAtomicFlush`;
there are no repository ports or adapters for the module's own tables (why:
`architecture.md › Layers`). The timeline is a folder inside this package, not a separate
package, isolated by the adapter file, the lazy load and the guard test (spec §11).

## Cross-Reference

- Spec: `.ai/specs/2026-08-10-bookings-module.md`
- Implementation deltas: `.ai/specs/bookings/implementation-deltas.md`
- Product brief: `.ai/specs/bookings/product-brief.md`
- Architecture: `.ai/specs/bookings/architecture.md`
- Package layout and conventions: root `AGENTS.md`, `.ai/skills/scaffold-module/SKILL.md`
- Core module guidance: `packages/core/AGENTS.md` in `open-mercato/open-mercato`
