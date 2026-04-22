# AIMS v2 — Documentation

> Consolidated, audience-scoped documentation for AIMS v2. If you want to understand what we're building, why, and how the pieces fit together — you are in the right folder.

---

## What this folder is

This folder is the **educational** layer of the AIMS v2 project. It is meant to be **read**, not consulted.

Every other folder in the repo is reference material: `auth/` describes the authentication subsystem in operational detail, `frontend/` describes component patterns, and so on. Those folders answer *"how does this thing work?"* for someone already oriented.

This folder answers the earlier questions:

- *What is AIMS v2 and why does it exist?*
- *What's the one architectural idea that makes everything else make sense?*
- *How do the ten reference folders fit together?*
- *What does a real engagement look like end-to-end — in terms I can understand?*
- *What do all the terms mean?*
- *Why did we pick A over B?*
- *If I'm new to this project, what do I read first?*

If you find yourself lost in a reference folder, you probably landed there before reading here. Come back.

---

## What this folder is *not*

- **Not API documentation.** That's generated from the tRPC router + OpenAPI spec in `api/`.
- **Not runbooks.** Those live in `devops/RUNBOOKS.md` + `security/implementation/runbooks/`.
- **Not marketing.** We describe trade-offs honestly, including where we're weaker than the competition and where we've changed our minds.
- **Not a sales deck.** Concrete. Prose. Real numbers. Real citations.
- **Not frozen.** Every doc carries a last-reviewed date. Decisions change; we update the docs to match.

---

## The files

| # | File | Purpose | Best for |
|---|---|---|---|
| — | [README.md](README.md) | This file — index + reading paths | Everyone, first |
| 01 | [01-introduction.md](01-introduction.md) | Why AIMS v2 exists; the problem + the bet | Anyone new to the project |
| 02 | [02-worked-example-single-audit.md](02-worked-example-single-audit.md) | End-to-end walkthrough of a real engagement — every term anchored in context | Anyone who wants the terminology to click |
| 03 | [03-the-multi-standard-insight.md](03-the-multi-standard-insight.md) | Deep-dive on the central architectural decision | Engineers, advisors, investors assessing the moat |
| 04 | [04-architecture-tour.md](04-architecture-tour.md) | Guided walk through all ten reference folders | Engineers at Week 1 |
| 05 | [05-glossary.md](05-glossary.md) | Every term defined; domain + internal + SaaS | Reference; bookmarked, not read linearly |
| 06 | [06-design-decisions.md](06-design-decisions.md) | ADR log of major choices + research corrections | Future-you when you forget why we did X |
| 07 | [07-handbook-for-engineers.md](07-handbook-for-engineers.md) | First-30-days onboarding guide | New engineers joining the team |

---

## Reading paths

The docs above are written to stand alone, but each role benefits from a specific sequence. Pick the one that matches you.

### Path 1 — Engineer, Day 1 (~30 min)

You've just been told to look at the AIMS v2 repo. You've never seen this project before. You want the big picture.

1. **[01 — Introduction](01-introduction.md)** — what this thing is and why. 15 min.
2. **[02 — Worked example](02-worked-example-single-audit.md)** *(first half, through §8)* — a real engagement, start-to-finish. Lets every term click. 20 min for the first half.

That's it for Day 1. Close your laptop. Tomorrow, continue.

### Path 2 — Engineer, Week 1 (~3 hours cumulative)

You're ramping up. You're going to touch code in a specific area but first you need to know the shape of the system.

1. **Day 1 reading** (above) — 30 min.
2. **[03 — The multi-standard insight](03-the-multi-standard-insight.md)** — why the architecture looks the way it does. 45 min. Non-negotiable; the rest of the system makes no sense without this.
3. **[04 — Architecture tour](04-architecture-tour.md)** — 45 min guided walk through the ten reference folders. You won't remember all of it; that's fine.
4. **[05 — Glossary](05-glossary.md)** — skim the *False-friend warnings* section. Bookmark the rest. 15 min.
5. **[07 — Handbook for engineers](07-handbook-for-engineers.md)** — what to do this month. 30 min.
6. **README of your area's reference folder** (`auth/`, `frontend/`, `api/`, etc.) — 15 min per folder.

### Path 3 — Engineer, Month 1 (~10 hours cumulative)

Week 1 done. Now you're working on real code. Deepen as you go.

1. **[06 — Design decisions](06-design-decisions.md)** — cover-to-cover. 90 min. You'll want this context when you're evaluating a change.
2. **Deep-dive reference** for your area: if you're on the backend, `api/` + `database/` + `engineering/BACKEND-TESTING.md`. If frontend, the entire `frontend/` folder. If platform, `devops/` cover-to-cover plus `security/INCIDENT-RESPONSE.md`.
3. **[02 — Worked example](02-worked-example-single-audit.md)** in full (the second half adds reporting + QA + multi-year threading).
4. The **"Check your understanding"** questions embedded in 02 — if you can't answer them confidently, you haven't understood the architecture yet.

### Path 4 — Auditor / domain advisor (~90 min)

You're an audit professional asked to evaluate whether AIMS v2's architecture respects how audit work actually happens. You don't need the engineering depth.

1. **[01 — Introduction](01-introduction.md)**, skim §1–5 (the problem + the bet). 15 min.
2. **[02 — Worked example](02-worked-example-single-audit.md)** — full read. The Oakfield Single Audit scenario is where you validate we've got the domain right. If anything in this doc contradicts your understanding of GAGAS, IIA GIAS 2024, or 2 CFR 200 — flag it, please. 60 min.
3. **[03 — The multi-standard insight](03-the-multi-standard-insight.md)** — skim §2 and §4. The part on the three-tier taxonomy (methodology / control framework / regulatory overlay) is the ask for your expert eye. 15 min.

Skip the architecture tour, decisions log, and engineer handbook — not your audience.

### Path 5 — Investor / board member (~60 min)

You're assessing strategic position, not the codebase.

1. **[01 — Introduction](01-introduction.md)** — especially §3 (why existing tools are inadequate) and §5 (the AIMS v2 thesis). 20 min.
2. **[03 — The multi-standard insight](03-the-multi-standard-insight.md)** — §1, §5 (the competitive picture), and §7 (what this gives us strategically). Skip the technical implications cascade unless you're technically fluent. 20 min.
3. **[06 — Design decisions](06-design-decisions.md)** — skim the "Strategic directions" section for the Academy / certification opportunity and related product plays. 10 min.
4. Ask for the deck / pitch materials separately; this folder is design-level, not fundraising-level.

### Path 6 — Product manager / designer (~2 hours)

You're owning a feature or flow and need to understand the constraints the system imposes.

1. **[01 — Introduction](01-introduction.md)** — full read. 20 min.
2. **[02 — Worked example](02-worked-example-single-audit.md)** — full read. 60 min. This is the best single artifact for understanding customer workflows.
3. **[04 — Architecture tour](04-architecture-tour.md)** — focus on §3 (the data plane) and §4 (the identity plane). 20 min.
4. **[05 — Glossary](05-glossary.md)** — reference as needed.

### Path 7 — Customer doing a security review (~45 min)

You're evaluating whether AIMS v2 meets your security and compliance bar.

Most of what you need is in the `security/` folder — specifically `security/TRUST-CENTER.md` for the public face, and the SOC 2, ISO 27001, Privacy, and HIPAA docs for framework-specific detail. This folder is optional for you.

If you want the one-doc orientation, read **[01 — Introduction](01-introduction.md)** §5 (thesis) + §7 (roadmap). 15 min. Then jump to `security/` for the detailed material.

### Path 8 — Pack author (future, post-MVP)

You're writing a new standard pack — say, a custom methodology pack for a regional audit standard, or a new control framework pack.

1. **[02 — Worked example](02-worked-example-single-audit.md)** §6 — how a finding is shaped by a pack. 15 min.
2. **[03 — The multi-standard insight](03-the-multi-standard-insight.md)** §4 — the three-tier taxonomy. Decide which tier your pack belongs in. 10 min.
3. **`data-model/README.md` + `data-model/VALIDATION.md`** — authoring rules + per-packType requirements.
4. **`data-model/examples/` packs** — real examples to copy from (GAGAS, IIA GIAS, ISO 19011, Single Audit, SOC 2).

Pack authoring is not a Tier 1 activity; this path assumes you're reading later when the pack-authoring SDK exists.

---

## Navigating to other folders

This folder is the orientation layer. When you're ready for operational detail, go to:

| If you want to know about… | Read the folder… |
|---|---|
| Authentication, MFA, SSO, session management, permissions | `auth/` |
| Next.js app structure, UI patterns, accessibility, i18n, performance | `frontend/` |
| CI/CD pipelines, AWS infrastructure, Kubernetes, observability, disaster recovery | `devops/` |
| Testing strategy, code standards, code review, documentation, quality gates | `engineering/` |
| Security program, compliance (SOC 2, ISO 27001, HIPAA), privacy (GDPR, CCPA), vulnerability mgmt | `security/` |
| Standard pack schema, example packs (GAGAS, IIA GIAS, ISO 19011, Single Audit, SOC 2) | `data-model/` |
| PostgreSQL schema, row-level security, migrations, audit log, performance | `database/` |
| tRPC routers, REST endpoints, webhooks, API conventions | `api/` |
| Audit standards research (GAGAS, IIA GIAS, SOX/PCAOB, ISO 19011, COBIT, ISSAI — primary-source deep dives) | `references/standards/` |
| Competitive analysis, research synthesis, multi-standard design decisions | `references/` |
| Top-level roadmap + tech stack + SaaS readiness | `MASTER-PLAN.md`, `TECH-STACK.md`, `SAAS-READINESS.md` |

Each reference folder has its own README. Start there if you're exploring.

---

## How this folder is maintained

- **Ownership**: Product + Engineering leadership.
- **Review cadence**: quarterly review of all docs; ad-hoc updates when material changes land.
- **Staleness policy**: every file carries a *Last reviewed* date at the bottom. If it's older than twelve months, don't trust specifics without cross-checking.
- **Contribution**: PRs to this folder require one reviewer who is not the author. For material changes — renaming core concepts, shifting architectural claims, rewriting worked examples — also loop in at least one product person.
- **Versioning**: docs are versioned with the code. If you're reading a commit from twelve months ago, the docs describe the architecture at that commit, not today's.

---

## A note on reading effort

The total reading if you go cover-to-cover is about ten hours — roughly one working day. That's deliberate. An engineer, advisor, or customer who spends a day on this folder becomes meaningfully more productive than one who tries to pick it up in the hallway.

If ten hours feels heavy: that's why the reading paths exist. Start with your role's path. You don't need to read the rest unless you want to.

---

*Last reviewed: 2026-04-20.*
