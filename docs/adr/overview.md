# Architecture Decision Records

This folder captures architecture decisions that future contributors should preserve unless a newer ADR supersedes them.

ADRs in this repository should describe the checked-in system, not broad product research or future-state wishes. If a decision includes a future direction, label it clearly as a TODO or follow-up.

## How To Read This Folder

Start with [ADR 000](system-design.md) for the current system boundary. Then read the domain ADRs for the area you are changing.

ADRs are intentionally narrower than [../architecture.md](../architecture.md):

- `docs/architecture.md` explains how the current code fits together.
- `docs/adr/*.md` records decisions that should shape future changes.
- `AGENTS.md` turns those decisions into day-to-day coding guidance.

## Current ADRs

| Number | Area | Status | Decision |
| --- | --- | --- | --- |
| [ADR 000](system-design.md) | System design | Accepted | MetricMind is a modular Next.js app with server-side domain services and InsForge/Postgres as the application data platform. |
| [ADR 001](semantic-layer.md) | Semantic layer | Accepted | AI and UI analytics requests resolve to `SemanticQuery` JSON, then pass through the semantic validator/compiler before SQL execution. |
| [ADR 002](data-source.md) | Data sources | Accepted | Data source ingestion, profiling, sync, and semantic-model creation live in server-side services and repositories, with the UI calling actions or route handlers. |

## Organization Rules

- Number foundational decisions first, then domain decisions.
- Keep filenames stable after linking them from docs or PRs.
- Prefer one decision per ADR. Split unrelated decisions into separate files.
- Put implementation details in `Current Implementation`; put future work in `Open Questions` or `Non-Goals`.
- Cross-link related ADRs instead of repeating long sections.

## ADR Standards

When adding or updating an ADR:

- Link to the code paths and migrations that implement the decision.
- Separate current implementation from future direction.
- Use `TODO: verify` instead of guessing about deployment, encryption, external connectors, or hosted environment behavior.
- Keep examples aligned with current TypeScript types and SQL migrations.
- Do not include secret values, private endpoint details, or unverified vendor claims.
- Use this section order unless there is a strong reason not to:
  `Status`, `Context`, `Decision`, `Current Implementation`, `Consequences`, `Safe-Change Guidelines`, `Related ADRs`, `Open Questions`.

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
