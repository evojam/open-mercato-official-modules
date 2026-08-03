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
