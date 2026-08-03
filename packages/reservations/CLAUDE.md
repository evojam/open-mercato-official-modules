# @open-mercato/reservations — implementer rules

## Purity boundary (non-negotiable)

- Nothing under `src/engine/` or `src/ui/timeline/` may import
  `@open-mercato/*` runtime, ORM (MikroORM), or Node-only APIs
  (`node:*`, `fs`, `path`, …). These blocks must bundle to the browser;
  one server-only import inside them is a review-blocking bug.
- `src/modules/**` imports FROM the pure blocks — never the reverse.
- The engine is pure functions: no DI, no throwing, no I/O.

## Design document

- Architecture contract: `reservations/DESIGN.md` in the working workspace
  (SiteDispatch side). See §3 (architecture boundary) for the rationale
  behind the purity rule.
- Once the upstream-facing spec exists under `.ai/specs/`, it supersedes
  this pointer for contribution scope.

## Development workflow (internal to the evojam team)

> Remove this section before the final upstream PR.

### Branching

- The integration branch **`feat/reservations` already exists** on the fork
  (`evojam/open-mercato-official-modules`), cut from `om/develop`. Do NOT
  create a new one.
- All work on this module happens on sub-branches cut from
  `feat/reservations` (convention: `feat/reservations-<task>`, e.g.
  `feat/reservations-plan1-engine`).
- PRs from sub-branches target **`feat/reservations` on the fork** (remote
  `evojam`) — internal review, upstream is not involved.
- The PR to the main repo (`open-mercato/official-modules`, target `develop`)
  happens ONLY at the end, when the module functionality is complete — one PR
  with the whole module.

### Remotes

- `evojam` = fork (push here)
- `om` = open-mercato/official-modules (fetch/rebase-only — never push)
- Keep fresh: `git fetch om && git rebase om/develop` on the integration
  branch.

### Full process

`reservations/DEVELOPMENT.md` in the evojam working workspace (outside this
repo) — repo topology, dev loop, testing routes, contribution rules.
