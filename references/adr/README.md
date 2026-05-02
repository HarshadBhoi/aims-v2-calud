# Architecture Decision Records

This folder holds the canonical, immutable record of load-bearing architectural decisions for AIMS v2. ADRs are where an engineer working in the repo in 2027 goes when they grep for `pgcrypto` or `RLS` or `NestJS` and wants to know *why* the codebase looks the way it does.

## What lives here

One ADR per decision, numbered sequentially, using the structure in [`engineering/implementation/adr-template.md`](../../engineering/implementation/adr-template.md). Each ADR covers:

- **Context** — what problem forced the decision
- **Decision** — what we chose, in one paragraph
- **Alternatives considered** — the options we rejected and why
- **Consequences** — what we gain, what we give up, what we must monitor
- **Validation** — how we'll know if the decision was wrong
- **Rollout plan** — how we move from current state to decided state
- **Threats considered** — if it changes a trust boundary
- **References** — code, related ADRs, external sources

## Immutability

Once an ADR is **Accepted**, the decision body does not change. If the decision turns out wrong, or circumstances force a new choice, we write a *new* ADR that **Supersedes** the old one. The old ADR is marked `Superseded by ADR-NNNN` in its status field but its content stays as-written. The record is cumulative, not revisionist.

Only the `CHANGELOG` block at the bottom of an ADR changes over time — it records status transitions (Proposed → Accepted → Superseded) and dates.

## Relationship to `docs/06-design-decisions.md`

The narrative decision log in [`docs/06-design-decisions.md`](../../docs/06-design-decisions.md) (pending) tells the *story* of these decisions for a reader learning the system. This folder is the *canonical artifact*: structured, individually addressable, grep-friendly, immutable. They complement each other — 06 is for humans orienting; this folder is for engineers acting.

## Index

| ADR | Title | Status | Date | Tags |
|---|---|---|---|---|
| [0001](0001-ale-replaces-pgcrypto.md) | Application-Layer Encryption replaces `pgcrypto` for field-level encryption | Accepted | 2026-04-20 | #security #database #encryption |
| [0002](0002-tenant-isolation-two-layer.md) | Tenant isolation — application-layer filter primary, RLS defence-in-depth | Accepted | 2026-04-20 | #security #multi-tenancy #database |
| [0003](0003-nestjs-scoped-to-workers.md) | NestJS scoped to worker tier; Fastify + tRPC on request path | Accepted | 2026-04-20 | #api #runtime #workers |
| [0004](0004-sqs-for-worker-queuing.md) | AWS SQS for all worker-tier queuing, not Redis/BullMQ | Accepted | 2026-04-20 | #api #workers #queuing #infrastructure |
| [0005](0005-session-revocation-hybrid.md) | Session revocation — short-TTL JWT + targeted Redis blocklist | Accepted | 2026-04-20 | #auth #security #compliance |
| [0006](0006-regional-deployment-silos.md) | Regional deployment silos for data residency | Accepted | 2026-04-20 | #infrastructure #compliance #multi-tenancy #data-residency |
| [0007](0007-api-versioning-hybrid.md) | API versioning — URL-based majors + dated header minors, tRPC unversioned | Accepted | 2026-04-20 | #api #versioning #integrations |
| [0008](0008-control-matrix-as-separate-model.md) | Control Matrix (PRCM) as a separate model upstream of Audit Tests | Accepted | 2026-04-28 | #database #data-model #internal-audit #sox #fieldwork |
| [0009](0009-risk-assessment-history-table.md) | Risk Assessment as a per-fiscal-year history table | Accepted | 2026-04-28 | #database #data-model #risk #internal-audit #planning |
| [0010](0010-canonical-finding-storage-shape.md) | Findings store element values keyed by canonical semantic codes, normalized at write time | Proposed | 2026-05-01 | #data-model #multi-standard #api #encryption |
| [0011](0011-engagement-strictness-persistence.md) | EngagementStrictness as a separate RLS-bound table, idempotently rewritten on resolve | Proposed | 2026-05-01 | #data-model #multi-standard #database #rls |
| [0012](0012-compliance-statement-snapshot-at-signoff.md) | Compliance statement snapshotted at sign-off; live for drafts | Proposed | 2026-05-02 | #data-model #multi-standard #legal #api |

## Numbering convention

Four-digit zero-padded (`0001`, `0002`, …, `9999`). Never reuse a number, even if an ADR is superseded. Slug after the number is a short imperative: `0004-move-to-edge-functions.md`, not `0004-thoughts-on-edge.md`.

## When to write an ADR

Write an ADR when a decision:

- Changes a trust boundary or data flow
- Introduces a new framework, runtime, or major dependency
- Reverses or supersedes a previous architectural decision
- Will be asked about more than once in the next two years
- Affects how code is organized across the repo

*Don't* write an ADR for: picking a utility library, choosing a lint rule, naming a variable, a bug fix. Those live in commits, READMEs, or `engineering/CODE-STANDARDS.md`.

When in doubt: write one. An unwritten ADR is a decision without a record, and decisions without records get relitigated.
