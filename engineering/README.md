# AIMS v2 — Engineering Standards

> The cross-cutting standards that make this codebase consistent, reviewable, testable, and maintainable over a decade. Testing strategy, code conventions, review culture, documentation, tech debt discipline, and quality gates.

---

## Why This Document Exists

The previous folders answer *what* we're building (`data-model/`, `database/`, `api/`, `auth/`, `frontend/`) and *how we run it* (`devops/`). This folder answers *how we work* — the engineering practices every engineer on this project is expected to follow.

Without this, good individual decisions accumulate into an inconsistent, hard-to-maintain codebase. With this, new engineers ramp up faster, reviews focus on substance, bugs get caught earlier, and tech debt stays bounded.

This is the least glamorous folder in the planning tree. It is also the one that determines whether AIMS v2 is a codebase engineers want to work on at year 3.

---

## Scope

This folder covers **cross-stack engineering practices** — things that apply equally to frontend, backend, infra, and data work:

| Area | Covered where |
|------|---------------|
| Testing philosophy + strategy | `TESTING-STRATEGY.md` |
| Backend testing patterns (NestJS + Prisma + tRPC) | `BACKEND-TESTING.md` |
| Contract testing (API ↔ UI) | `CONTRACT-TESTING.md` |
| Performance & load testing | `PERFORMANCE-TESTING.md` |
| Security testing (beyond CI scan) | `SECURITY-TESTING.md` |
| Code standards (TS, naming, errors, patterns) | `CODE-STANDARDS.md` |
| Linting, formatting, commit hygiene | `LINTING-FORMATTING.md` |
| Code review culture + process | `REVIEW.md` |
| Documentation (ADRs, READMEs, inline, runbook) | `DOCUMENTATION.md` |
| Tech debt tracking + refactoring | `TECH-DEBT.md` |
| Quality gates (DoD, merge, release criteria) | `QUALITY-GATES.md` |

Topics intentionally NOT here (covered elsewhere):
- Frontend-specific test runners + patterns → `frontend/TESTING.md`
- CI pipeline mechanics → `devops/CI-CD.md`
- Pipeline security tooling → `devops/CI-CD.md §2`
- Operational runbooks → `devops/RUNBOOKS.md`
- Domain schemas → `data-model/`, `database/`

---

## Engineering Principles

The 10 beliefs that underlie everything in this folder:

### 1. Correctness Is A Team Property
Individual correctness (my code passes my tests) is necessary but not sufficient. Team correctness — the codebase continues to work as other people change it — is what ships. We invest in tests, types, contracts, and review because they make *the codebase* correct, not just *this commit*.

### 2. Read-Optimized, Not Write-Optimized
Code is read 10× more than it's written. Verbose, explicit, boring code beats clever code. A junior engineer joining in year 3 should be able to navigate and modify with confidence.

### 3. Types Are Free Tests
TypeScript strict mode + Zod runtime validation catch entire categories of bugs before a test runs. We exploit the compiler to its fullest. `any` is a deliberate decision requiring comment + review, not a shortcut.

### 4. Tests Belong To The Code They Test
Tests live next to their target. They're refactored with their target. They're deleted when their target is deleted. They are not a separate artifact maintained by a separate team.

### 5. The Pipeline Is The Quality Process
Every quality check (lint, type, test, SAST, SCA, bundle budget, a11y) runs in CI. Humans enforce taste, creativity, and architecture — not mechanical correctness. If it can be automated, it must be.

### 6. Review Is Education, Not Gatekeeping
Reviews teach the codebase to reviewers + authors. Reviewing is a first-class contribution, weighted equally to writing code. Blocking feedback is specific + actionable; non-blocking feedback is labeled.

### 7. Documentation Is Part Of Done
Features shipped without documentation (ADR for decisions, README for modules, docstrings for public APIs) are not done. We write docs as we build, not "later".

### 8. Delete Unused Code Aggressively
Unused code is debt that compounds. Dead functions, flagged-off paths, TODO comments from 2023 — all are liabilities. We measure and prune.

### 9. Fast Feedback Loops Beat Thorough Reports
A 2-minute local test run that catches 80% of bugs is worth more than a 30-minute CI run that catches 95%. We optimize the inner loop relentlessly.

### 10. Quality Is Not Negotiable; Scope Is
When a deadline conflicts with quality, we reduce scope — we do not skip tests, skip review, or merge broken code. The long-term cost of quality shortcuts always exceeds the short-term benefit.

---

## How This Folder Relates to Other Standards

Not everything is in this folder. Other standards documents you should be familiar with:

| Document | What it covers |
|----------|----------------|
| `../auth/SECURITY.md` | Threat model, specific auth attack surfaces |
| `../devops/SECRETS.md` | How we handle credentials |
| `../devops/OBSERVABILITY.md` | Structured logging, metrics, SLOs |
| `../devops/RELEASE.md` | Versioning, rollback, change management |
| `../api/CONVENTIONS.md` | API-specific conventions (tRPC procedure naming, etc.) |
| `../frontend/ACCESSIBILITY.md` | WCAG baseline |
| `../database/PERFORMANCE.md` | DB query patterns, indexing |

Standards in this folder are the **default**. Domain-specific standards (auth, API, frontend) override only where explicitly stated.

---

## Applicability

All engineers — frontend, backend, platform, data, SRE — follow this folder. Contractors and vendors integrate via the same standards. External consultants producing code for AIMS v2 are evaluated against these standards.

Third-party code (dependencies, vendor SDKs) is not held to these standards (we don't own them) but is vetted per `CODE-STANDARDS.md §14` before adoption.

---

## Governance

### Who owns these docs?
- Head of Engineering is accountable
- Principal engineers + SRE lead contribute
- All engineers reviewed during quarterly standards review

### How do standards change?
1. Propose via RFC or ADR in `docs/adr/`
2. Reviewed by engineering leads + sample of ICs (incl. junior voices)
3. If approved, standards doc updated in same PR as tool/config change
4. Announcement in `#engineering` with 2-week grace period before enforcement
5. Retro at 90 days — did it help or hurt?

### How do we stay current?
- Annual full review of each doc
- Ad-hoc updates when evidence warrants (incident root cause, major tool version, industry shift)
- Explicit date-of-last-review in each doc header

---

## Reading Order

If new to the codebase:
1. **README.md** (this file) — principles
2. **CODE-STANDARDS.md** — how to write code
3. **LINTING-FORMATTING.md** — tools configured to enforce it
4. **TESTING-STRATEGY.md** — how we test
5. **REVIEW.md** — how PRs flow
6. **DOCUMENTATION.md** — how we record decisions
7. **QUALITY-GATES.md** — what must pass for merge/release
8. Rest on-demand

---

## Anti-Patterns This Folder Exists To Prevent

- Per-team testing philosophy, each re-invented from scratch
- Code review as a rubber stamp ("LGTM 🚀")
- PRs with 1500 lines touching 60 files
- Hero culture — heroics replacing process
- "We'll write tests later" — never happens
- Tech debt unacknowledged until it's too late
- Decisions made in Slack, forgotten, relitigated
- Copy-pasted ESLint configs that drift
- Docstrings that lie (describe behavior that changed 18 months ago)

If you recognize yourself in any of these, welcome — this folder is why.

---

## Status

- [x] Principles articulated
- [x] Doc structure defined
- [ ] Tool configs authored (Phase 1)
- [ ] First codebase audit against standards (Phase 1 end)
- [ ] Quarterly standards review process running (Phase 2)
