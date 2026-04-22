# The Engineer Handbook

> Your first month at AIMS v2, as a calendar. Day-by-day what to set up, week-by-week what to understand, plus a permanent reference section for the questions you'll have on day 200. This is the companion to [04 — Architecture Tour](04-architecture-tour.md). 04 is the map; this is the trail.
>
> The calendar runs five weeks. An earlier draft compressed this to four; external review correctly flagged that "read 1,100 lines of methodology schema + internalise Prisma RLS + trace bitemporal queries + ship a data-plane PR, all in one week" is fantasy. The current shape spaces the data-plane gauntlet out more honestly, and if you're in week 6 still catching up, you're not behind.

---

## Before you read this

A few ground rules so this handbook is useful rather than demoralising:

- **The calendar is a suggestion, not a schedule.** Some engineers will be shipping to production in week 2; others will spend three weeks on the data-plane mental model before their first meaningful PR. Either is fine. The order matters more than the dates.
- **You are not expected to understand everything at once.** The platform carries real complexity (multi-standard pack model, bitemporal findings, two-layer tenant isolation, ALE encryption, dual-tier API). Internalising it takes weeks. If you feel behind in week 1, you are on track.
- **Ask questions early.** A five-minute conversation on day 3 saves a week of misdirected work on day 10. Every engineer here has been where you are; nobody arrived pre-loaded with this context.
- **Read the doc you're in.** [02 — Worked example](02-worked-example-single-audit.md), [03 — The multi-standard insight](03-the-multi-standard-insight.md), [04 — Architecture tour](04-architecture-tour.md), [06 — Design decisions](06-design-decisions.md). They're written to be read, not skimmed. Set aside the time.

---

## Day 1 — Setup and orient

Goal: have your local environment running, understand what's in the repo, identify your first-PR starter ticket.

### Morning — environment setup (~2 hours)

Run through this in order. Ask for help the moment any step fails — do not spend an afternoon debugging a setup step.

#### Required tools

- **Node.js 22 LTS** — we use `nvm`. Install with:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  nvm install 22
  nvm use 22
  ```
- **pnpm 9+** — our package manager:
  ```bash
  corepack enable
  corepack prepare pnpm@latest --activate
  ```
- **Docker Desktop** (or OrbStack on macOS) — for Testcontainers and local Postgres/Redis
- **PostgreSQL client tools** (`psql`) — for poking at the local database
- **AWS CLI v2** — for KMS access from LocalStack in testing
- **Git** with your SSH key registered to GitHub
- **Your editor of choice** — VS Code, Cursor, JetBrains WebStorm all work; repo includes shared ESLint config and Prettier config

#### Clone and bootstrap

```bash
git clone git@github.com:HarshadBhoi/aims-v2.git
cd aims-v2
pnpm install                    # installs all workspace packages
cp .env.example .env            # local development env vars
docker compose up -d            # starts Postgres + Redis + LocalStack
pnpm db:migrate                 # runs Prisma migrations against local Postgres
pnpm db:seed                    # seeds Oakfield + sample data
pnpm test                       # runs the full test suite
pnpm dev                        # starts the dev server (frontend + API)
```

If all five steps complete without error, you're ready. The dev server runs on `http://localhost:3000`; the API on `http://localhost:4000`; Prisma Studio on `http://localhost:5555`.

#### Authenticate locally

- Navigate to `http://localhost:3000`
- Click "Sign in with development credentials"
- Pick the seed user `priya@oakfield.edu` (Auditor-in-Charge role for the Oakfield engagement)
- You should land on the Oakfield FY27 engagement dashboard

If you can navigate to Oakfield's engagement list and see the seeded finding `2026-001`, your setup is correct.

### Early afternoon — orient to the repo (~90 minutes)

Read these, in order, without writing code:

1. **This handbook** — the sections you're about to encounter. Ten minutes.
2. **[01 — Introduction](01-introduction.md)** — the "why AIMS v2 exists" story. 20-30 minutes.
3. **Repo tour** — run `ls aims-v2-platform/` and read the 50,000-foot folder descriptions in [04 §2](04-architecture-tour.md#2-the-ten-folders-at-50000-feet). 20 minutes.
4. **README files** — every folder has one. Read `data-model/README.md`, `database/README.md`, `api/README.md`, `frontend/README.md` at minimum. 30-40 minutes.
5. **Your CODEOWNERS context** — `cat CODEOWNERS` to see which files route to which reviewers. You'll know who to tag early.

### Late afternoon — poke the running system with a stick (~2 hours)

This is the most important two hours of your first week. Before drowning in abstract concepts (pack taxonomy, semantic cores, bitemporal findings), build a tactile map of what the product actually does. Open the running system, open Chrome DevTools, open Prisma Studio, click every button, break things on purpose, watch the JSON fly.

**Scavenger hunt — complete as many as you can in two hours.** Don't optimise for speed; optimise for "I now know what that concept *looks like* when it's running."

1. **Log in as Priya** (`priya@oakfield.edu`) and find the Oakfield FY27 engagement. What's the engagement's `primaryMethodology`? What `additionalMethodologies` and `regulatoryOverlays` are attached?
2. **Open Prisma Studio** (`http://localhost:5555`) and find the `Engagement` row for Oakfield. Look at the `additionalMethodologies` JSONB column. Now open the `StandardPack` table and find the `IIA_GIAS:2024` pack record. Trace the relationship.
3. **Open Chrome DevTools → Network tab** while navigating to the Findings list. Find the tRPC request for `finding.list`. Look at its response payload — specifically, find the `coreElements` and `standardExtensions` fields in one finding. Screenshot the JSON; that's your mental model of a pack-driven finding.
4. **Find the ALN code** (Assistance Listing Number — Single Audit's `FEDERAL_PROGRAM` field) for Priya's seeded finding `2026-001`. Where does it live in the database? What table, what column, what JSON path?
5. **Intentionally break RLS.** Open `psql` directly against the local Postgres. Query `SELECT * FROM "Finding";` as the `aims_app` role. Notice that you get nothing — RLS blocks cross-tenant reads when `app.current_tenant` isn't set. Now set it: `SET LOCAL app.current_tenant = '<oakfield-tenant-id>';` inside a transaction, and query again. See Oakfield's findings appear. This is the defence-in-depth layer from [ADR-0002](../references/adr/0002-tenant-isolation-two-layer.md) in action.
6. **Trigger the outbox.** Author a new dummy finding in the UI. Immediately query `SELECT * FROM outbox_event ORDER BY created_at DESC LIMIT 5;` in Prisma Studio. You should see a `finding.created` event row. Watch the worker dispatch it (check worker logs in `docker compose logs worker`).
7. **Change a form field.** Open the finding-authoring form in the browser. Open the engagement's attached GAGAS pack file (`data-model/examples/gagas-2024.ts`) and add a made-up new `findingElements` entry with a unique code. Rebuild (`pnpm dev` should hot-reload). Refresh the form. Notice the new field appears, with no code change on the frontend — that's the dynamic form engine reading the pack schema at runtime.

You don't need to finish all seven today. Finishing four is a strong day. Every item in this hunt shows you — *physically* — a concept that the docs will describe abstractly tomorrow. Your brain will remember the Prisma Studio row and the JSON in DevTools long after the prose fades.

### End of day 1 — the checklist

- [ ] Dev server runs locally
- [ ] Tests pass locally
- [ ] You've logged in as Priya and can see Oakfield's engagement
- [ ] You've read 01 and the folder-tour section of 04
- [ ] You've completed at least four items of the scavenger hunt
- [ ] You've introduced yourself in whatever Slack/Discord channel the team uses
- [ ] You have an identified first-PR starter ticket (ask your onboarding buddy)

If you close your laptop with all seven boxes checked, day 1 is a success. If only four or five, also a success — the others will land this week.

---

## Week 1 — The mental model

Goal: internalise the domain shape and the data plane enough that reading any feature's code makes rough sense.

### Monday-Tuesday — read the worked example

- **[02 — Worked example: Oakfield State University FY27 Single Audit](02-worked-example-single-audit.md)** — this is the flagship educational doc. 4-6 hours of focused reading.

Read it slowly. Do not skim. Every terminology note matters. When you hit a "Check your understanding" breakpoint, actually try to answer — don't just read past it. If you can't answer one, that's the signal that the preceding section needs re-reading, not advancing.

Budget a full day. If you finish in half a day and feel like everything made sense, re-read it — it's dense enough that a too-fast first pass will leave gaps.

### Wednesday — read the multi-standard insight

- **[03 — The Multi-Standard Insight](03-the-multi-standard-insight.md)** — the architectural deep-dive on *why* we model standards the way we do. 3-4 hours.

By the end, you should be able to answer:

- What's the difference between a methodology, a control framework, and a regulatory overlay?
- Why is a finding stored with a semantic core plus per-pack extensions, rather than as a flat bag of fields?
- Why are recommendations a separate entity with a many-to-many relationship to findings?
- What's the strictness resolver and what does it compute?

If any of those is fuzzy, find the section and re-read. The rest of the codebase assumes you understand these.

### Thursday — architecture tour

- **[04 — Architecture Tour](04-architecture-tour.md)** — how the concepts from 02 and 03 land in real folder structure. 3-4 hours.

Focus on §3 (the data plane walkthrough — following an Oakfield finding from data-model → database → api → frontend). This is the 80/20. Everything else in 04 you can come back to.

### Friday — first PR

By now you have:

- A working local environment
- An understanding of the domain (02)
- An understanding of the architecture (03, 04)
- A starter ticket

Pick up the starter ticket and ship it. Your first PR should be small — a copy fix, a test addition, a minor UI polish. The point is not the code; the point is going through the full merge-and-deploy cycle so you've exercised:

- Branch creation
- Local dev loop
- Test writing
- Lint + typecheck cleanup
- PR description per our template
- Review response cycle
- Merge + canary deploy
- Post-deploy verification

### End of week 1 — the checklist

- [ ] You've read 02 in full and can explain the three-tier pack taxonomy
- [ ] You've read 03 in full and can explain why findings have per-pack extensions
- [ ] You've read 04 §3 and can trace a finding from UI to database
- [ ] You've shipped your first PR to production
- [ ] You've attended your first standup, design review, or retrospective

---

## Week 2 — The pack model and dynamic forms

Goal: internalise the pack schema end-to-end and understand how the dynamic form engine renders pack-driven fields. Ship a small pack-related PR.

Why this week is pack-focused and not data-plane-deep: a previous version of this handbook tried to pack *both* the pack schema *and* the data-plane depth (RLS, outbox, bitemporal) into Week 2. External review called it "pure fantasy" — the cognitive load was three weeks of reading compressed into five days. It's now split: Week 2 is the pack model, Week 3 is the data-plane depth.

### Monday — standard-pack-schema cover to cover

- `data-model/standard-pack-schema.ts` — the schema that defines what a pack *is*. Read it top to bottom. 2-3 hours.

This is ~1,100 lines of TypeScript types. Dense. Every field has a reason for existing. Read the JSDoc comments; they explain the "why" where the types explain the "what." Keep [05 — Glossary](05-glossary.md) open alongside — unfamiliar terms are defined there.

Try to answer as you go: why is `packType` a discriminator? Why does `findingElements` live here but classifications live separately? Why the `semanticElementMappings` shape?

Most of this schema will feel familiar from your scavenger hunt on day 1 — you already saw the JSONB these types describe. The reading is mapping *types* onto *runtime shapes you've already observed*.

### Tuesday — compare five packs

Open five files side-by-side:

- `data-model/examples/gagas-2024.ts` — US government audit methodology
- `data-model/examples/iia-gias-2024.ts` — internal audit methodology
- `data-model/examples/iso-19011-2018.ts` — ISO management system audit methodology
- `data-model/examples/single-audit-overlay-2024.ts` — regulatory overlay
- `data-model/examples/soc2-2017.ts` — control framework

Focus on:

- How do the methodologies' `findingElements` differ? (GAGAS has 4; IIA has 5; ISO has 3.)
- How do their `semanticElementMappings` map to canonical codes?
- How do their `workflows` phase gates differ?
- How do their classification schemes differ?
- What's structurally different about the overlay (only `additionalFindingElements` + `additionalReports` + `ruleOverrides`)?
- What's structurally different about the control framework (only `controls` + `controlCategories`, no workflow)?

This comparison is the fastest way to internalise the pack model. You're not learning GAGAS or IIA; you're learning the *shape of a pack*, which is portable to every methodology we support. The `packType` discriminator changes which fields are required — this is the three-tier taxonomy from [03](03-the-multi-standard-insight.md) in code.

### Wednesday — the dynamic form engine

Read:

- `frontend/implementation/example-dynamic-form.tsx` — reference implementation
- `packages/validation/pack-schemas/` — the per-pack JSON Schemas consumed by the engine
- [04 §3.4](04-architecture-tour.md#34-at-the-frontend-layer) — the "structural type vs. runtime pack schema" distinction

The key mental move: the engine is pack-driven at runtime. It reads the attached pack's `findingElements`, renders each as the appropriate form control (rich text for text elements, dropdown for enums, etc.), and validates against the pack's JSON Schema on submit. There is no codegen; there is no compile-time inference of pack-specific fields. What the compiler guarantees is the *structural shape* (`coreElements` is a `Record<SemanticElementCode, RichText>`); what the runtime pack schema guarantees is *which specific fields are present for this engagement*.

Exercise: modify a pack to add a new `findingElement`, refresh the finding-authoring page, observe the new field appear without any frontend code change. This is the same exercise from the Day 1 scavenger hunt; now you understand *why* it works.

### Thursday — semantic element dictionary + per-pack mappings

Read:

- `data-model/semantic-element-dictionary.ts` — the canonical element codes (`CRITERIA`, `CONDITION`, `CAUSE`, etc.) and their definitions
- The `semanticElementMappings` field in each of the five example packs you compared on Tuesday
- [03 §6.1](03-the-multi-standard-insight.md#61-findings--semantic-core-with-pack-specific-extensions) — why mappings with `equivalenceStrength` exist

Specific questions to answer:

- Why does GAGAS's `criteria` map to `CRITERIA` with `exact` equivalence, while ISO's `audit_criteria` maps with `close`?
- What does the `close` equivalence actually mean for rendering?
- How does a finding authored under GAGAS render under IIA's vocabulary?

### Friday — first pack-related PR

Pick a pack-scoped starter ticket. Examples:
- Add a new (non-breaking) field to one of the example packs
- Add a new canonical element code to the semantic element dictionary with mappings in at least two packs
- Improve the validation rules in `data-model/VALIDATION.md`
- Extend the dynamic form engine to render a new form-control type

Work through it end-to-end. The review discipline on pack-scoped PRs is: pack immutability invariants (if it's already published, bump the version instead of editing), semantic-mapping consistency, validation rule coverage.

### End of week 2 — the checklist

- [ ] You can read `standard-pack-schema.ts` and explain what each major field does
- [ ] You've compared five example packs and can articulate the structural differences between methodology / overlay / control-framework pack types
- [ ] You understand the dynamic form engine's pack-schema-at-runtime model and can articulate why we don't codegen pack-specific types
- [ ] You can read `semanticElementMappings` and explain how a finding flows from authoring to per-pack rendering
- [ ] You've shipped a pack-related PR

---

## Week 3 — The data plane, depth

Goal: internalise the tenant-isolation two-layer, the outbox pattern, and bitemporal queries. Ship a data-plane PR.

This is the hardest week of onboarding. Bitemporal modeling on top of JSONB on top of RLS on top of a connection-pool discipline is a genuinely hostile learning curve. You are not expected to emerge a master of all three; you are expected to emerge able to read and reason about code in all three.

### Monday — the tenant-isolation extension

Read in order:

- [ADR-0002 — tenant isolation two-layer](../references/adr/0002-tenant-isolation-two-layer.md) — the formal decision record
- `packages/prisma-client/src/extensions/tenant-isolation.ts` — the Prisma Client Extension implementation
- `database/policies/rls-policies.sql` — the RLS policies (the defence-in-depth layer)

The specific things to understand:

- How does the extension read `tenantId` from the authenticated tRPC context?
- How does it inject `WHERE tenantId = $1` into every query?
- What happens if the extension fails — does the RLS layer catch it? (Yes. Write a test that proves it; the exercise is instructive.)
- What's the transaction wrapper that sets `app.current_tenant`, and why is `SET LOCAL` load-bearing?

Connection-pool discipline — critical detail most engineers miss — is summarized in the Gotchas section of this handbook (below). Read that paragraph carefully.

### Tuesday — bitemporal findings

Read in order:

- [04 §3.2 (bitemporal paragraph)](04-architecture-tour.md#32-at-the-database-layer) — the honest scaling-cliff acknowledgement
- `database/PERFORMANCE.md` (when it exists) — the `finding_as_of` materialised view pattern
- `database/schema.prisma` — the bitemporal columns on `Finding` (`validFrom`, `validTo`, `transactionFrom`, `transactionTo`)

The key concepts:

- **Business time** (valid time) — "when is this fact true in the real world"
- **System time** (transaction time) — "when did we record this fact"
- Every update appends a new row, not updates in place; old rows are retained with their `validTo` set
- "What did this finding look like on 2027-12-01?" is answerable via the `finding_as_of` view, not via ad-hoc JSONB scans (which get slow)

This will feel unfamiliar. Bitemporal modeling is not common outside audit / financial / healthcare systems. Allow it to feel weird; the operations become intuitive after a week of exposure.

### Wednesday — the outbox dispatcher

Read in order:

- [04 §3.3 + §8.7](04-architecture-tour.md#87-event-outbox--the-only-durable-happens-before-edge-we-trust) — the pattern explained
- [ADR-0004 — SQS for worker queuing](../references/adr/0004-sqs-for-worker-queuing.md) — why we use SQS, how S3-pointer payloads work
- `database/schema.prisma` — the `outbox_event` table definition
- `api/workers/outbox/dispatcher.ts` — the NestJS worker that reads the outbox and dispatches

The specific things to understand:

- Why is the outbox row written inside the same transaction as the state change?
- How does the dispatcher preserve per-aggregate ordering (FIFO queue + partition key)?
- What happens on retry? On DLQ? On idempotent redelivery (consumer-side idempotency key)?
- How does OpenTelemetry trace context propagate from the request to the worker?

### Thursday — ALE encryption and the `packages/encryption/` module

Read in order:

- [ADR-0001 — ALE replaces pgcrypto](../references/adr/0001-ale-replaces-pgcrypto.md)
- `packages/encryption/src/` — the helper module used by both Fastify and NestJS tiers
- The encryption patterns applied to Finding, User, and attachment fields — `grep -r "ale\.encrypt" src/`

Specific things to understand:

- How does a per-tenant DEK get wrapped/unwrapped via KMS?
- What's deterministic encryption for, and where do we use it?
- What's a blind index, and where do we use it?
- Why is `pgcrypto` explicitly forbidden for queryable fields?

### Friday — first data-plane PR

Pick a data-plane starter ticket. Examples:
- Add a new tenant-scoped table with its own RLS policy (your reviewer will scope it tightly)
- Add a new field to an existing table with appropriate backfill
- Debug and fix a flaky bitemporal test
- Add a new event type to the outbox + worker

The review discipline here is the strictest of your four PRs to date: tenant-safety, RLS coverage, bitemporal correctness, outbox transactional integrity, encryption pattern correctness. Your reviewer is protecting invariants that, if broken, produce data leakage, regulatory violation, or audit-trail tampering. Expect multiple review cycles. That's normal.

### End of week 3 — the checklist

- [ ] You understand the two-layer tenant isolation and can explain why both layers exist
- [ ] You can read bitemporal queries and explain valid-time vs. transaction-time
- [ ] You understand the outbox pattern and can explain the three failure modes it prevents
- [ ] You know why `pgcrypto` is forbidden and what pattern replaces it
- [ ] You've shipped a data-plane PR through a strict review cycle

---

## Week 4 — The service and UI tier

Goal: be able to add tRPC procedures, work across the Fastify request-path and the NestJS worker tier, and build server-rendered pages with interactive clients.

### Monday — tRPC router patterns

Read:

- `api/requests/trpc/routers/engagement.router.ts` — a full example router
- `api/requests/trpc/context.ts` — how authenticated context is built
- `api/requests/trpc/middleware/` — auth, tenant scoping, logging

Then add a simple query procedure to an existing router as an exercise (your reviewer can propose one). The exercise is less about the code and more about running the full loop: Zod schema in `packages/validation/`, procedure in the router, unit test for the schema, integration test against Testcontainers Postgres, frontend consumption from a Server Component.

### Tuesday — Zod schema sharing across tiers

Read:

- `packages/validation/src/` — structure by domain (engagement, finding, recommendation)
- `packages/validation/src/finding.ts` — a representative schema with refinements

The specific pattern: a Zod schema is the single source of truth. The tRPC procedure imports it for input validation. The frontend form imports it for client-side validation via React Hook Form + `zodResolver`. The OpenAPI generator reads it to emit the spec. The snapshot tests verify no unintended breaking changes.

Exercise: add a new field to a schema, observe the compiler errors that propagate to the frontend, fix them. Feel the "end-to-end type safety on structural shape" that [04 §3.4](04-architecture-tour.md#34-at-the-frontend-layer) describes.

### Wednesday — Server Components + tRPC server caller

Read:

- `frontend/apps/web/app/engagements/[id]/page.tsx` — a real Server Component using the tRPC server caller
- The "Server Component vs. Client Component" decision tree in the handbook's Gotchas section (below)

Exercise: build a simple list page (probably your reviewer has one in the backlog) that fetches data via the server caller, renders it server-side, and includes an interactive child (a filter bar) that's a Client Component.

### Thursday — cache invalidation across tiers

Read and experiment:

- The Next.js router cache (`revalidatePath`, `revalidateTag`)
- The tRPC React Query cache (`queryClient.invalidateQueries`, `queryClient.setQueryData`)
- When a mutation happens on the server, which layer of cache do you invalidate? (Usually both, and the Gotchas section below explains when.)

This is the thing that will bite you most often in your first three months. Plan an hour today to break a cache deliberately, observe the stale-UI behaviour, then fix it.

### Friday — first service+UI PR

A feature that spans a new tRPC procedure, Zod schema, Server Component page, and Client Component interactivity, with correct cache invalidation on the mutation path. Your reviewer will propose a scoped one. This is the first PR that exercises the full stack end-to-end; expect review comments on transaction boundaries, error handling, cache behaviour, and observability hooks.

### End of week 4 — the checklist

- [ ] You can add a tRPC procedure with input/output schemas and appropriate middleware
- [ ] You understand how Zod schemas flow from `packages/validation/` to both API and UI
- [ ] You've written a Server Component that fetches via the tRPC server caller
- [ ] You can invalidate both the Next.js router cache and the tRPC React Query cache, and you know when each applies
- [ ] You've shipped a PR that touches both the API and the UI with correct cache behaviour

---

## Week 5 — Operations

Goal: know your way around observability, deployment, and on-call basics. You are not on-call yet (that's a month 2-3 topic), but you need to know the terrain.

### Monday — observability tour

- `devops/OBSERVABILITY.md` — what we log, meter, trace
- Hands-on: navigate Grafana, Sentry, Tempo with an onboarding buddy

Pick a request you've made to the local dev server during this past month, find its trace in Tempo (the local OTel collector surfaces it), walk the spans. Understand: each tRPC procedure is a span; each Prisma query is a span; each outbox dispatch is a span; they all share the same trace ID.

### Tuesday — deployment walkthrough

- `devops/CI-CD.md` + `devops/RELEASE.md` — the pipeline docs
- Hands-on: walk through a real deploy (either a past one's GitHub Actions log, or observing the next one live)

What to notice: the 12-minute CI budget; the OIDC-federated auth to AWS; the Argo Rollouts canary with SLO-gated promotion; the 5-minute observation windows at each traffic increment.

### Wednesday — incident response primer

- `security/INCIDENT-RESPONSE.md` + `devops/RUNBOOKS.md`
- Discussion with the security lead about operational vs. security incidents

You are not on-call yet, but when you are, these runbooks are the bible. Understanding the distinction now — operational incident (API is down) vs. security incident (suspected breach) — is what saves the "what do I do?" panic moment at 3am six months from now.

### Thursday — shadow on-call

Pair with the current on-call engineer for a day. They probably won't get paged (most shifts are quiet), but watching how they handle alerts, triage false positives, and document their decisions is valuable.

If the week is genuinely quiet, they can walk you through historical incidents — read the post-mortems in `references/incidents/` (once we have real ones; for now, the template is in `devops/RUNBOOKS.md`).

### Friday — retrospective

Sit with your onboarding buddy. Go through:

- What clicked in the first month?
- What's still fuzzy?
- What would you have done differently on day 1 if you could?

Your feedback goes back into this handbook. This section literally exists because of feedback from previous hires.

### End of week 5 — the checklist

- [ ] You can navigate Grafana, Sentry, and Tempo and find a trace
- [ ] You understand the deployment pipeline end-to-end
- [ ] You've read the incident-response runbook
- [ ] You've shadowed an on-call shift
- [ ] You've completed four PRs of increasing scope (week 1 starter, week 2 pack, week 3 data-plane, week 4 service+UI)
- [ ] You can explain, to someone newer, any of: the three-tier pack taxonomy; the dynamic form engine; the two-layer tenant isolation; the transactional outbox pattern

If you can check all six boxes, you are no longer new. Month 2 starts with owning features and participating in design reviews as a contributor, not an observer.

---

## Permanent reference cards

These are the questions you'll have on day 200, not just day 2. Bookmark this section.

### Where do I actually write the code?

Lifted and extended from [04 §11](04-architecture-tour.md#11-a-note-for-different-audiences):

| Task | Primary edit | Cascade — also update |
|---|---|---|
| Add a finding element to an existing methodology pack | `data-model/examples/<pack>.ts` — add to `findingElements` with `semanticElementMappings` entry | Bump pack `version`; add validation rule in `data-model/VALIDATION.md`; regenerate seed data if needed; no Prisma migration (JSONB absorbs) |
| Author a new methodology pack | Copy `data-model/examples/iso-19011-2018.ts` as template | Register in pack loader; VALIDATION entry; write one example engagement using it; add cross-standard crosswalk in `references/crosswalks/` |
| Author a new regulatory overlay | Copy `data-model/examples/single-audit-overlay-2024.ts` | Depends-on link to host methodology pack version; additional-elements declared; additional-reports declared; overlay rule overrides |
| Author a new control framework | Copy `data-model/examples/soc2-2017.ts` | `controls[]` with per-control `points_of_focus` + testing guidance + cross-framework mappings; OSCAL compatibility pass |
| Add a new tRPC procedure | `api/requests/trpc/routers/<domain>.router.ts` | Zod input schema in `packages/validation/<domain>.ts`; permission check via middleware; integration test in `api/requests/tests/<domain>/` |
| Add a new REST endpoint (public API) | `api/rest/routes/<domain>.ts` (thin adapter over tRPC) | OpenAPI spec regen (`pnpm openapi:gen`); versioning if breaking |
| Add a new server-rendered page | `frontend/apps/web/app/<route>/page.tsx` as Server Component | Any interactivity in a child `"use client"` Component; i18n strings in `frontend/messages/<locale>/<route>.json`; nav entry |
| Add a new Client Component | `frontend/apps/web/components/<name>.tsx` with `"use client"` directive | Use `@trpc/react-query` for data; Shadcn primitives for UI; design tokens for styling |
| Add a new background job | `api/workers/<job-name>/` — NestJS module | Register with outbox dispatcher OR `@Cron` schedule; runbook entry in `devops/RUNBOOKS.md`; observability hooks |
| Add a new database column | `database/schema.prisma` + `prisma migrate dev` | Update Prisma Client Extension if new table (tenant-scope injection); RLS policy if new tenant-scoped table; backfill script if data exists |
| Add a new webhook event type | Declare in `api/webhooks/events.md`; emit from outbox worker | Event shape registered in OpenAPI spec; webhook-receiver test fixtures updated |
| Add a new permission | `auth/PERMISSIONS.md` — the matrix | Role-to-permission mapping in `auth/roles.ts`; middleware check in the relevant tRPC procedure |
| Add a new encrypted field | Do NOT use `pgcrypto`. Use the ALE helper in `packages/encryption/` | Per-tenant DEK rotation plan; decrypt paths in reporting/export queries |
| Add observability to a hot path | OpenTelemetry spans via `tracer.startActiveSpan` | Structured log at start/end; metric counter/histogram; `traceparent` propagation |

When in doubt: each folder has a `README.md`; the README is the contract. If what you need isn't in any README, you're either in new territory (propose an ADR) or looking in the wrong folder.

### Common gotchas

**"I updated the database but the UI isn't showing the change" — cache invalidation across tiers.**

There are *two* caches between you and the screen: the Next.js router cache (aggressive full-route memoisation; updated data from a Server Component is invisible until the route path is invalidated) and the tRPC React Query cache (Client Components see stale data until the query key is invalidated or refetched). A mutation must invalidate both for the common case:

```ts
// In a Client Component after a mutation succeeds:
await utils.finding.list.invalidate();         // tRPC React Query cache
router.refresh();                               // Next.js router cache for the current route

// In a Server Action or route handler after a mutation:
revalidatePath('/engagements/[id]/findings');   // Next.js route cache
revalidateTag('finding-list');                  // if you've tagged fetches
```

Missing the `router.refresh()` is the single most common "the UI is broken" bug in month 1. When in doubt, call it. The cost of an extra cache refresh is negligible; the cost of a stale UI after a user's save click is a support ticket.

**Tenant context is not set on raw Prisma queries.**

If you write `prisma.$queryRaw`, the Prisma Client Extension does not inject `tenantId`. You must either inject it manually (`` WHERE tenantId = ${ctx.tenantId} ``) or rely solely on the RLS policy. CODEOWNERS routes all raw-SQL PRs to a security reviewer specifically because this is the class of bug most likely to leak cross-tenant. See [ADR-0002](../references/adr/0002-tenant-isolation-two-layer.md).

**Connection-pool discipline — `SET LOCAL` only, GUCs reset on checkout, never `SET`.**

The full rulebook (previously in `database/POOLING.md`, now inlined here because it's daily-use knowledge):

1. When setting `app.current_tenant` for RLS, use `SET LOCAL` (transaction-scoped), never `SET` (session-scoped). `SET` survives into the next transaction on a pooled connection — the classic GUC-leakage bug that produces silent cross-tenant reads.
2. Every transaction acquiring a connection must either `RESET ALL` at the start or trust that the transaction-wrapper already does so (it does; don't bypass the wrapper).
3. The transaction wrapper verifies `app.current_tenant` matches the authenticated tenant claim *before* the first query runs — if the verification fails, the transaction aborts with a fatal error (the pool connection is also discarded to be safe).
4. Connection pools are sized deliberately: request-path pool = 10 per pod, worker-tier pool = 5 per pod, admin-role pool = 2 per pod. Exceeding these suggests a leak, not a scaling need.
5. Never use `session` mode on PgBouncer; we run `transaction` mode specifically to avoid session-level GUC leakage across clients. The connection string enforces this.

Bypassing any of these is a CODEOWNERS-blocked change.

**Pack versions are immutable once published.**

If you need to change a published pack, write a new version (bumping `version` from `"2024"` to `"2024.1"` or `"2025"`). Existing engagements remain pinned to the version they were created against. Editing an already-published pack is a data integrity bug. See [06 §1.6](06-design-decisions.md#16-pack-versioning--engagements-pin-specific-versions).

**Bitemporal finding queries must use `finding_as_of`, not ad-hoc raw SQL.**

If you need to answer "what did this finding look like on date X?", use the `finding_as_of` materialised view, not a raw query over the bitemporal columns. Ad-hoc queries get slow past ~50k findings per engagement; the materialised view has the right indexes. See [04 §3.2](04-architecture-tour.md#32-at-the-database-layer).

**Outbox events must be idempotent on the consumer side.**

The outbox dispatcher is at-least-once. Consumers receiving a webhook or an internal event must tolerate duplicate delivery by carrying an idempotency key (the `event_id` from the outbox row). Ignoring this produces duplicate corrective-action records, duplicate notifications, duplicate billing events.

**Zod schema changes are structural type changes — they propagate.**

If you add a required field to a shared Zod schema, every frontend form and every backend procedure consuming it will fail to compile until you update callers. This is the intended behaviour (end-to-end type safety on structural shape). Plan breaking changes in a sequence: add optional → migrate callers → make required.

**Feature flags expire or get promoted, they don't linger.**

If you ship a feature behind a flag, the flag has an explicit expiration date in the flag registry. Expired flags either graduate to always-on (code deleted, flag removed) or always-off (code deleted, feature killed). A flag still in the registry six months past its expiration is a tech-debt item that blocks further work on that code path.

**Server Component vs. Client Component — a quick decision tree.**

- Rendering static data or tRPC query results and *not* needing interactivity → Server Component (default; no `"use client"`). Fetch via the tRPC server caller.
- Needing `useState`, `useEffect`, event handlers, or real-time interactivity → Client Component. Declare `"use client"` at the top of the file. Fetch via `@trpc/react-query`.
- Both? The outer page is a Server Component; the interactive region is a child Client Component, passed server-fetched data as props (serialisable only — no functions, no class instances).

**Lint errors and type errors are blockers, not warnings.**

CI fails on any TypeScript error or any ESLint error. Disabling a rule for a single file requires a justifying comment; disabling a rule repo-wide requires a PR to `engineering/implementation/eslint.config.js` that is reviewed. We do not bypass.

### How-to recipes

**How to add a new standard pack**

1. Decide which pack type: methodology, control_framework, or regulatory_overlay (use the diagnostic question in [06 §1.1](06-design-decisions.md#11-a-three-tier-pack-taxonomy-methodology--control_framework--regulatory_overlay))
2. Copy the most-similar existing example from `data-model/examples/` as a starting template
3. Fill in the metadata (`code`, `version`, `displayName`, `issuer`, `effectiveDate`, `jurisdiction`)
4. Fill in the content appropriate to the pack type (methodology: `findingElements` + `workflows` + `independenceRules`; control_framework: `controls[]` + `controlCategories[]`; regulatory_overlay: `additionalFindingElements` + `additionalReports` + `ruleOverrides`)
5. Write `semanticElementMappings` that map your pack's element codes to canonical codes
6. Register the pack in `data-model/pack-registry.ts`
7. Add a validation entry in `data-model/VALIDATION.md` if your pack introduces unusual semantics
8. Write a test engagement that attaches the new pack and verifies expected behaviour
9. Submit PR; review will include a domain-expert check

**How to add a new background worker**

1. Decide: scheduled (`@Cron`), queue-consumed (`@Processor` against Redis-backed BullMQ), or outbox-dispatched
2. Create `api/workers/<worker-name>/` as a NestJS module
3. Register the module in `api/workers/app.module.ts`
4. Define the job shape as a Zod schema in `packages/validation/jobs/`
5. Implement the worker with observability hooks (tracer span, structured log, metric counters)
6. Write unit tests (pure logic) and integration tests (against Testcontainers Redis if queue-consumed)
7. Add a runbook entry in `devops/RUNBOOKS.md`: what this worker does, expected latency, alert on failure
8. If the worker writes to external systems, ensure the consumer is idempotent (pass an idempotency key)

**How to add a new webhook event type**

1. Name the event in `noun.verb` form: `finding.created`, `report.issued`, `recommendation.accepted`
2. Declare the event payload schema as Zod in `packages/validation/webhook-events/`
3. Register in `api/webhooks/events.md` — the public event catalog
4. Emit from the appropriate tRPC handler: write an `outbox_event` row with `event_type` set in the same transaction as the state change
5. Add to the OpenAPI spec under the `#/components/webhooks/` path
6. Add a receiver fixture to `tests/webhooks/` for integration tests
7. Notify existing customers via the changelog (webhook additions are non-breaking; schema changes within existing events are breaking)

**How to troubleshoot a failing test locally**

1. Check the exact command CI ran: look at `.github/workflows/ci.yml` for the failing step
2. Reproduce locally with the same command
3. If it fails locally, you have a real bug — debug from stack trace
4. If it passes locally, check: are you using a different Node version? Is your local Docker container state stale (`docker compose down -v && docker compose up -d`)?
5. Check for flaky test patterns: time-dependent assertions, test-order coupling, shared state across tests
6. If you suspect flakiness: run the test 20 times in a row locally (`pnpm vitest --repeat 20 <test-name>`). Intermittent failure confirms flakiness
7. For flaky tests, fix the test, don't mark it `.skip`

**How to roll back a deploy**

1. ArgoCD: navigate to the application, click "Rollback"
2. Pick the previous revision (should be the last successful deploy)
3. Argo Rollouts handles canary traffic shift back automatically
4. After rollback: open an incident ticket documenting what broke, when, what triggered the rollback
5. Debug on the staging environment, not production
6. Do not re-deploy until root cause is identified and fix is tested

**How to recover from a failed Prisma migration (local dev)**

Nearly every engineer hits this: you added a column, the migration crashed partway, `prisma migrate dev` now complains about "drift" because the database is in a half-applied state.

1. **If you haven't committed the broken migration**: `rm -rf prisma/migrations/<your-broken-migration>/` then `pnpm db:reset` (which runs `prisma migrate reset` behind the scenes — drops local DB, reapplies all migrations from scratch, re-seeds Oakfield data). You lose local state; that's usually fine because the seed regenerates it.
2. **If you've committed the broken migration but haven't merged**: fix the migration SQL in-place, then `pnpm db:reset` as above. The fixed migration will apply cleanly to the freshly-reset DB.
3. **If the migration has been merged and is running on someone else's dev DB**: do NOT rewrite the migration. Write a *new* migration that corrects the state (adds a down-migration equivalent, then re-applies the intended change). Migrations in `main` are effectively immutable; they may already be on staging or production.
4. **If your local DB is so drifted you want a clean slate for reasons unrelated to migrations**: `docker compose down -v` (nukes volumes) followed by `docker compose up -d` + `pnpm db:migrate` + `pnpm db:seed` gives you a fresh local DB from scratch in about two minutes.

`prisma migrate reset` vs. raw SQL fixes: prefer `reset` in local dev. Manual SQL against the local DB to "un-drift" things is how you end up with a local state nobody else has and can't reproduce your bug.

**How to add an environment variable**

1. Add the variable to `packages/config/env.ts` — it's a Zod schema that declares every env var with its type, required/optional, and validation rules. The schema is the source of truth; code reads from the typed, validated object, not from `process.env` directly.
2. Add it to `.env.example` with a placeholder value and a comment explaining what it's for. This is how teammates know the new variable exists.
3. Add it to `.env` locally with your real dev value.
4. For staging/production: is it a secret? If yes, add it to AWS Secrets Manager via Terraform in `devops/implementation/terraform/secrets.tf` and reference it via the `external-secrets` operator (don't put it in plain env). If no (e.g., a feature-flag default), add it to the Kubernetes ConfigMap via Terraform.
5. Terraform PR for any infra change goes to @devops-owners.
6. If the env var is a third-party API key, it additionally needs security review: open a ticket in the vendor-onboarding flow (DPA, SCC if applicable, subprocessor-list update per [docs/06 §6.6](06-design-decisions.md)).
7. Rebuild the dev container (`docker compose down && docker compose up -d`) so the new var is picked up. Check the Zod schema rejects missing or malformed values at startup.

**How to add an npm dependency**

1. Decide the scope: is this for one workspace package, or shared across the repo?
2. For a single workspace: `cd packages/<package>` then `pnpm add <dep>`. This adds it to that package's `package.json` only.
3. For repo-wide shared tooling: `pnpm add -w <dep>` at the repo root. Use sparingly; most deps belong to a workspace.
4. Security gate: adding a new dependency triggers Snyk SCA on the next CI run. If Snyk flags a vulnerability above Medium, the PR is blocked. If Snyk flags Medium, you need a justification comment in the PR.
5. Size gate: bundle-size CI gate runs per route; a new dep that inflates any route's bundle past the budget in `frontend/PERFORMANCE.md` blocks the PR. Common solution: dynamic import (`await import(...)`) for deps only needed on specific user actions.
6. Architecture review: if the dep is a framework-scale addition (state-management library, routing library, forms library), it needs an ADR or at minimum a design-doc before the PR.
7. Prefer deps with zero transitive dependencies or a very small tree. Prefer deps actively maintained (commits within 90 days). Flag any dep with >5MB unpacked size; there's usually a smaller alternative.

**How to reproduce a production issue locally**

1. Get the relevant trace ID from Sentry or from the customer's support ticket. Find the full trace in Tempo (production OTel). Note: you'll see metadata (timings, span names, tenant ID, user ID); you will NOT see request payloads or PII. That's by design.
2. Pull a scrubbed snapshot of the relevant tenant's state. Snapshots run nightly; latest-24h is available via `scripts/pull-scrubbed-snapshot.sh <tenant-id>`. The snapshot contains structure (tables, row relationships) with PII replaced by synthetic faker data. Sufficient for reproducing most bugs; insufficient for bugs that are data-content-specific (in which case you escalate to the customer support process, not to you debugging against real data locally).
3. Load the snapshot into your local Postgres via `pnpm db:load-snapshot <snapshot-file>`. This also sets `app.current_tenant` in your local session so the tenant-scoped data is visible.
4. Replay the request. If you have the full request payload from a Sentry event, use `scripts/replay-sentry-event.ts <event-id>` to send an equivalent request to your local dev server.
5. If the bug is environment-specific (production-only, not reproducing locally), escalate. Do NOT SSH into a production pod or query production data directly. Production access is gated through the `devops/RUNBOOKS.md` break-glass flow with audit logging.
6. When you've fixed it, confirm the fix reproduces *the original issue* before claiming victory — sometimes a fix addresses a symptom without the underlying cause.

**How to file a new ADR**

1. Check [references/adr/README.md](../references/adr/README.md) for format and numbering convention
2. Copy `engineering/implementation/adr-template.md` to `references/adr/NNNN-short-slug.md` (next sequential number)
3. Fill in: Status (Proposed), Context, Decision, Alternatives considered (2-4 real alternatives), Consequences (positive/negative/neutral), Validation, Rollout plan, Threats considered (if trust-boundary-affecting), References
4. Submit PR; get at least one reviewer approval from the decision's stakeholders
5. Once merged, update Status to Accepted with the acceptance date in the CHANGELOG at the bottom
6. Cross-link from [docs/06-design-decisions.md](06-design-decisions.md) if it's a top-level decision

### Who to ask about what

Rough CODEOWNERS map by area. When you're stuck, tag someone from the relevant owner group — they'll either answer or route you.

| Area | Owner team | When to tag |
|---|---|---|
| `data-model/` — pack schemas, tenant data model | @data-model-owners | New packs; schema changes; semantic-mapping questions |
| `database/` — Prisma, migrations, RLS policies | @database-owners | Migrations; perf issues; RLS policy changes |
| `api/requests/` — Fastify, tRPC, REST | @api-owners | Procedure design; validation questions; versioning decisions |
| `api/workers/` — NestJS workers | @workers-owners | Scheduled jobs; outbox dispatch; queue integration |
| `frontend/` — Next.js, React Server Components, dynamic form engine | @frontend-owners | UI patterns; state management; dynamic form questions |
| `auth/` — identity, SSO, permissions | @auth-owners, @security | Any auth change; permission-matrix updates |
| `devops/` — Terraform, EKS, ArgoCD, observability | @devops-owners | Infrastructure; deploys; observability setup |
| `security/` — compliance, policy, incident response | @security | Compliance scope; data classification; vulnerability assessment |
| `engineering/` — standards, testing, review discipline | @engineering-principals | Process questions; CI budget issues; convention disputes |
| `docs/` — education docs, glossary | @docs-owners | Content updates; new doc proposals |

If nobody on the list is available, default to your onboarding buddy. If they're not available, default to the on-call engineer (they're paid to be reachable).

### Reading list beyond the docs

External resources that helped people here get oriented. Not required; useful if you want depth in a specific area.

- **Audit domain** — Read one methodology's primary source (GAO's [Yellow Book](https://www.gao.gov/yellowbook) is the friendliest of the major methodologies). 20-30 pages. Even a skim rewards you with context for why our pack schema is shaped the way it is.
- **Multi-tenant SaaS** — Shopify's engineering blog has several posts on RLS + connection pooling realities that influenced [ADR-0002](../references/adr/0002-tenant-isolation-two-layer.md).
- **OpenTelemetry** — the OTel spec is long; the "OpenTelemetry Demystified" posts on the OTel blog are a gentler intro.
- **Prisma + Postgres** — the Prisma docs are excellent; start with the "Best Practices" section.
- **Conventional Commits** — the spec is tiny (one page); read it before your first commit.
- **Diátaxis** — the framework page (diataxis.fr) is short and transforms how you think about documentation.
- **React Server Components** — the Next.js docs on the App Router have the clearest explanation; read "Fetching Data" and "Rendering Strategies."

---

## Cultural expectations

### How we review

- **PRs are conversations, not verdicts.** The reviewer's job is to ask good questions, not to find fault. The author's job is to explain trade-offs, not to defend every line. Disagreements resolve through discussion, not through weight of authority.
- **We review for correctness, clarity, and invariants.** Style is mostly handled by Prettier and ESLint; we don't spend human time on things lint catches. We do spend human time on: does this preserve tenant isolation? Does it preserve the audit log invariants? Is the error handling sensible? Is the test genuinely verifying the behaviour?
- **LGTM is not a rubber stamp — but neither is review theatre.** Approving a PR means you've read it and believe it's correct. Approving without reading is a cultural violation. Equally: pretending to give deep review attention that the PR size makes impossible is its own violation. If a PR is too big to review properly within the review window, the right answer is "this needs splitting," not "looks good to me" on work you haven't engaged with.
- **Small PRs, reviewed fast. Large PRs, reviewed slow.** A 100-line PR gets a same-day review. A 500-line PR gets a two-day review. A 2,000-line PR gets a "please split this" comment on day one, then reviewed in the split form. The 24-hour SLA applies to small-to-medium PRs; large ones take the time they take, and the right pressure is to shrink the PR, not to speed the review.
- **Why size matters specifically:** the Definition of Done below has 9 criteria. If every PR has to satisfy all 9, the transaction cost makes engineers hoard changes into big PRs, which then can't be reviewed properly. DoD applies *proportionally* — see below.

### How we commit

Conventional Commits. The full format:

```
type(scope): short summary in imperative mood

Optional body explaining why (not what — the diff shows what).

Optional footer: Closes #123, BREAKING CHANGE: ..., Refs: ...
```

- **Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`
- **Scopes** (match the feature-first folder layout): `engagement`, `finding`, `recommendation`, `report`, `approval`, `auth`, `api`, `workers`, `database`, `frontend`, `security`, `devops`, `docs`, `deps`, `adr`
- **Examples**:
  - `feat(engagement): add multi-pack attach UI`
  - `fix(finding): correct bitemporal bound on reconstruction query`
  - `refactor(api): move tenant-isolation extension to packages/prisma-client/`
  - `docs(adr): add ADR-0004 on SQS queuing decision`
  - `chore(deps): bump Prisma 5.22 → 5.23`
- **BREAKING CHANGE** footer is required for any PR that changes a Zod schema in a non-backward-compatible way, introduces a new required env var, or changes an external API contract.

Commitlint enforces the format on every commit. The git log is itself documentation — `git log --oneline -- api/` should tell the story of how the API evolved.

### How we document

Diátaxis (tutorial / how-to / reference / explanation). Every doc declares which of the four it is. Content that spans two gets split.

- When you ship a feature, update the relevant reference doc and add a how-to if the feature changes engineering workflow
- When you make an architectural decision, update [docs/06-design-decisions.md](06-design-decisions.md) and write a formal ADR if it's load-bearing
- When you introduce a new concept, check [docs/05-glossary.md](05-glossary.md) — add the entry if it's missing
- When you think "future-me will want to know this," write it down

### Definition of Done — applied proportionally

A feature is not done when the code works. The full DoD has nine items:

1. Code merged and deployed
2. Tests written (unit + integration + E2E where applicable)
3. Docs updated (relevant folder README + ADR if architectural + glossary if new concept)
4. Observability added (logs + metrics + traces on new endpoints)
5. Security reviewed (SAST clean + permissions checked + threat model updated if applicable)
6. Accessibility checked (WCAG 2.1 AA for UI features)
7. i18n applied (all user-facing strings externalised)
8. Code reviewed and approved
9. Rollback plan documented

**But not every PR needs all nine.** Applied literally to every PR, this list would incentivise PR-hoarding (batch ten small changes into one 2,000-line PR to pay the DoD tax once) and rubber-stamp reviews (nobody can deeply review a 2,000-line PR within a day). Both are failure modes.

The honest rule: DoD scales with PR scope.

- **Starter PR / copy fix / small bug fix / typo**: items 1 (merged) and 8 (reviewed) only. Items 2-7 and 9 are usually not applicable. Ship it.
- **Single-purpose small PR (new tRPC query, new UI field, small refactor)**: items 1, 2, 8, and whichever of 3-7/9 the change actually touches. Don't add observability hooks to a PR that didn't change any observable behaviour; don't write an ADR for a change that doesn't shift architecture.
- **Feature-scale PR (new capability, new page, new worker)**: all 9 items apply. This is the DoD the 9-item list was designed for.

The rule is captured in a PR-template checkbox set: "I've considered DoD items N, M, O and they don't apply because [reason]." Reviewers see the reasoning, not just the check marks.

If you're unsure whether an item applies, ask your reviewer early — before the PR grows. "Does this touch i18n?" is a 30-second answer before you write the code and a 30-minute cleanup after.

### What we value, and where the values don't apply

Three values. Each has a carve-out, because values without carve-outs turn into dysfunction.

**Specificity.** "The query is slow" is not actionable. "The `engagement.list` tRPC procedure's p99 is 1.2s at 100 rps, driven by the bitemporal finding join" is actionable. Specificity in bug reports, in design proposals, in code review, in retrospectives. Vague wins no arguments here.

*Carve-out*: specificity is required for **closed-form claims** — design proposals, PR descriptions, retrospective root-cause analyses, architectural arguments. It is not required for **exploratory questions** when you're stuck. "I think the outbox worker is failing, how do I check?" is a perfectly acceptable question without p99 statistics attached. The value "ask questions early" supersedes the value "specificity" in the moment of being stuck. You gather the specifics *after* you have help orienting, not before.

**Honesty.** We describe trade-offs, not benefits. We flag scaling cliffs (like bitemporal-on-JSONB) rather than gloss. We say "I don't know" rather than "probably fine." We write [domain review notes](04-architecture-tour.md#12-domain-review-notes) that credit external reviewers for catching our mistakes. Nobody here gets punished for being wrong in good faith; people do get pushed back on for being wrong with false confidence.

*Carve-out*: honesty is the norm; it is not a license for casual pessimism. "This will never work" without an argument is not honest, it's a vibe. "I'm skeptical this will work because X and Y, have we considered Z?" is honest.

**Evidence.** A design claim without evidence is a hunch. "X is faster than Y" requires a benchmark. "Users want Z" requires a user interview, a support ticket, or a data point. "We should use framework W" requires a comparison that names what W gets us that the alternatives don't. Hunches are fine as inputs; evidence is required as justification.

*Carve-out*: evidence is required for **justifying decisions**, especially decisions that cost engineering time. It is not required for **asking questions** or **reporting anomalies**. "I noticed the UI is blue, is that intentional?" does not need a design-system citation; "let's change the UI to green" does.

### Asking questions — explicitly encouraged

A new engineer's five-minute question on day 3 saves a week of misdirected work on day 10. Every engineer here has been where you are; nobody arrived pre-loaded with the domain.

The above values — specificity, evidence — apply to closed-form claims. They do *not* apply to exploratory questions. If you are stuck, or confused, or uncertain, the social expectation is that you ask, and the corresponding expectation on the person you ask is that they answer generously without demanding you prove you've done ten hours of preparatory research first.

If you ever feel the culture here is punishing question-asking, flag it to your onboarding buddy or to engineering leadership. That's a cultural-drift signal we take seriously.

---

## Closing note

You'll encounter parts of this system that seem over-engineered for current scale. Some of them are — we err toward getting the hard decisions right early, even when the scale argument is premature. The tenant-isolation two-layer, the ALE encryption, the bitemporal findings, the transactional outbox: all of these cost more than their minimum-viable alternatives. All of them also make the trajectory to serious scale survivable.

Other parts will seem under-engineered. Some of them are — we don't have full-text search yet, we don't have a visual finding-linkage diagram, we don't have real-time collaborative editing of findings. Those are deliberate omissions; they'd be real work to build well and the first-order product works without them. If you think a missing feature should exist, make the case.

The platform will be better in three months because of what you build. The handbook will be better because of what you feed back into it. Ask questions early, write down what you learn, leave the codebase a little cleaner than you found it.

Welcome to the team.

---

## Appendix — Domain review notes

This handbook went through external review (Google Gemini, April 2026) in the same program that reviewed 02, 03, 04, and 06. The review was framed specifically as "an engineering manager who has onboarded dozens of engineers" reading with a skeptic's eye. The feedback surfaced four substantive categories of issue; all were incorporated. Recording the feedback here so future editors understand why specific sections read the way they do.

### Round 1 — calendar realism

- **Week 2 was "pure fantasy."** The original draft asked an engineer to read 1,100 lines of methodology schema, internalise the Prisma RLS extension + connection-pool mechanics, trace the NestJS outbox worker, and ship a strictly-reviewed data-plane PR — all in one week. Fix: the handbook now runs five weeks instead of four. Week 2 is pack schema + dynamic forms only. Week 3 is the data-plane gauntlet (tenant isolation, bitemporal, outbox, ALE). Week 4 is service+UI tier. Week 5 is operations. The intro note at the top acknowledges the extension explicitly.
- **Day 1 was too theory-heavy.** 16-20 hours of reading before writing any code, with a starter PR not landing until Friday, was described as "incredibly dry — without physical context, the abstract concepts won't stick." Fix: added a late-afternoon Day 1 "poke the running system with a stick" scavenger hunt — seven concrete exploration tasks (log in as Priya, open Prisma Studio, inspect tRPC payloads in DevTools, intentionally break RLS, trigger the outbox, modify a pack field to see the dynamic form engine respond). Builds tactile understanding *before* the docs arrive.

### Round 1 — missing reference-card content

The reviewer flagged five gaps in the gotchas / how-to recipes — all for problems that block engineers on a Tuesday afternoon and were missing from the original draft:

- **Cache invalidation across Next.js router + tRPC React Query** — "I updated the database but the UI isn't showing the change" is the single most common month-1 bug. New gotcha with explicit `revalidatePath` / `router.refresh()` / `utils.X.invalidate()` guidance.
- **Recovering from a failed Prisma migration** — new recipe covering `prisma migrate reset`, when to rewrite migrations vs. when to write correcting ones, and the clean-slate procedure.
- **Adding an environment variable** — new recipe covering the Zod schema at `packages/config/env.ts`, `.env.example` update, Terraform path for staging/production, and security review if the var is a third-party API key.
- **Adding an npm dependency** — new recipe covering workspace-scope vs. repo-root (`pnpm add -w`), Snyk SCA gate, bundle-size gate, architecture review for framework-scale additions.
- **Reproducing production issues locally** — new recipe covering scrubbed snapshots (`scripts/pull-scrubbed-snapshot.sh`), Sentry event replay, when to escalate rather than SSH into prod.

### Round 1 — cultural dysfunction traps

The reviewer correctly flagged three places where the original draft's norms, taken literally, produced the opposite of what they claimed to value:

- **9-item Definition of Done applied to every PR → PR hoarding.** Fix: DoD now documented as applying *proportionally* — starter PR needs items 1 and 8 only, feature-scale PR needs all 9. PR template includes a checkbox-with-reasoning mechanism so reviewers see the author's DoD scoping.
- **24-hour review SLA + large PRs → rubber-stamp reviews.** Fix: "Small PRs, reviewed fast. Large PRs, reviewed slow." The SLA applies to small-to-medium PRs; large ones take the time they take, and the pressure should shrink the PR, not speed the review. "Review theatre" explicitly called out as its own violation.
- **"Specificity and evidence required" values conflicted with "ask questions early" encouragement.** Fix: each value now has an explicit carve-out. Specificity and evidence are required for *closed-form claims* (design docs, PR descriptions, retrospective analyses), not for *exploratory questions when stuck*. A new "Asking questions — explicitly encouraged" subsection makes the carve-out visible and invites engineers to flag it if the culture drifts.

### Round 1 — cross-reference consolidation

The reviewer flagged that by Thursday of Week 2, a new engineer had 15 markdown tabs open and had lost the thread. Fix: the connection-pool discipline rules (previously at `database/POOLING.md`) are now inlined into the Gotchas section — this is daily-use knowledge; clicking out for it is friction. The commit-message format (previously linking to `engineering/CODE-STANDARDS.md`) is similarly inlined with full examples. The principle going forward: daily-use reference content lives inline in the handbook; deep reference content lives in its origin folder with a link.

### Round 1 — what the reviewer would do differently as a new hire

The reviewer's most valuable feedback was an "I would instinctively deviate from your Monday-Thursday plan" observation. The observation was that an engineer would naturally want to explore the running system before reading docs about it. This was the motivation for the Day 1 scavenger hunt — turn the instinctive deviation into the planned path.

### Round 2 — review loop closed

R1 revisions went back to the same reviewer for a second pass in April 2026. R2 returned no new action items and explicitly endorsed every substantive change: the Day 1 scavenger hunt ("anchors everything"), the 5-week calendar with Week 3 framed as "a genuinely hostile learning curve" ("sets the right psychological expectation"), the cache-invalidation gotcha with explicit code ("will save three support tickets a month"), the inlined connection-pool discipline, the Prisma migration recovery recipe, the scrubbed-snapshot prod-reproduction pattern, and all three cultural carve-outs (proportional DoD, small-PRs-reviewed-fast / large-PRs-reviewed-slow, values that don't apply to exploratory questions). Reviewer summary: "honest, protective, rigorous, and empathetic to the reality of learning a complex system." Review loop on 07 closed at 2026-04-20.

---

*Last reviewed: 2026-04-20. Feedback from new hires is actively incorporated — if a section was confusing or missing, tell your onboarding buddy and we'll edit.*
