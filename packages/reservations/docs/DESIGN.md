# Reservations Module — Design (MVP / Pillar 1)

Design record for the `reservations` module, planned as a contribution to the
Open Mercato (OM) framework as an **official module** (`@open-mercato/reservations`,
separate package in the `official-modules` repo — tentative, may change after
talking to maintainers). Written in the style of SiteDispatch's
`docs/design/DESIGN.md`; self-contained.

Sources: reservations spec Pillar 1 (`Reservations module specification for Open
Mercato 3.md`), Pillar 2 specs (`Reservations MVP Pion 2 specyfikacja OM.md`,
`... dev.md`), SiteDispatch `docs/design/DESIGN.md`, and code research of both
repos (2026-07-30). Scope: **Pillar 1 MVP designed in full; Pillar 2 as a
flexibility digest** (§10).

---

## 1. Purpose and scope

One question the module answers: **"reserve this concrete subject for this
target in this time window, and warn when something overlaps."** Generic by
design — equipment, rooms, appointments, shifts are all the same mechanism;
a product adds meaning (custom fields, own registries, own alerts).

MVP (Pillar 1): reservation entity with an unplaced state, conflict detection
(overlap + unavailability), coverage-gap early warning, org working calendar
(soft — informs duration math, never blocks), resource-lane timeline (day
scale), free-subject visibility, module parameters (warning threshold,
calendar).

Deliberately NOT in MVP: rule engine, qualification matching, target-first
approval flow, cascade push/pull, capacity pools, hour scale UI (model is
ready), per-subject calendars, **drag&drop editing on the timeline** (see §7 —
commands exist, the UI affordance is a fast-follow).

## 2. Packaging and consumption levels

Official module = a regular npm package. Deep imports work **without
activating the module**; activation only turns on runtime discovery (pages,
API, entities, migrations). This gives a pyramid of consumable blocks — each
level uses the ones below, a consumer enters wherever they need:

```
@open-mercato/reservations
├── /engine            level 0: pure functions (conflicts, working calendar math)
│                        zero deps → any app, server AND browser
├── /ui/timeline       level 1: <Timeline>/<Backlog> — props-fed, zero domain
├── /ui/board          level 2: ReservationsBoard host (board definition → screen)
├── /providers         SubjectProvider types + planner adapter (write your own registry adapter)
└── module activation  level 3: out-of-the-box product (entities, API, pages, menu, seeds)
```

**Every public import path is a contract surface** (OM
`BACKWARD_COMPATIBILITY.md`). We export deliberate barrels per level — what is
not in a barrel is not promised.

## 3. Architecture boundary (hybrid, recorded decision)

Rule: **pure/hexagonal = everything portable and shared** (engine, calendar
math, timeline component, presenters, the planner adapter port);
**OM conventions = everything touching transport and persistence**
(`makeCrudRoute` for CRUD, `registerCommand` with undo/redo for domain
operations, CrudForm, zod validators, `indexer` on side effects, mutation
guards). Use cases may exist but live INSIDE command wrappers — this satisfies
OM's "writes via the Command pattern" rule; we do not bypass `makeCrudRoute`
for CRUD-shaped surfaces (that override was a SiteDispatch-local decision and
does not travel to a contribution).

```
src/modules/reservations/
├── lib/engine/            PURE CORE — no ORM, no DI, no OM imports, no throwing
├── lib/timeline/…         (exported as /ui/timeline)
├── lib/planner-adapter.ts  the one real port: fetch rules → merged windows → engine shape
├── data/entities.ts        Reservation, ReservationTarget, ReservationSettings
├── data/validators.ts      zod
├── api/                    makeCrudRoute + hand-rolled timeline endpoint (+ openApi)
├── commands/               place / move / resize / cancel (undo/redo snapshots)
├── subscribers/            conflict detection (reactive read → event)
├── workers/                coverage-gap scan
├── backend/                boards, targets, settings pages
├── widgets/dashboard/      optional KPI widget
├── acl.ts / setup.ts / di.ts / events.ts / notifications.ts / search.ts
├── i18n/{en,pl,de,es}.json
└── migrations/
```

The engine bundles to the browser (live conflict preview while editing);
one server-only import inside `lib/engine/` is a review-blocking bug.

## 4. Data model

All tables: `id uuid PK`, `tenant_id` + `organization_id` (indexed together,
every query scoped), `created_at`, `updated_at` (**OM optimistic locking is
default ON** — `updated_at` header mechanism, not a version column), `deleted_at`
(soft delete).

Naming (recorded decision): **`reservation` / `reservation_target`**, not the
spec's `assignment` — the module is called reservations; `assignment` collides
with permissions/tasks vocabulary in OM and needed a glossary to defend.

### `reservations_reservations` (Reservation)

| Column | Type | Notes |
|---|---|---|
| `subject_type` + `subject_id` | text + uuid | planner-consistent (`resource` \| `ruleset`), both NOT NULL. `member` is deliberately NOT in the contract — no hookup path produces it (spec routes persons via their own rule set); adding it later is additive |
| `subject_provider_key` | text | which SubjectProvider resolves this subject (labels, board routing) — `'resources'` for path 1; without it every `ruleset` subject would need a scan across providers |
| `target_id` | uuid, nullable | FK-id (no ORM relation); exactly one of `target_id` / `target_text` is set (DB CHECK — SD-51 round) |
| `target_text` | text, nullable | free-form target name — a reservation may name its target without a target record (SD-51) |
| `start_at` / `end_at` | timestamptz, nullable | **placement pair** — both set or both null (DB CHECK); null = unplaced (backlog) |
| `status` | text | **code enum** `planned \| active \| done \| cancelled` — the engine branches on it (litmus: code branches → enum; display-only → dictionary) |
| `duration_working_days` | numeric(4,1) | 0.5 step; MVP forms restrict to whole days |
| `latest_start` | date, nullable | start deadline |
| `note` | text, nullable | free-text note (in the SD-51 contract schemas) |

Indexes: `(subject_type, subject_id, start_at)` for the engine; partial
`WHERE start_at IS NULL` for the backlog. `timestamptz` from day 1 → Pillar 2
hour scale needs no migration in OUR schema (the planner-side hour-precision
caveat lives in §6). Cross-module links declared with `defineLink` in
`data/extensions.ts` where the query engine should join across the boundary
(spec §10) — concretely: reservation → subject, so the reservations list can
filter/sort by subject columns.

### `reservations_reservation_targets` (ReservationTarget)

`name`, optional target window (`starts_at`/`ends_at`), `address_text`
(snapshot; **no ORM relation to CustomerAddress** — FK-id + snapshot pattern).
Products extend via custom fields (`ce.ts`); the core knows no "job site" or
"meeting". Pillar 2 additive: `urgent_asap bool` (CHECK: mutually exclusive
with a start date), `customer_id uuid` (address provenance).

### `reservations_settings`

`@Unique(tenant, org)`: working calendar (`off_weekdays jsonb`,
`holidays jsonb`), `coverage_warning_days int`, `timezone text` (IANA name —
the organization's reference timezone, §6 "Timezone & DST"; at implementation
check whether OM `directory` already carries an org timezone — then this
column becomes an override/fallback). Pillar 2: active subject types,
shared-vs-per-type calendar choice. Scope note: the dev doc says
settings are "per tenant"; we scope per **organization** (tenant + org unique)
— org is OM's working boundary for calendars and rosters, and a tenant-wide
value is trivially expressed by identical rows. Recorded as a conscious
narrowing, not a drift.

**Recorded deviation from spec §6:** the spec stores the working calendar as a
dedicated planner rule set with its id in `configs`. We follow the newer dev
docs (and SiteDispatch's revised design): the calendar lives in
`reservations_settings` and is **mapped to unavailability windows at compute
time, never written into planner**. Reasons: `configs` is global (cannot hold
per-org data); a planner rule set is an extra indirection for data only the
engine reads. See §6 for how the mapping works.

## 5. Subject registry: contract + providers

A reservation stores only `subject_type + subject_id`. Two hookup paths
(spec §6):

- **Path 1 — OM `resources`** (hard dependency per spec §5: "we do not build
  our own registry"): `subject_type='resource'`, `subject_id=resource.id`;
  the resource already carries `availability_rule_set_id`.
- **Path 2 — any other registry**: the consumer creates a dedicated
  `PlannerAvailabilityRuleSet` per subject **in its own command**
  (recorded decision — cross-module commands are not in our transaction
  anyway) and reserves via `subject_type='ruleset'`,
  `subject_id=ruleSetId`. The rule set is the universal adapter; planner's
  enum stays untouched.

**SubjectProvider (fills a real spec gap).** The spec's registry contract
(§7.3) says the consumer "maps its entities onto the engine's generic input"
but names no mechanism for enumerating subjects (board rows, composer
dropdown). We add a DI-registered provider port:

```ts
type SubjectCategory = { id: string; label: string; color?: string; icon?: string }
type SubjectRow = {
  subjectType: 'resource' | 'ruleset'
  subjectId: string
  label: string            // display-ready; i18n is the PROVIDER's job
  category: SubjectCategory // row grouping; shape-only contract — the default
                            //   provider maps resources_resource_types (own
                            //   table), a custom one may map a DictionaryEntry
  isActive: boolean
}
type ReservationSubjectProvider = {
  key: string                                       // 'resources' | 'my_module.rooms' | …
  listSubjects(scope: TenantScope, params: { categoryId?: string; page: number; pageSize: number }):
    Promise<{ items: SubjectRow[]; total: number }>  // paged — registries can be large
  resolveSubjects(ids: string[], scope: TenantScope): Promise<SubjectRow[]>  // labels for stored reservations
}
```

Contract notes: ordering is the provider's (stable, label-based by default);
a throwing provider degrades to an error state on ITS board only (other
providers unaffected); availability hints ("which subjects are free in this
window") are the CORE's job — the engine over windows — never the provider's.
Reservations store `subject_provider_key` (§4), so resolving a stored subject
back to its provider is a column read, not a provider scan.

Two-tier model (recorded decision, PM to confirm):

1. **Default provider for `resources` ships with the module** — after
   activation the menu appears (auto-discovered pages + `defaultRoleFeatures`),
   boards render resources per resource type, seeds provide a working demo.
   Zero code for the default path ("like the teams module").
2. **Custom registries register their own provider** in their `di.ts` under a
   naming convention (`reservationsSubjectProvider:<key>`); reservations
   enumerates registered providers from the flat Awilix container. Precedents:
   `integrations` providers, planner's DI-overridable `availabilityAccessResolver`,
   dashboards' widget registry.

Pillar 2's "active subject types" switch toggles provider keys/categories —
configuration, not code.

## 6. Planner integration and the working calendar

**Planner integration is READ-ONLY (recorded deviation from spec §7.1 —
review-driven).** The spec mirrors every placed reservation into planner as a
"busy" rule so planner alone answers "is this subject busy". Design review
(external + ours) showed the mirror's real price: a dual write across two
modules with no shared transaction — partial failure yields a reservation
nobody sees as busy (the exact bug class the module exists to prevent),
requiring a `pending_sync` state, a reconciliation worker, orphan detection,
and a core RRULE-parser change just to ENCODE multi-day busy windows. What it
bought was speculative: no OM consumer automatically reads such rules today
(the one ready seam, `AvailabilityRulesEditor.loadBookedEvents`, takes a
callback — not planner rules), and SiteDispatch shipped the same design with
the mirror never implemented. Decision: **we write nothing to planner.**

Ownership split (the spec §8 boundary, kept intact):

- **Planner owns (un)availability** — service windows, breakdowns, rosters —
  written by planner's/resources'/staff's own UIs. We READ it: the adapter
  expands **unavailability rules directly** for the range and feeds the
  intervals to the engine. (Not via
  `getMergedAvailabilityWindows` — that returns merged *availability*, and a
  subject with no availability rules, typical for equipment, yields nothing
  regardless of its unavailability rules.) For path-1 subjects the adapter
  queries BOTH targets: rules on `subjectType='resource'` and, when
  `availability_rule_set_id` is set, rules on that rule set. This read
  adapter is the `plannerAvailabilityAdapter` the spec (§8) suggests
  contributing to OM.
- **Reservations owns reservation busyness** — the `reservations_reservations`
  table is the only truth; no mirror, no sync, no `planner_rule_id`. For
  external consumers we publish a DI read service
  (`reservationsBusynessService.getBusyWindows(subject, range, scope)`) and
  the §8 events — consumers ask us the same way we ask planner.
- **Future direction (recorded, post-MVP — proposal for OM):** if "one place
  answers busy" is wanted back, the right shape is inversion, not a mirror:
  a provider registry on the availability service (modules register window
  providers; the service aggregates). Single source by composition, truth
  stays in each module, no dual write. This would be a core contribution.

**Planner dependency softness (spec §10 followed):** `requires: ['resources']`
hard, planner resolved via `tryResolve`. Degradation without planner: engine
runs with `unavailability: []` — overlap conflicts still work, unavailability
conflicts don't, and there is NO planner-side busyness contract to break
(read-only integration makes the degradation trivially safe). Levels 0–1
(engine, timeline) never touch planner at all.

With no planner writes, the MVP has **no cross-module write at all** — the
dual-write consistency question (compensation, reconciliation, orphaned
rules) disappears instead of being answered.

### Timezone & DST (review-driven — the reference timezone is named)

**A "day" is a day in the ORGANIZATION's timezone** — configured as
`reservations_settings.timezone` (§4). Rationale: the working calendar,
holidays and working-day math are operational properties of the organization,
not of the viewer; dispatchers sharing subjects must see ONE truth.

- **Storage:** `start_at`/`end_at` stay timestamptz (UTC instants). Day-scale
  placement normalizes to org-timezone day boundaries (start of day in org tz
  → instant). `latest_start` and holidays are calendar dates (`date`,
  zone-free), interpreted in the org timezone.
- **The engine stays pure and timezone-blind:** it computes over ISO dates and
  intervals; instant ↔ org-local-date conversion happens at the EDGES
  (commands, adapters, presenters) and the timezone arrives as INPUT — same
  rule as "no clock inside".
- **DST:** durations count working DAYS, not hours — a day is the org-local
  calendar day whether it has 23, 24 or 25 hours, so a DST boundary never
  changes a duration. The Pillar 2 hour scale operates on instants
  (DST-safe by construction); rendering shows org-zone wall time.
- **Viewer:** boards render in the ORG timezone, not the viewer's — the
  timeline component already takes a `timeZone` prop (TZDate). A "my
  timezone" display mode is post-MVP.
- **API:** every datetime is ISO-8601 with an explicit offset/UTC; the
  timeline response carries the org `timezone`; `from`/`to` and day
  boundaries are interpreted in it (§8).
- **Planner adapter** respects each rule's own `timezone` column when
  expanding unavailability windows (planner stores it per rule/rule set).

### How the working calendar actually works (note requested during review)

The calendar **state** is persisted (jsonb in `reservations_settings`: off
weekdays + holidays, one row per org). Unavailability **windows** derived from
it are never persisted — they are computed from the saved state at the moment
of use, in two places:

1. **Math:** the engine receives the calendar as plain input
   (`freeWeekdays: number[]`, `holidays: date[]`) for duration/end-date
   computation (`computeEndAt` over working days) — and ONLY for that: the
   calendar is soft (spec §4.1) and never enters conflict detection (§7).
2. **Rendering:** boards pass `offWeekdays`/`holidays` as timeline props; the
   component paints background bands itself.

Nothing is lost because the jsonb settings row is the source of truth; windows
are a function of it, recomputed fresh every time. History: an earlier
SiteDispatch draft stored the calendar as a planner rule set and this was
**deliberately reverted** (planner = needless indirection; `configs` can't do
per-org). Spec §6 still carries the old variant — hence the recorded deviation
in §4.

## 7. Conflict engine and timeline

### Engine (`/engine`, pure)

```ts
detectConflicts({
  reservations: ReservationWindow[],   // committed windows of ONE subject
  unavailability: Interval[],          // from the planner adapter (planner rules only —
}): Conflict[]                          //   the working calendar is SOFT and never conflicts)
```

- **Two kinds in MVP** (spec §8): `overlap` (two reservations of the same
  subject in intersecting windows) and `unavailability` (reservation falls
  into an unavailability window). Half-open intervals (`endAt` exclusive) —
  ported 1:1 from SiteDispatch's `hasOverlap`.
- **Only PLACED reservations are visible to the engine** — an unplaced
  reservation has no window, so it cannot conflict, occupy planner, or cover
  a target.
- **Timezone-blind by design** (§6 Timezone & DST): the engine never converts
  zones — callers pass org-local ISO dates / UTC instants; the org timezone is
  an edge concern.
- **Status machine** (spec §7.1): `planned → active → done`; `planned|active
  → cancelled`; `done → active` (correction — the record was wrong about
  reality); `cancelled` terminal. The engine counts `planned` and `active`
  only — closing (`done`/`cancelled`) frees the window by that rule alone
  (no planner mirror to clean up, §6); history stays in our table.
  `planned → active` trigger (manual action vs scheduler at `start_at`) is an
  open question carried from SiteDispatch — wire at implementation (§11).
- **Resize semantics:** `duration_working_days` is the master —
  `resize` changes duration and recomputes `end_at` over the calendar;
  whether a later calendar change (new holiday) recomputes existing `end_at`
  stays open (§11, carried from SiteDispatch's P5).
- **Free-subject visibility** (spec §2, MVP): no separate feature — the board
  of a subject type already renders every subject's reservations and
  unavailability in the window, so "what is free" is visible by inspection;
  the composer's availability hint computes over the same windows.
- **Flagged, never blocking.** Writes succeed; a conflict is a red bar
  (read-side, recomputed on every read, never persisted) + an event. The
  command response carries NO conflict list (detection is post-commit) — the
  red bar arrives with the next read / SSE refresh; acceptable because
  conflicts never block.
- **Concurrency semantics (named explicitly, proposal-review round):** two
  dispatchers placing the same subject in overlapping windows BOTH succeed —
  both get the post-commit conflict warning, neither is blocked (advisory by
  design: a schedule conflict is a human decision, not a write error).
  Concurrent edits of the SAME record are a different case: OM optimistic
  locking (default ON, `updated_at` header) rejects the stale write with a
  structured 409 — CRUD path via the `makeCrudRoute` guard, commands via
  `enforceCommandOptimisticLock` (§8 error semantics).
- **Detection is a separate reactive read** (spec §8 correctness note):
  place/move/resize commands only mutate and emit their events; a persistent
  subscriber reads **committed state via em/SQL** (never the query index — it
  converges asynchronously and can miss its own trigger), runs the pure
  function, and on a non-empty result emits `reservations.conflict.detected`
  (`clientBroadcast: true`, id-only descriptor payload). Subscriber is
  `persistent: true` → must be idempotent (notification groupKey dedup covers it).
- **Live preview:** the same functions bundle to the browser — conflict
  highlight while editing, no round-trip; the server always re-validates.
- **Coverage gap:** pure function + scheduled worker scan; threshold from
  settings; ASAP targets skipped (Pillar 2). Emits
  `reservations.coverage.gap_approaching`.
- **Notifications (recorded decision — module useful out of the box):**
  `notifications.ts` declares types; a subscriber delivers via
  `notificationService` with a **per-kind groupKey**: conflicts →
  `conflict:subjectType:subjectId`; coverage gaps → `coverage_gap:targetId`
  (a gap has no subject — a subject-keyed formula would break dedup). Dedup
  free from OM (`createOrRefreshNotification`). **No alert-fact entity** — the
  Alert Center is SiteDispatch superdomain; there, the SD `alerts` module
  becomes a CONSUMER of our events.

### Timeline (`/ui/timeline`)

Base: SiteDispatch `packages/timeline` (vis-timeline; ~650 LOC TS/TSX + ~385
LOC CSS; props-fed, zero domain) — already has resource lanes, bars + detail
panel, backlog strip, off-day background rendering, day scale, and the
vis-timeline adapter isolated in one file (swap seam).

Vocabulary: the **composer** is the reservation create/edit form docked at
the board (subject picker with availability hint, target, duration, window);
a **board definition** is the config object a page hands the board host
(`{ provider, filter, composer options }`, §9).

**MVP scope (recorded decision — spec check confirmed drag&drop is NOT a
declared MVP feature; all mentions are incidental):** read-only axis + detail
panel; window edits go through the composer/form. The **commands**
`place/move/resize` exist in the API from day 1 (forms use them; detection
triggers on them). The component contract is edit-ready now (cheap):
`editable?`, `onItemMove/onItemResize`, injectable draft operations, item
conflict state — the affordance stays off.

**Fast-follow (digest):** drag&drop + resize (vis-timeline `editable`), local
draft mode with Save/Discard (`batch_apply` command — host owns the draft, SSE
never clobbers it), live conflict highlight during drag.

**Styling:** `timeline.css` already routes everything through its own ~8 CSS
variables; mapping = swapping that one definition block to OM design-system
tokens (`--tl-bg: var(--background)`, `--tl-fg-muted: var(--muted-foreground)`, …)
with fallbacks for standalone use. Bonus: light mode for free (today the
component is dark-only). Conflict/status coloring maps at the presenter level
(status tokens); the component stays token-agnostic. i18n: all labels are
props (already true) — no `useT` inside the component.

**vis-timeline vs `ScheduleView` (recorded decision + risk):** spec §9
explicitly leaves the component choice open (reuse OM's `ScheduleView` on
react-big-calendar vs a light props-fed component). We pick the SiteDispatch
component because a resource-lane axis is vis-timeline's native model and is
NOT react-big-calendar's (day/week/month views, no lanes), and the component
already exists and is domain-free. Risks: a new heavy dependency in OM — must
follow OM's lazy-import guard pattern (`lazy-heavy-libraries` test:
`next/dynamic`, no static import from the barrel); maintainer pushback is
possible — the adapter file is a documented swap seam, and the props contract
is lib-agnostic.

## 8. Module surface

| Surface | Mechanism |
|---|---|
| `reservation_targets` CRUD | `makeCrudRoute` (indexer, optimistic lock, openApi) |
| `reservations` list/detail + descriptive updates | `makeCrudRoute` |
| `place` / `move` / `resize` / `change-status` | `registerCommand` + undo/redo; custom routes with both mutation guards; `enforceCommandOptimisticLock`; `cancel` is an alias route of `change-status` (SD-51) |
| board `GET timeline` | hand-rolled composition endpoint (contract below) |
| `GET subjects` | subject enumeration over the §5 provider port (composer picker; DI port unchanged — SD-51) |
| `settings` get/replace | simple route + command |
| busyness for other modules | DI read service `reservationsBusynessService.getBusyWindows(subject, range, scope)` — the outward busyness contract (§6); no planner mirror |

**Timeline endpoint contract** (the module's flagship read):
`GET /api/reservations/timeline?provider=<key>&from=<iso>&to=<iso>&categoryId?=&page?=&pageSize?=`,
feature `reservations.view`, standard list envelope over subject rows; the
response carries the org `timezone` (with `from`/`to`/day boundaries
interpreted in it, §6 Timezone & DST) and the calendar state
(`offWeekdays`/`holidays` — board background in one fetch instead of two,
SD-51):

```ts
type TimelineRowDto = {
  subject: SubjectRow                       // from the provider (§5)
  reservations: Array<{ id; targetId; targetName; startAt; endAt; status;
                        conflict: boolean }> // conflict recomputed per read by the
                                             //   engine — never persisted (§7)
  unavailability: Array<{ startAt; endAt; reasonLabel? }>  // planner adapter (§6)
}
```

Paging applies to subject rows (lanes), not bars; `from`/`to` bound the
window. Backlog (unplaced) is a separate cheap read on the partial index.

**Error semantics** (OM patterns, uniform):
- zod parse failure → 400; record not found in tenant/org scope → 404
- optimistic-lock conflict on any write → structured 409, surfaced by
  `surfaceRecordConflict` (CrudForm does it automatically)
- domain rule rejection (forbidden status transition, placement on a
  cancelled reservation, ASAP+date on a target) → 422 with a machine `code`
  the UI translates
- **placement causing a schedule conflict is NOT an error** — 2xx, no
  conflict list in the response (detection is post-commit, §7)

- **ACL:** `reservations.view`, `reservations.manage_reservations`,
  `reservations.manage_settings`; `defaultRoleFeatures`: admin
  `reservations.*`, employee `reservations.view`; ACL sync in setup flow.
- **events.ts:** CRUD + `placed/moved/resized/cancelled`
  (`clientBroadcast: true` — boards live via SSE), `conflict.detected`,
  `coverage.gap_approaching`.
- **Pages** (auto-discovered, menu appears on activation): boards per active
  subject type (pageGroup "Reservations"), targets list (DataTable+CrudForm),
  settings (calendar + threshold, `pageContext: 'settings'`). Backlog is a
  board section, not a page. Optional dashboard widget (today's
  reservations / open conflicts).
- Plus: `search.ts` (targets + reservations), i18n en/pl/de/es, per-module
  migrations, `__integration__/TC-*.spec.ts` (contribution flow requires
  integration coverage listed in the spec and shipped in the same change).
- **Testing strategy per level:** engine — plain unit tests (values in,
  verdicts out; no mocks, no DB); timeline — unit tests on pure utils +
  adapter mapping (vis-timeline mocked); module — command/API tests per OM
  conventions + the integration coverage table below.

### Integration coverage (definition of done)

Per OM contribution rules the `TC-*` specs ship in the same change and are
self-contained (fixtures created in setup, cleanup in teardown, no seeded/demo
data). This table doubles as the MVP exit checklist:

| Path | Coverage |
|---|---|
| targets CRUD + reservations CRUD | create/read/update/delete under tenant/org scope; 409 on stale `updated_at` |
| `place` / `move` / `resize` | happy path with `end_at` recomputed over the working calendar; 422 placing a cancelled reservation; 409 on stale version |
| `change-status` (+ `cancel` alias) | allowed transitions; 422 on forbidden ones; `done`/`cancelled` frees the window (drops out of conflicts and busyness) |
| `GET timeline` | response shape (subject rows, per-read conflict flag, calendar state); paging over rows; planner degradation path (empty unavailability, overlaps still detected) |
| `GET subjects` + backlog | paged provider enumeration; unplaced list on the partial index |
| `settings` get/replace | write + read back; input validation |
| event emission | `reservations.conflict.detected` after an overlapping placement; `reservations.coverage.gap_approaching` from the scan |
| UI: board | subject rows + reservation bars render, conflict marked, refresh on SSE event |
| UI: composer, targets, settings | create/edit a reservation from the form; targets via DataTable+CrudForm; save calendar + warning threshold |

**MVP exit conditions:** (1) the coverage table above implemented and green;
(2) after activation the module works with zero code — menu, board over
`resources`, forms, settings, seeds; (3) pure blocks (engine, timeline) are
independently importable and unit-tested; (4) the consumer how-to guides ship
in the package.

**Observability & rollout:** diagnostics via the platform structured logger
(`createLogger`); the module's typed events are the operational signal (no
custom metrics infra). Rollout is additive: optional module, activation per
app, create-only migrations, ACL + seeds via setup, soft planner dependency —
activation order irrelevant; rollback = deactivate (tables and data stay, no
other module depends on their presence).
- **Consumer docs (ships with the module):** two how-to guides — "write a
  SubjectProvider" (implement the §5 type, register
  `reservationsSubjectProvider:<key>` in your `di.ts`, satisfy the registry
  contract incl. rule-set creation in your own command) and "add a board
  screen" (one `page.tsx` with a board definition `{ provider, filter,
  composer options }` + `page.meta.ts`). Both with a worked example; the
  provider example doubles as an integration-test fixture. OM's contribution
  flow expects module docs — this is that deliverable.

## 9. UI reuse patterns (how screens consume the blocks)

OM has no click-together screens; the idiom is **generic host + per-screen
config in code** (DataTable: `data` + `columns` + `apiPath` fetched by the
container via `fetchCrudList`, standard list envelope, extension slots via
stable `extensionTableId`). Our `ReservationsBoard` host copies this contract:
a board definition `{ provider, filter, composer options }` + a timeline
endpoint returning the standard envelope; a new board = one `page.tsx` with a
definition (SiteDispatch's twin ~190-LOC board pages collapse into two
definitions). Dashboards prove the "registered blocks, user-composed in UI"
pattern if board composition ever needs to be user-facing (post-MVP; data
model blocks nothing). Per-axis UI state (Pillar 2 scale switch) uses
`versionedPreference` (localStorage), not entities.

## 10. Pillar 2 digest (model ready, UI/logic later)

| # | Area | Readiness in MVP model |
|---|---|---|
| P2-1 | hour scale + 15-min step | `timestamptz` from day 1; scale = props + `versionedPreference` |
| P2-2 | many subjects per target | already relational (N reservations → 1 target); "staffed" = ≥1 |
| P2-3 | target-first view | targets without reservations + composer suggestion — new screen, no migration |
| P2-4 | ASAP | additive column + CHECK (excludes start date) |
| P2-5 | address from customers | additive `customer_id`; FK-id + snapshot pattern already in MVP |
| P2-6 | hourly / per-type calendar | jsonb extension in settings; engine: narrower windows, same logic. Caveat: hour-precision UNAVAILABILITY read from planner is limited by its parser (`once` rules expand to full days) — planner-side fidelity issue, no longer our core dependency (§6) |
| P2-7 | active subject types switch | provider keys/categories toggled in settings — configuration, not code (§5) |
| FF-1 | drag&drop + draft + batch apply | **design fast-follow, NOT a Pillar 2 spec item** — component contract ready (callbacks); move/resize commands exist |
| post-MVP | rule engine, qualifications, approvals, cascade, capacity, series | stable ids + events suffice (additive) |

## 11. Risks and open questions

1. **No cross-module writes in MVP** (planner integration is read-only, §6) —
   the dual-write consistency class is designed OUT, not mitigated. Watch that
   later features (Pillar 2+) don't reintroduce it casually.
2. **Planner parser limits READ fidelity of unavailability** (§6): `once`
   rules expand to one full day ignoring `DURATION` (`PT#H#M` only). Day-scale
   MVP unaffected; hour-precision unavailability (Pillar 2) inherits the
   limit — a planner-side improvement, proposed to OM alongside the
   provider-registry direction (§6), no longer OUR core dependency.
3. **vis-timeline acceptance** by OM maintainers — adapter seam is the answer
   (+ mandatory lazy-import guard, §7); worst case the component re-skins onto
   another lib behind the same props.
4. **official-modules flow** — cross-repo (submodule, changesets, two
   coordinated PRs if a core change is ever needed — none is, for MVP, after
   the read-only decision); confirm placement with maintainers (tentative
   decision: official module).
5. **Provider enumeration in Awilix** (flat container, name-convention scan) —
   confirm pattern on a spike.
6. Open questions carried from SiteDispatch (apply verbatim here):
   `planned → active` trigger (manual vs scheduler at `start_at`); does a
   calendar change (new holiday) recompute existing `end_at` (P5); placement
   drop on a free day — snap to next working day or allow (calendar is soft)?
7. PM confirmations pending: official-module placement; drag&drop out of MVP;
   default-provider two-tier model.

## 12. Decision log (this design round)

| Decision | Choice |
|---|---|
| Scope of this document | Pillar 1 full + Pillar 2 digest |
| Home | official module `@open-mercato/reservations` (tentative) |
| Timeline | SiteDispatch `packages/timeline` (vis-timeline) as base, extended |
| Entity naming | `reservation` / `reservation_target` (not `assignment`) |
| Internal architecture | hybrid: pure core + OM transport conventions |
| Consumption | 4 levels, deliberate export barrels = contract |
| `resources` dependency | hard (`requires: ['resources']`), default provider ships with module |
| `planner` dependency | soft (`tryResolve` + defined degradation, per spec §10), **read-only** — unavailability conflicts need it, nothing else |
| Busyness ownership | **no dual write** (deviation from spec §7.1, review-driven): reservations table is the only truth; outward contract = `reservationsBusynessService` + events; "one place answers busy" returns post-MVP as a provider-registry proposal for OM, not a mirror |
| Reference timezone | the ORGANIZATION's (`reservations_settings.timezone`, IANA): defines "a day" for the calendar, day-scale placement and DST behavior; engine stays timezone-blind (tz at the edges); boards render org time, not viewer time |
| Path-2 rule set creation | consumer's own command (not a subscriber) |
| Working calendar | in `reservations_settings`, mapped at compute time — never written to planner (deviation from spec §6, aligned with newer dev docs) |
| Drag&drop / draft mode | out of MVP (spec-confirmed); commands + component contract ready |
| Notifications | events + OM notification types with groupKey dedup; no alert-fact entity |
| Doc language/location | English, working copy in this workspace |
| Development location | in the `official-modules` submodule inside the local open-mercato checkout from day 1 (full framework runtime at hand: planner/resources live, OM CI guards) — one package = the module, pure blocks (`/engine`, `/ui/timeline`) live inside it and are deep-importable without activation |

Post-review additions (design review, 2026-07-30): `subject_provider_key`
column (provider routing); `member` dropped from the subject contract
(unreachable); planner softened to `tryResolve` per spec §10 with defined
degradation; adapter expands unavailability rules directly (merged
availability cannot express them); per-kind notification groupKey; duration
is the resize master; timeline endpoint and error-semantics contracts pinned.

Second review round (external maintainer comment on the dual write,
2026-08-03): **planner integration made read-only** — the busy-window mirror,
its `planner_rule_id` column, the sync/reconciliation machinery, and the
RRULE-parser core dependency all removed; reservation busyness is owned by
this module and published via `reservationsBusynessService` + events; the
provider-registry inversion recorded as the post-MVP path back to "one place
answers busy".

SD-51 contract round (2026-08-03, `openspec/specs/reservations-api-contract.md`):
**target made optional** (deviation from §4's NOT NULL, per SD-51): `targetId`
XOR `targetText` — a reservation may name its target free-form without a
target record; **`change-status` command added** to the §8 surface (the §7
status machine needed an API path for `active/done` transitions and the
`done → active` correction; `cancel` stays its alias route); timeline read
envelope additionally carries `offWeekdays`/`holidays` (calendar state for
board background — one fetch instead of two); subjects enumeration exposed as
`GET /api/reservations/subjects` over the §5 provider port (composer picker
needs HTTP, DI port unchanged).

Proposal-alignment round (2026-08-04, this document moved to
`packages/reservations/docs/DESIGN.md`): §4/§8 body aligned with the SD-51
addendum (`target_id`/`target_text` XOR in the table, `note` column,
`change-status` + `GET subjects` + calendar state in the §8 surface);
concurrency semantics named explicitly (§7 — parallel placements both
succeed, same-record edits 409 via optimistic locking); integration coverage
expanded into a definition-of-done table with MVP exit conditions and an
observability/rollout note (§8).
