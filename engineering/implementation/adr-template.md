# NNNN — <Short Decision Title, Imperative>

<!--
Rename this file from `adr-template.md` to `NNNN-short-slug.md` where NNNN is
the next number in `docs/adr/`. Once accepted, this ADR is IMMUTABLE — if the
decision changes, write a new ADR that supersedes this one.

Keep it short. One page of prose is usually the right target. Long ADRs
tend to be unread.
-->

- **Status**: Proposed
- **Date**: YYYY-MM-DD
- **Deciders**: @github-handles
- **Consulted**: @github-handles (optional)
- **Informed**: @github-handles or team channels (optional)
- **Tags**: #scope #area

---

## Context

What problem are we solving? What are the forces acting on us (constraints,
history, external factors)? Why is a decision needed *now*?

Keep this objective — describe the situation, not the preference. If there's
a triggering incident, ticket, or metric, link it.

---

## Decision

In one short paragraph: what did we decide?

Lead with the decision. The rest of the ADR justifies it.

---

## Alternatives considered

Enumerate 2–4 real alternatives, including "do nothing" if it was plausible.
Each gets a short fair hearing — reviewers should be able to see that the
rejected options were given genuine consideration.

### Option A — <name>  (chosen / rejected)

Brief description.

**Pros**
- ...

**Cons**
- ...

### Option B — <name>  (chosen / rejected)

Brief description.

**Pros**
- ...

**Cons**
- ...

### Option C — <name>  (chosen / rejected)

Brief description.

**Pros**
- ...

**Cons**
- ...

---

## Consequences

### Positive
- What we gain (capability, simplification, optionality, compliance).

### Negative
- What we give up or take on (complexity, cost, new dependency, vendor lock).

### Neutral
- Side effects worth noting, new areas to monitor, things to revisit later.

---

## Validation

How will we know whether this decision was right? What evidence would make us
revisit? Examples:

- "If p99 latency exceeds 500ms after rollout, we reconsider."
- "If engineering velocity in this area does not improve within 2 quarters,
  revisit architecture."
- "If tenant onboarding time remains > 2 weeks, the abstraction is wrong."

---

## Rollout plan

How we move from current state to the decided state. Especially important for
architectural changes that require migration.

- Phase 1 — expand (dates, work)
- Phase 2 — migrate
- Phase 3 — contract

Or simply: "This takes effect immediately; new work follows this pattern;
existing code stays as-is." Be explicit.

---

## Threats considered

If this decision changes a trust boundary, data flow, or introduces a new
attack surface: list the threats we considered and the mitigations. Pair with
the AppSec team for non-trivial changes.

---

## References

- Linked issue / RFC / PR
- Competing prior art (blog posts, academic papers, vendor docs)
- Related ADRs in this repo (supersedes / superseded-by / relates-to)

---

<!--
CHANGELOG (appended only when ADR status changes — the decision body never
changes once accepted):

- YYYY-MM-DD: Proposed by @author
- YYYY-MM-DD: Accepted by @deciders
- YYYY-MM-DD: Superseded by ADR-NNNN
-->
