# Bookings module — architecture

Companion to `packages/bookings/AGENTS.md`. The rules live there; this document explains
how the module is built and why. The design authority is
`.ai/specs/2026-08-10-bookings-module.md` (v3.2); where this file and the spec disagree,
the spec wins and this file gets fixed. Deliberate departures are recorded in
`implementation-deltas.md` next to this file. Vocabulary: the domain glossary in
`product-brief.md`, also next to this file.

Prose says "reservation" for the thing being booked; every identifier says `bookings`.

## Layers and dependency direction

The module keeps one hexagonal boundary, not four. Everything portable and pure lives in
`src/lib/` (`pure-engine`, `time`, `timeline`) and knows nothing about routes, commands or the
database. Everything under `src/modules/bookings/` follows the platform's own shape:
`makeCrudRoute` for CRUD, `registerCommand` for domain operations, `em` inside
`withAtomicFlush` for persistence. `src/modules/**` imports from `src/lib/**`, never the
other way.

Every layer must earn its place. There are no repository ports or adapters for the module's
own tables: the platform's write path already gives undo, audit, the query index and mutation
guards, so a second set of files per table would buy nothing. `src/lib/` is the package's
portable layer — the same purity bar as the engine itself, shipped inside the module package
and importable without enabling the module (`@open-mercato/bookings/lib/pure-engine`,
`@open-mercato/bookings/lib/time/day-ranges`, `@open-mercato/bookings/lib/timeline`).
`lib/time/date-fns.adapter.ts` is the only file that imports a date library (D11).

Scaling: the module holds no state in process memory. The only concurrency invariant — no
two overlapping open bookings of one subject under `reject` — is enforced in the database
with a per-subject advisory lock inside the write transaction, never with an in-process
mutex. Drafts on the timeline are browser state until Save.

## pure-engine

`src/lib/pure-engine/` holds the rules a dispatcher with pen and paper in 1985 would
recognize: two bookings of one subject overlap; a booking falls into an unavailability
window; which calendar days a window covers; how many working days lie between two dates;
how many working days remain before an unplaced booking's expected start; which status
transitions are allowed. Everything else in the package is plumbing that carries inputs to
these functions and their verdicts back out.

Four rules apply to the whole block. Pure functions over plain values — no classes with
state, no I/O, the same answer every time. No framework imports — the block bundles to the
browser (the purity rule in `AGENTS.md`). **No throwing** — a negative outcome is a verdict
returned as data (a conflict list, a rejected transition with its reason); whether a
verdict blocks a write is the command's decision under the organization's policy, never the
engine's. A broken contract is different: a value the schema already forbids (a non-positive
duration, a malformed date, a negative threshold) throws, because it is a bug in the caller,
not an outcome. `detectConflicts` is the one exception: it drops an unusable range instead of
throwing, because its input includes windows written by planner, and one broken foreign row
must not stop the daily scan for the whole organization. One rule set per file, `*.rule.ts`.

Time and identity arrive as input. `today` is computed by the caller in the target's zone
(D6); the engine never reads the clock — one `new Date()` inside a rule would move the day
boundary from the place of work to the server. Zones do not reach the engine at all (spec §8):
`lib/time/day-ranges.ts` turns stored instants into ranges of dates at the edge, the booking in
its target's zone and an unavailability window in its subject's. Nothing reads the browser's
or the server's zone. Thresholds that vary per organization (the coverage
warning days) are inputs to the rule, not constants inside it. The engine takes plain
snapshots, never entities, and returns new values, never mutating its inputs.

Status transitions are data plus `canTransition`. A "backwards" transition is either a
correction (the record was wrong about reality — `completed → active` reopens, and `no_show`
reopens the same way) or a compensation (the event really happened — `cancelled` stays
terminal and a new booking replaces the old one).

```ts
export function canTransition(from: BookingStatus, to: BookingStatus): TransitionVerdict {
  return ALLOWED_TRANSITIONS[from].includes(to)
    ? { allowed: true }
    : { allowed: false, reason: 'invalid_transition', from, to }
}
```

The engine's public surface in the first version:

```
detectConflicts({ placements, unavailability })                   → Conflict[]   kinds: overlap | unavailability,
                                                                    each with the other side; a placement is
                                                                    one booking against one subject, so a
                                                                    booking with several participants arrives
                                                                    as several rows; closed statuses and
                                                                    unusable ranges are dropped by the rule;
                                                                    every range is a half-open DayRange of dates
countWorkingDays(from, toExclusive, calendar)                     → number
addWorkingDays(start, duration, calendar)                         → IsoDate      the exclusive end: the day after
                                                                    the last working day; the start always counts,
                                                                    half a day rounds up (D12, spec §7.1)
coverageGap({ status, isPlaced, expectedStartOn, today, calendar, thresholdWorkingDays })
                                                                  → { workingDaysLeft, isOverdue } | null
canTransition(from, to)                                           → TransitionVerdict
```

At the edge, in `lib/time/day-ranges.ts` — the only functions that take a zone:

```
todayIn(now, targetZone)                                          → IsoDate      the caller's `today`
dayStartIn(date, zone)                                            → Date         what a write stores for a day
bookingDays(window, targetZone)                                   → DayRange | null  every date the window touches
unavailabilityDays(window, { subject, organization })             → DayRange | null  a window between midnights of
                                                                    the subject's zone, UTC or the organization's
                                                                    zone covers those dates; any other whole-day
                                                                    window sits on its middle; a window with hours
                                                                    covers every date it touches (D6)
```

`src/modules` imports only this file for dates; the adapter under it stays inside `src/lib`.

Every function takes plain values — and the calendar where it applies — and returns a
verdict, a number or a list of dates; none reads the clock, the database or the settings.
There is no parallel class model of "rich" domain entities: MikroORM entities are the data
model, the engine works on plain snapshots. The browser calls the same functions for a live
preview while dragging; the server re-validates on write.

## Write path

Every state change is a command (`registerCommand`), whether it comes from a route, a worker
or a subscriber; nothing writes through `em` outside a command. The command file is the one
place that parses input: routes hand the raw body to the command bus, the command parses it
with the operation's zod schema, and everything below receives the parsed `z.output` type
(`z.input` exists only for forms). One schema per operation, in `data/validators/<domain>/`.

The command owns the transaction — `withAtomicFlush(em, phases, { transaction: true })`; the
option is off by default, so it has to be written — and runs the `pure-engine` verdict inside
it when the policy is `reject`. A negative verdict becomes an error with a machine `code`.
Side effects — `emitCrudSideEffects({ indexer })`, events, cache — run after the commit,
never inside it. Commands register themselves on import: `commands/index.ts` imports every
command file and the module's `index.ts` imports that barrel, as `forms` and core's own
modules do on the platform release this package builds against (D13). A new command file
under `commands/<domain>/` needs one line in the barrel.

Scope (tenant, organization) is an explicit argument on every call, never hidden in a
closure. `pure-engine` receives ids and dates as input — `today` is computed in the
target's zone by the caller.

Three things go wrong most often: a business rule written inline in a command or service
instead of `pure-engine` (if an `if` encodes business knowledge, it belongs there); a
hand-written write route that skips `validateCrudMutationGuard` /
`runCrudMutationGuardAfterSuccess` — extensions that hook mutations are silently bypassed;
logic shared by a command and the scan worker duplicated instead of extracted to
`services/<domain>/`.

Reference implementation for a command and its route:
`packages/core/src/modules/customers/commands/` and `customers/api/` in
`open-mercato/open-mercato` — the shape the reviewer's checklist is written against.
Coercion happens at the boundary: the schema turns ISO strings into dates (`.transform`), and
the target's and the subject's zones are applied in the command, through `lib/time/day-ranges.ts`,
before anything reaches `pure-engine`.

## Read path

A read never writes. The one exception is named: the daily scan persists its
per-organization watermark and nothing else. CRUD lists go through `makeCrudRoute`; the
hand-written reads — timeline, conflicts, unplaced, the occupancy service — read `em` or
SQL on committed state, because they compute against bookings written a moment ago
(the committed-state rule). Foreign registries (`resources`, `staff`) are read through the
query engine (the foreign-registry rule).

The route parses query params with the operation's zod schema and hands the typed value
down; nothing below the route calls `.parse()`. Response DTOs are `z.infer` of a response
schema in `data/validators/<domain>/`, the same schema `openApi` exposes. Caller filters are
whitelisted by that schema; any guard filter is appended last so a caller can never override
it. A detail missing in the caller's scope is a 404 thrown as an error, never a `null` body.

The timeline read is a multi-source read: bookings from our tables through `em`, subject
rows from the provider plugins (query engine over `resources` / `staff`), unavailability
windows from planner's read method, calendar state from settings and holidays — each source
fetched on its own, then one pure assembler (`*.assembler.ts`) merging by subject id. Never a SQL join
across a module boundary; each source is read through its own entry, and the assembler stays
free of I/O. The conflict verdict itself comes from `pure-engine`; the assembler only
composes. Read-side arithmetic — thresholds, grouping — lives in a named pure function, never
in SQL. The read's own filters (`conflictsOnly`, `hideUnavailable`, category) are applied
after the assembly, on the composed rows.

Query-engine facts worth knowing: query ids use `module:full_table_name` (a wrong id returns
zero rows silently), entity ids for `indexer` use `module:entity`; items come back with
snake_case columns; filters are Mongo-style; soft-deleted rows are excluded by default —
never pass `withDeleted: true` from a read.

## Errors

`pure-engine` returns verdicts; the command or service turns a verdict the policy rejects
into an error. Every business error extends `CrudHttpError` from
`@open-mercato/shared/lib/crud/errors` and carries a body `{ error, code, details }`:
`error` is the translated sentence the platform's `apiCall` and `flash` show as they are,
`code` is a stable machine identifier the UI may use for its own copy, `details` holds the
values for interpolation (the subject, the slot, the other side of the conflict). Errors are
named after the business rule and defined in `lib/errors.ts`, never inline.

Why `CrudHttpError`: the platform's undo route passes it through with its status and body;
any other error is flattened to a plain 400 "Undo failed". Under `reject`, undo that would
recreate an overlap must come back as the same 409 with the same reason as a normal write.

Who maps errors to HTTP: factory routes (`makeCrudRoute`) get it from the platform.
Hand-written routes (timeline, conflicts, unplaced, the commands' routes) do not — the API
dispatcher re-throws an unhandled error and Next turns it into a 500. So every hand-written
route wraps its body in one shared catch from `lib/errors.ts`, the same shape core's own
hand-written routes use: `CrudHttpError` → `err.body` with `err.status`, `ZodError` → 400,
anything else → log and 500.

| outcome | status | code |
|---|---|---|
| zod parse failed | 400 | factory routes: the platform's `{ error: 'Invalid input', details }`, no code; hand-written routes: `validation_failed` |
| record not found in the caller's tenant and organization | 404 | `<entity>_not_found` |
| the organization has not chosen its time zone yet | 409 | `settings_required` |
| two bookings of one subject overlap under `reject` | 409 | `booking_overlap` |
| stale `updated_at` on a concurrent edit | 409 | the platform's `optimistic_lock_conflict` |
| forbidden status transition, placement on a cancelled booking | 422 | `invalid_transition`, `booking_closed` |
| a conflict with an unavailability window | — | never an error; reported in the response |
| anything unexpected | 500 | `internal_error`, full detail server-side |

403 answers *who* may not (identity forbids this actor); 422 answers *what* may not (state or
rules forbid the operation whoever asks). 400 means the input is wrong in itself, no state
consulted; 422 means the input is well-formed but the current state refuses it. Business code
throws business-named classes and never catches to rewrap. Status codes live once, on the
class. An unknown error is a 500 with a full server-side log, never dressed up as a client
error. Tests assert on the error type and its `details`, not on message strings.

## Talking to other modules

The module talks to four platform modules and knows them only through their public
surfaces: it reads `resources` and `staff` through the query engine, writes to them through
the command bus by command name, reads `planner` through `getUnavailabilityWindows`, and is
started by `scheduler`. Nothing imports another module's files; who imports whose type knows
about whom.

A cross-module command is not in our transaction. Adding a subject is two writes in two
modules: the registry record through the other module's command, then our subject row. When
the second write fails after the first succeeded, the error carries the created record's
identifier and the screen offers "attach existing" instead of repeating the first write
(spec §6). Never assume rollback across the boundary; design each step to be retried or
compensated.

Outward, the module offers one DI service (`bookingsOccupancyService`) and nine events;
other modules — a product's alert center, for example — react to the events and never read
our tables. Events carry an identifier and the fact, never the record: a listener that needs
details reads them through the read path. The provider plugin interface is the one
consumer-owned port in the package: we define the four questions, ship the `resources` and
`staff` answers, and a foreign registry adds its own. The planner read method is called
directly — a port there would be speculation.

The daily scan is deliberate polling: planner emits no event we could subscribe to for rules
written outside our screen, so one bounded pass per organization per day is the honest
alternative to a subscription that does not exist.

Feature or module? A folder that needs its own `acl.ts`, users or lifecycle is a module; a
folder of related files is a domain inside this one. By that test the working calendar and
unavailability are domains here, not modules of their own: neither has its own lifecycle, its
own permissions or a second consumer.

## Live updates

No screen ever needs F5. Every event a screen cares about is declared with
`clientBroadcast: true`; the platform's event bridge carries it over SSE to the browsers of
the same tenant and organization — audience filtering is server-side, the browser never sees
a foreign event — and each container subscribes with `useAppEvent` to the entities it renders
and invalidates its own query keys. Wildcards on the event side (`bookings.booking.*`), never
on the cache side: invalidating everything turns one change into a refetch storm.

SSE is freshness, not correctness: `refetchOnWindowFocus` and `refetchOnReconnect` stay on,
so a missed message means a briefly stale tab, never a permanently stale screen. A drag draft
on the timeline is local state until Save; incoming events refresh the background, never the
draft, and a real collision surfaces at save time through the conflict check. Payloads are
doorbells: an identifier and the fact, with `tenantId` and `organizationId` — without them
the bridge drops the event.

`lib/live-updates.ts` is the one table of event → query keys, and its test fails when an
event declared with `clientBroadcast: true` has no entry — coverage is read from one file,
not from thirty hooks.

## Data

Eight tables (`AGENTS.md › Public Contract Surfaces`), all declared as classes directly in
`data/entities.ts`, the only form the entity-id generator reads (D7). The spec names five; subject categories, holidays and conflict-policy exceptions are
tables here rather than columns, and `implementation-deltas.md` says why. Every table carries
the platform's standard columns; `bookings_settings` alone has no `deleted_at` — one deleted
row would block creating the next, and settings are never deleted.

Foreign keys inside the package are real, declared with `@ManyToOne` on the side that holds
the column: participants point at their booking and their subject, a booking at its target,
subjects and policy exceptions at a category. The link out of the package is not a foreign
key: a subject carries `provider_key` + `provider_record_id` and a copy of the name, so a
disabled provider module costs the label's freshness and nothing else. Property order inside
an entity is `id` → scope → relations → own columns → timestamps, because it is also the
column order of the generated table.

Enumerations the code branches on — booking status, participant role, conflict policy — are
text columns with an `as const` union in code, never a native database enum: a new value is a
code change, not a migration. Values that are only displayed belong in the platform's
dictionaries. A list of variable length is never a column: categories, holidays and policy
exceptions are tables, and the seven free weekdays are seven boolean columns, because that
set is closed.

Four things the database itself guards on a booking: the window pair is set fully or not at
all, `end_at` is after `start_at`, the duration is positive and moves in steps of half a day
— the numeric type alone would let one third through — and one subject appears at most once
in one booking. They are declared with `@Check` and `@Index` on the entity, never added by
hand in the migration: a hand-written constraint never reaches the schema snapshot and leaves
a drift nothing fixes later.

Two MikroORM traps: never call `em.find` / `em.findOne` between a scalar mutation and
`em.flush()` on the same manager — MikroORM 7 silently drops the update; fetch first, mutate,
flush once. `em.persist(...)` then `await em.flush()` (there is no `persistAndFlush`), and
`em.create(Entity, data, { partial: true })` to skip default columns.

Unique indexes on soft-deleted tables are partial (`WHERE deleted_at IS NULL`), or a deleted
row blocks re-creation: `(booking, subject)` on participants, `(tenant, organization,
provider_key, provider_record_id)` on subjects, `lower(name)` per scope on categories,
`(tenant, organization, holiday_on)` on holidays, `(tenant, organization, category)` on
policy exceptions. Settings take a plain unique index on `(tenant, organization)`, because
that table has nothing to soft-delete. Nothing derivable is stored: a conflict is never a
column, it is computed on every read. The module keeps no table of conflict facts — the
notification is the only record and it is delivery, not truth; the timeline shows the current
state, and a notification is withdrawn through `deleteBySource` once its cause is gone. The
migration and its schema snapshot land in the same commit.

## The scan

The daily scan is the module's only background job. One system-level scheduler entry with a
fixed identifier, registered by module setup, fires every hour and puts a job on the
`bookings-scan` queue; the worker (`workers/scheduling/scan.worker.ts`, concurrency 1)
walks every organization, computes today in that organization's zone, compares it with the
per-organization watermark and processes only the organizations whose local day has turned.
The job payload carries nothing — no tenant, no organization; walking them is the worker's
job, so an organization added later is never forgotten.

The scan skips an organization that has no settings row. It could not do anything useful with
one: the local date it compares against is computed in the organization's zone, and that zone
is what the missing row would hold. Nothing is lost — an organization with no settings has no
bookings either, because creating one is refused until the zone is chosen (D6).

For the rest the watermark is claimed with one update: `UPDATE bookings_settings SET
last_scan_local_date = today WHERE … AND (last_scan_local_date IS NULL OR last_scan_local_date
< today)`. An organization is processed only when that statement changed a row, which covers
one whose watermark is still empty. It also makes the scan idempotent under a retried job, a
job that runs longer than the hourly tick, or two worker replicas: only one of them wins the
day. An insert here would fail on the required zone, which is the honest outcome — the scan
has no business inventing one.

Each pass ends by clearing what is no longer true: for every subject and target it found
clean, the worker calls the notification service's `deleteBySource`, so a conflict or gap
notification disappears for every recipient once the cause is gone.

The scheduler entry targets a queue, not a command, on purpose. The local scheduler that
`yarn dev` runs executes a command target with a stub container (only `em`, `eventBus`,
`rbacService`; everything else throws "Service not available in scheduler context") and no
auth or organization scope, while the production worker passes the real container — a
command target works in production and fails locally. A queue job runs in the real
application container in both.

## UI

Pages live in `backend/`, reusable pieces in `components/<domain>/`. CRUD screens — targets,
categories, settings — are `DataTable` and `CrudForm` from the platform kit, nothing
hand-rolled. Two screens are bespoke because the kit has no equivalent: the timeline board
with its composer, and the unavailability form that posts to planner's endpoint. Bespoke
forms use react-hook-form typed as `useForm<z.input<S>, unknown, z.output<S>>` — `z.infer`
alone is output-typed and wrong for a form.

A screen has three jobs in three files. The **container** (`use-*.hook.ts` or `page.tsx`)
fetches through TanStack Query over `apiCall` / `fetchCrudList`, owns UI and URL state,
loading, error and empty states, and subscribes to the events it cares about. The
**presenter** (`*.presenter.ts`) is a pure function
`(dto, { t, formatDate, … }) → ViewModel` that makes every display decision — labels
through i18n keys, dates in the organization's format, flags such as `isOverdue` asked from
`pure-engine` — and is unit-tested without a DOM; the ViewModel is flat, `readonly`, already
translated, and holds no `ReactNode`. The **view** (`*.component.tsx`) renders the ViewModel
and fires callbacks up; no hooks, no fetching, no logic. A plain CRUD page needs no
presenter — add one when display logic appears, not by template.

i18n is an input: presenters receive `t`, the timeline component receives its labels as
props. The timeline imports its stylesheet in one component and maps the library's look to
the platform's design tokens through a handful of CSS variables with fallbacks — the same
shape core uses for `@xyflow/react` in the workflows module.

State, lowest rung first: component state (the drag draft — `pure-engine` may run on it for
a live preview, the server re-validates) → URL → TanStack Query (one key, one truth) →
SSE. No global client store. Identity and permissions come from the platform's contexts once
per page, never per row. Endpoint paths and query keys come from `lib/api-paths.ts`, never as
strings in components.

## Tests

The definition of done is spec §13 — the table of integration rows — plus the guard tests
in `AGENTS.md`. How the rest is tested, by layer:

| what | test | infrastructure |
|---|---|---|
| `src/lib/pure-engine` | plain unit: values in, verdict out; no mocks | none |
| `src/lib/time` | plain unit on the adapter, never mocked; clock changes, zones on both sides of UTC | none |
| `src/lib/timeline` | unit on `layout/` and on the adapter mapping (`vis-timeline` mocked); a render test only where behaviour is non-trivial | none |
| presenters | plain unit, `t` and formatters passed in | none |
| commands and hand-written routes | as the platform tests its own commands (`customers/commands/__tests__`) | per core's pattern |
| timeline read, conflict write under `reject` | one full-path integration each | the platform's harness |
| end to end | Playwright `TC-*.spec.ts` in `__integration__/`, one per spec §13 row | sandbox app |

Jest finds tests under `src/**/__tests__/` (the scaffold's `testMatch`), so unit tests sit in
`__tests__/<domain>/` next to the code they cover, not beside the file. Test names state the
business rule: `it('refuses the second booking of one subject under reject')`, not
`it('returns 409')`. Never mock `pure-engine`: a test of a mocked rule tests the mock.

Test data comes from builders under `__tests__/helpers/builders/`: `makeBookingBuilder()`
fills every field with valid defaults, `withStatus(...)` / `withWindow(from, to)` override only
what the test is about, `build()` returns a plain snapshot. Derived fields are derived, never
random pairs — `to` is computed from `from`, the duration and the working calendar exactly as
the module does. The provider plugin interface is the one port in the package and gets the
one contract test: the same scenarios against the `resources` plugin, the `staff` plugin and
an in-memory reference, so a third-party registry has a test to pass. Every integration test
of a read seeds a row of another tenant and a soft-deleted row and asserts neither comes
back; timestamps are compared as ISO strings. Arrange state through `em` and builders, assert
through the entry point the module ships — never a raw `em.find` in the test body. Run the
suite twice; the second run must pass on the state the first left behind.

## TypeScript

The platform's rules hold: strict mode, no `any`, types derived from zod with `z.infer`. On
top: fix the type, not the symptom — a cast at a boundary lies to the compiler, tighten the
upstream type instead; `satisfies` where a check is needed, `!` only in MikroORM entity
declarations. Validate at the system boundary only — zod in `data/validators/`, parsed in the
route or the command; inside the module, trust the types, no defensive checks or
null-coercion. Annotate what a reader would otherwise guess (exported constants, empty
collections, results of `reduce`), never the trivial. Exhaustive switches end with
`default: value satisfies never`. Types of external packages are imported or extracted
(`ReturnType`, `Parameters`, `Awaited`), never rewritten by hand — this includes
`vis-timeline`. Zod 4 idioms (`z.uuid()`, `z.iso.datetime()`, `z.treeifyError()`); a schema
with `.transform()` has two types, `z.input` for callers and `z.output` below the boundary.
Barrels exist only where they are a contract (`src/lib/*/index.ts`) or a framework
aggregator; libraries with a narrow surface are imported in exactly one file. No comments
except the rare trap a reader would otherwise "fix" — one sentence, why not what.

## Domain map

Six domains, the same subfolders in every folder that is ours (`AGENTS.md › Structure`),
each anchored in the spec:

| domain | what it holds | spec |
|---|---|---|
| `bookings` | booking, participants, place / move / resize / status, unplaced list, occupancy service, the timeline board | §7.1–7.2, §11, §12 |
| `targets` | the target registry | §7.4 |
| `subjects` | the subject list, subject categories and the provider plugins for `resources` and `staff` | §6, §7.3 |
| `scheduling` | conflict detection on write, the daily scan, coverage gaps, notifications, conflict policy | §9 |
| `unavailability` | the unavailability form — the only place the module writes toward planner | §10 |
| `settings` | working calendar, holidays, time zone, warning threshold, policy defaults and exceptions | §7.5, §8 |

Alerting, users and roles are not domains of this module: a product's alert center consumes
our events, permissions are `acl.ts` plus the platform's role model.
