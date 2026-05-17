# Architecture Decision Records

This folder captures architecture decisions that future contributors should preserve unless a newer ADR supersedes them.

ADRs in this repository should describe the checked-in system, not broad product research or future-state wishes. If a decision includes a future direction, label it clearly as a TODO or follow-up.

## Current ADRs

| ADR | Status | Decision |
| --- | --- | --- |
| [ADR 001: Govern Analytics Through SemanticQuery Compilation](semantic-layer.md) | Accepted | AI and UI analytics requests should resolve to `SemanticQuery` JSON, then pass through the semantic validator/compiler before SQL execution. |
| [ADR 002: Manage Data Sources Through Server-Side Lifecycle Services](data-source.md) | Accepted | Data source ingestion, profiling, sync, and semantic-model creation should live in server-side services and repositories, with the UI calling actions or route handlers. |

## ADR Standards

When adding or updating an ADR:

- Link to the code paths and migrations that implement the decision.
- Separate current implementation from future direction.
- Use `TODO: verify` instead of guessing about deployment, encryption, external connectors, or hosted environment behavior.
- Keep examples aligned with current TypeScript types and SQL migrations.
- Do not include secret values, private endpoint details, or unverified vendor claims.

Useful supporting docs:

- [Architecture](../architecture.md)
- [Development](../development.md)
- [Security](../security.md)
- [Agent workflow](../agent-workflow.md)

## Status Values

- `Proposed`: documented direction that is not yet committed as the repository pattern.
- `Accepted`: current repository pattern; follow it for related work.
- `Superseded`: kept for history, replaced by a newer ADR.
- `Deprecated`: still present in code but should not be extended.
