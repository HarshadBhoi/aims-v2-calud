# Tech Debt

> Debt is tracked in a single ledger. Every quarter we pay some down. We distinguish deliberate debt (taken for a reason) from accidental (emerged from neglect). Deprecation has a clock. Refactors ship behind flags.

---

## 1. What Is Tech Debt?

Any choice in the codebase that will cost more to live with than to fix — tomorrow.

Debt is **neutral**. Some debt is rational: shipping a hard-coded flow to validate product-market fit, then refactoring once it's proven, is good engineering. Debt becomes a problem when it's invisible, unmanaged, or compounding.

### What counts as tech debt
- Known-wrong patterns (copy-paste duplication, magic strings, god objects)
- Deprecated deps / tools / APIs not yet migrated
- Incomplete refactors (half-converted files)
- Flags that were supposed to be removed
- Missing test coverage on load-bearing code
- Documentation that's stale
- Infrastructure patterns that don't scale to the next 10× load
- Security fixes scheduled but not applied
- "TODO" comments > 90 days old
- Workarounds for bugs in dependencies

### What doesn't
- Things we haven't built yet (that's backlog, not debt)
- Things that work but "I'd do differently now" (aesthetic)
- Normal evolution (code that was right for last quarter's scale and needs rework for next quarter — that's just engineering)

---

## 2. Taxonomy

### By origin

| Kind | Description | Handling |
|------|-------------|----------|
| **Deliberate** | Taken with eyes open for a reason (deadline, learning) | Documented, tracked with payoff plan |
| **Accidental** | Emerged from mistakes, missing knowledge, outdated tools | Prioritized by blast radius |
| **Rotting** | Wasn't debt when written; become debt via surrounding change | Triaged; may auto-resolve by replacing |
| **Contagious** | Copy-paste patterns that spread | Refactor + lint rule to prevent re-introduction |

### By impact

| Severity | Description | SLA |
|----------|-------------|-----|
| **Critical** | Blocks progress, risks production stability | < 30 days |
| **High** | Meaningful slowdown for a team | < 1 quarter |
| **Medium** | Annoying but workable | Opportunistic (next touch) |
| **Low** | Aesthetic / mild inconvenience | Never-or-opportunistic |

---

## 3. The Debt Ledger

One source of truth: a `tech-debt` project in Linear (or equivalent).

### Ticket fields
- **Title** — specific
- **Severity** — critical / high / medium / low
- **Area** — feature/module affected (free-text + label)
- **Impact** — who suffers (engineers, users, operations)
- **Estimated effort** — T-shirt size
- **Proposed approach** — rough plan
- **Deadline** (if critical/high) — per SLA
- **Related** — links to incidents, ADRs, PRs

### How tickets get created
1. **Reviewer-flagged**: in PR review, "I'm going to approve but let's file tech debt for X"
2. **Post-incident**: any postmortem that has "preventive action" that's architectural
3. **Self-reported**: engineer notices + files during feature work
4. **Metrics-driven**: regression on DORA / SLO / code-quality metrics
5. **Security-driven**: from SAST / SCA / pentest findings

### Review cadence
- Weekly: team triage of new debt
- Monthly: cross-team leads review top debt
- Quarterly: leadership review; budget decisions

---

## 4. Budget

### 20% engineering capacity budgeted for debt
Not "whenever we have time" — scheduled:
- Each sprint: 1 debt ticket per engineer (minimum)
- Quarterly: "fix it" sprint — 100% debt, 1 week per quarter
- Ad hoc: senior engineers allocate larger chunks to load-bearing debt

### When to exceed budget
- **Critical debt**: SRE + Eng Leadership approve dedicating more capacity
- **DORA regression**: if change failure rate > 10% or lead time > 72h, pause features until improved
- **Error budget exhausted** (see `devops/OBSERVABILITY.md §8`): feature deploys frozen; debt + stability work only

### When to under-spend
Product pressure real; not every sprint gets 20%. Trailing-quarter average matters, not per-sprint.

---

## 5. The 90-Day Freshness Rule

Nothing marked "temporary" stays forever. Enforcement:

### TODO comments > 90 days
- Linter warns
- Reviewer's call: convert to ticket or delete the TODO

### Feature flags > 90 days post full-rollout
- CI fails on PR that touches flag's code (see `devops/RELEASE.md §5`)
- Forces removal of the flag and its dead branch

### `// HACK` / `// FIXME`
- Must have linked issue; issue expires per severity SLA
- Stale `HACK` without progress — escalated to team lead

### `.eslintignore` entries
- Require justification + expiration
- Without expiration: lint fails

### `@deprecated` APIs
- Removal date in JSDoc
- Past removal date = must remove

---

## 6. Debt-Taking Discipline

### When you knowingly take debt
Write a comment linking the ticket:
```ts
// TODO(LIN-1234): Replace with a query that uses the new _indexed_ field.
// We're using the slow path because the index migration lands next sprint.
const rows = await prisma.finding.findMany({ where: { ... } });
```

Not just "TODO: fix this later." Specific ticket; specific rationale; specific replacement plan.

### When you can't write the ticket yet
Stop and write the ticket. Can't describe the debt = can't make an informed tradeoff.

### Quarterly "debt inventory"
Each team produces a list of its biggest debts. Discussed in engineering all-hands. Compared across teams; cross-cutting items batched.

---

## 7. Deprecation Lifecycle

### APIs / Modules
1. **Mark deprecated**: JSDoc `@deprecated`; log warning at runtime when used
2. **Announce**: engineering channel; roadmap if customer-facing
3. **Phase out**: migrate consumers one by one
4. **Enforce unused**: metrics show usage trending to zero
5. **Remove**: PR deletes the code; changelog entry

Duration depends on audience:
- Internal-only: 2 sprints
- Internal + external consumers: 6 months notice
- Public API: 12 months notice (contractual for many)

### Tools / Frameworks
Major-version upgrades often include deprecations. Process:
1. Track on engineering roadmap
2. Schedule "soak period" on new version in dev / staging before going live
3. Remove old version from CI / build once migration done

### Libraries
Deps that are unmaintained, insecure, or obsolete:
- If a replacement exists, schedule migration
- If no replacement, fork + maintain (with heavy reluctance)
- If dead feature area, sunset the feature (with customer comms)

---

## 8. Refactoring Rules

### Refactor vs rewrite
- **Refactor**: behavior unchanged; structure improved. Preferred.
- **Rewrite**: replace from scratch. Very risky. Requires board-level risk sign-off for load-bearing subsystems.

Most of what we call "rewrite" should be series-of-refactors.

### Strangler fig pattern
For modules needing replacement:
1. New parallel implementation
2. Gradually route traffic to new impl (feature flag % ramp)
3. Observe in production
4. Decommission old when safe
5. Typically weeks, not days

### Never "big-bang refactor"
- Max 2-week refactor branches
- If it takes longer, it was scoped wrong — split into smaller refactors
- Long-lived branches accumulate merge conflict + context-rot

### Refactor under test
- Add missing tests first (on the code as-is)
- Refactor with tests green throughout
- Review: "did any behavior change? If so, why?"

### Deletion is a refactor
Removing dead code is legitimate. Don't "keep just in case" — git history preserves. Deleted unused code improves the codebase even if nothing new is added.

---

## 9. Load-Bearing Legacy — Handle Carefully

Some debt is infrastructure-level: auth, permissions, data model. "Just fixing" it means taking the system offline or breaking every consumer.

### Process
1. ADR describing current state + desired state
2. Identify migration path (often expand-migrate-contract)
3. Feature flag dual-paths (see `devops/RELEASE.md §5`)
4. Test new path in parallel for long period (weeks)
5. Flip canary (1% → 10% → 100%)
6. Remove old path after soak

### Examples (hypothetical)
- Migrating auth from JWT cookies to PASETO (the whole cookie world changes)
- Replacing Prisma with Drizzle (every query touched)
- Moving from single-region to multi-region-active (data residency, consistency model)

These take quarters, not sprints. Resourced accordingly.

---

## 10. Debt That Shouldn't Exist

### Things we refuse to accept as "debt"
- Security vulnerabilities above Medium — these are bugs, fixed immediately
- Intentional breaking of contract — fix now or don't ship
- Skipping tests — not shippable (exception in `TESTING-STRATEGY.md §21`)
- Broken observability — incident risk; fix same sprint

"It's tech debt" is not a free pass. Severity determines urgency.

---

## 11. Rotting Debt — The Quiet Killer

Not all debt is created. Some emerges from environmental change:

- Library maintained then abandoned
- Node version drift (Node 22 features used; still need to support 20 for library X)
- Pattern idiomatic in 2022 → outdated in 2026
- Scale change (works for 10 tenants, crumbles at 500)

### Detection
- Quarterly audit: top 10 deps with maintenance red flags
- Load tests reveal scaling concerns early
- Annual "archaeology" week where a senior engineer scouts for rot

### Handling
- Most rotting debt resolves via routine upgrades
- Persistent rotting debt gets a quarterly-review slot

---

## 12. Documenting Debt Explicitly

### `/debt` folder or labels
We prefer labels in the ticket system over a dedicated folder — easier to see alongside normal work.

### Architectural debt → ADR
If the debt is architectural ("we have two competing approval engines"), write an ADR describing the current state + proposed resolution. Ensures rationale survives team changes.

### README mentions debt
If a module has significant known debt, its README calls it out:
```markdown
## Known limitations
- Finding creation does not yet support batch. See LIN-1234.
- The approval chain is single-threaded; race conditions possible under high load. See LIN-1250.
```

Honest docs beat surprise debt.

---

## 13. Debt Review Metrics

| Metric | Tracked via | Target |
|--------|-------------|--------|
| Open debt tickets | Linear query | Trending down |
| Critical debt open > 30d | Query | 0 |
| High debt open > 90d | Query | < 5% of high-priority queue |
| PRs tagged `chore: fix tech debt` / quarter | Git history | > 40 |
| Feature flags > 90d post-GA | Flag service query | < 10% |
| Deprecated APIs still in use | API metrics | Decreasing |

Reviewed quarterly. Trends matter; snapshot numbers don't.

---

## 14. Debt-Taking ≠ Tolerating Bad Work

New bugs / issues caused by the author's own choices are not debt — they're mistakes. Fix them:
- Caught in review: fix in the same PR
- Caught after merge: follow-up PR same day if possible
- Caught in prod: revert + fix

Debt = knowingly shipping a suboptimal solution. Bugs = mistakes. Distinguish.

---

## 15. "We'll Fix It In v2"

Classic pattern: current version accumulates debt; plan is "v2 will be clean."

Reality:
- v2 rarely lands on time
- v2 often takes longer than expected
- v1 keeps shipping features into the debt
- When v2 arrives, it has its own debt

**Rule**: don't plan to fix debt in v2. Fix as you go. If v2 exists, it's because v1's architecture is fundamentally wrong — not because accumulated debt demands a rewrite.

---

## 16. Engineering Culture Around Debt

### Safe to admit
- No blame when someone admits "I took a shortcut last sprint; filing a ticket now"
- Encourage self-reporting; punish only cover-up

### No hero culture
- "I'm the only one who understands this legacy module" = debt in human form
- Require pair rotation on load-bearing code
- Document + cross-train

### Celebrate debt reduction
- Monthly recognition in engineering all-hands
- Metrics on debt-reduction PRs
- Counted in promotion criteria as high-value work

---

## 17. When Debt Exceeds Capacity

Sometimes tech debt exceeds the team's capacity to address. Signs:
- DORA metrics regressing
- Engineer churn citing code quality
- Frequent production incidents rooted in known debt
- "Simple features" taking weeks

Responses (escalating):
1. Pause some feature work; dedicate a "fix it" quarter
2. Bring in consultants for targeted refactors
3. Hire specifically for platform / infra debt
4. Strategic decision: sunset legacy modules; rewrite foundational ones

Leadership-level decisions; engineering-managed.

---

## 18. Debt Triage in Incident Postmortems

Every postmortem (`devops/RUNBOOKS.md §11`) checks:
- Was this incident enabled by existing debt?
- Should we fix the underlying debt or add guardrails?
- Debt ticket created? Priority assigned?

Incidents are windows into debt. Use them.

---

## 19. Anti-Patterns

- **"It's just a hack, it works"** → file the ticket; assign a deadline
- **"We'll refactor the whole module next quarter"** → split into 10 smaller refactors
- **"The engineer who wrote this is gone, nobody understands"** → archaeology + document, or rewrite with understanding
- **"Code is fine, but our tests are a mess"** → tests are code; same standards
- **"We can't touch this — last time we did, prod broke"** → exactly why you should add tests + touch it carefully
- **"Let's just add a flag to skip this for now"** → only with a plan to remove the flag

---

## 20. Related Documents

- `CODE-STANDARDS.md` — practices that reduce new debt
- `REVIEW.md` — spotting debt in review
- `DOCUMENTATION.md` — ADRs for significant debt
- `QUALITY-GATES.md` — how much debt we'll accept to ship
- `../devops/RELEASE.md` — feature flag lifecycle
- `../devops/RUNBOOKS.md` — incident postmortems feed debt ledger
