# Product Specifications

> The product-spec half of AIMS v2's source of truth. Where [`docs/`](../docs/) and [`references/adr/`](../references/adr/) answer *how we build this and why*, this folder answers *what exactly does it do, for whom, under what rules*.

---

## Why this folder exists

By April 2026 the architecture phase of AIMS v2 was complete: seven ADRs covering the load-bearing decisions, seven education docs through external review cycles, the implementation folders reconciled with the ADRs. Engineers reading those materials could describe how the system was built and why specific trade-offs were made.

They could not answer: what user stories does this product actually deliver? What are the acceptance criteria for finding authoring? What's the full table of rules the strictness resolver applies? Which API endpoints exist? What UX flow happens when Priya clicks "Submit for Review"?

Those questions need their own source of truth. This folder is it.

---

## How this relates to the other sources of truth

Three artifact types in the repo, each with a distinct audience and purpose:

| Folder | What it contains | Primary audience | Canonical for |
|---|---|---|---|
| [`docs/`](../docs/) | Architecture narratives — introduction, worked example, multi-standard insight, architecture tour, glossary, design decisions, engineer handbook | Engineers learning the system | Architectural mental model |
| [`references/adr/`](../references/adr/) | Formal Architecture Decision Records — Context / Alternatives / Consequences / Threats per decision | Engineers implementing or revisiting decisions | Architectural decisions (immutable) |
| `product/` (this folder) | Product specs — vision, personas, features, business rules, API catalog, UX flows | Product, engineering, QA, design | Product behaviour (what the software does) |

**Drift rule**: if the product spec and the architecture disagree, flag it. Usually the product spec is behind the architecture (architecture decisions shape what's buildable); occasionally the product spec will reveal that an architectural assumption doesn't fit the real feature set and an ADR needs revision. Either direction is a legitimate outcome.

---

## Structure

```
product/
├── README.md                          ← You are here
├── 01-product-vision.md               ← What AIMS v2 is as a product
├── 02-personas.md                     ← Who uses it — the Oakfield cast + non-Oakfield roles
├── 03-feature-inventory.md            ← The full product surface, organised by module
├── 04-mvp-scope.md                    ← What ships first; what's explicitly out (Phase 2)
├── 05-roadmap.md                      ← Phased delivery MVP → v2.1 → v2.2 (Phase 2)
│
├── features/                          ← Deep feature specs (Phase 4)
│   ├── engagement-management.md
│   ├── finding-authoring.md
│   ├── approval-workflows.md
│   ├── report-generation.md
│   └── ... (one per feature area)
│
├── rules/                             ← The tabular rulebook (Phase 3)
│   ├── strictness-resolver-rules.md
│   ├── classification-mappings.md
│   ├── workflow-state-machines.md
│   ├── approval-chain-rules.md
│   ├── independence-rules.md
│   └── cpe-rules.md
│
├── api-catalog.md                     ← Complete tRPC + REST inventory (Phase 5)
│
└── ux/                                ← User journeys + interaction specs (Phase 6)
    └── ... (one per feature area)
```

---

## Phasing

This folder is built in six phases, each a natural session boundary:

1. **Phase 1 — Framing** (this session): README + vision + personas + feature inventory. Breadth-first survey; scaffolding before depth.
2. **Phase 2 — MVP scope + roadmap**: strategic cuts. What ships first, what's deferred, dependencies.
3. **Phase 3 — Business rules**: the tabular rulebook. Strictness resolver per compliance dimension, workflow state machines per pack, approval chains per engagement type, classification mappings, independence rules, CPE rules.
4. **Phase 4 — Deep feature specs for MVP features**: user stories in Given-When-Then form, acceptance criteria, edge cases, data-model touch points, API endpoints, observability expectations. Only MVP features get deep treatment; post-MVP gets sketches.
5. **Phase 5 — API catalog**: complete inventory of tRPC procedures + REST endpoints with Zod schemas, permissions, idempotency behaviour, error codes, example payloads.
6. **Phase 6 — UX flows**: per-feature interaction specs. Not full wireframes (those come with a designer); enough specification that an engineer can build the behaviour correctly before pixel-perfect mockups exist.

Total: 10–14 sessions at the cadence the architecture work ran.

---

## Reading paths

**If you're an engineer about to build a feature**: start with [`03-feature-inventory.md`](03-feature-inventory.md) to locate your feature in the surface, then the relevant [`features/<your-feature>.md`](features/) for user stories and acceptance criteria, then the relevant [`rules/`](rules/) files for the business logic. [`api-catalog.md`](api-catalog.md) for the endpoint contracts.

**If you're in product or design**: [`01-product-vision.md`](01-product-vision.md) first for framing, [`02-personas.md`](02-personas.md) for the audience, [`03-feature-inventory.md`](03-feature-inventory.md) for the surface, then [`04-mvp-scope.md`](04-mvp-scope.md) for what's current vs. later.

**If you're doing a security or compliance review**: [`02-personas.md`](02-personas.md) for roles, [`03-feature-inventory.md`](03-feature-inventory.md) for the surface, then the [`rules/`](rules/) files — particularly [`independence-rules.md`](rules/independence-rules.md) and the compliance-implication columns of other rule tables.

**If you're an investor or board member**: [`01-product-vision.md`](01-product-vision.md) and [`05-roadmap.md`](05-roadmap.md) are the most useful. [`03-feature-inventory.md`](03-feature-inventory.md) as supporting evidence of scope.

---

## Writing conventions

Same voice as [`docs/`](../docs/) — clear prose, concrete detail, honest trade-offs, no marketing speak. Same cross-reference discipline: every claim links to the doc or ADR where its basis lives.

- User stories in **Given-When-Then** form (Gherkin-compatible)
- Acceptance criteria as bulleted, testable, observable statements
- Edge cases enumerated explicitly, not implied
- When a feature has compliance implications, the compliance framework + control is cited inline
- When a rule has exceptions, the exception is documented, not hand-waved

---

## Status

- **Phase 1 — Framing**: in progress (2026-04-21)
- Phases 2–6: pending

---

*Last reviewed: 2026-04-21.*
