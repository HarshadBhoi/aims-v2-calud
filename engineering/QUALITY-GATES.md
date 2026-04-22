# Quality Gates

> Definition of Done, merge criteria, release criteria — explicit checklists. The automated gates, the human gates, and the difference between them.

---

## 1. Why Explicit Gates

Teams drift without explicit gates. "Done" means different things to different people. "Ready to release" is a judgment call that gets looser under deadline pressure. Gates force us to state the bar in advance and honor it.

---

## 2. Gate Layers

```
 Developer desk   →   PR open   →   Merge   →   Staging   →   Production
 ──────────────      ──────────    ────────    ──────────    ──────────────
 DoR               CI checks     Merge gate  Soak period   Release gate
 Local tests       Lint + type   Required    E2E pass      Canary analysis
 Self-review       Unit + comp   reviewers   Observation   Change window
 Typecheck         Bundle size   Docs        SLO verify    Approvals
                   Security      Release                   Feature flag plan
                   E2E smoke     notes                     Rollback ready
```

Each gate is automated where possible, human where judgment matters.

---

## 3. Definition of Ready (DoR) — Before Work Starts

A ticket is ready for engineering to pick up when:

### Product-side
- [ ] User story or problem statement clear
- [ ] Acceptance criteria listed (not vague aspirations)
- [ ] Scope explicit ("in scope" + "out of scope")
- [ ] Dependencies identified
- [ ] Prioritized; agreed when to start

### Engineering-side
- [ ] Technical approach roughed out (can be "spike first")
- [ ] Breaking changes identified + migration plan
- [ ] Security / compliance implications flagged
- [ ] Observability needs identified
- [ ] Rough size estimate (T-shirt)

### Exit criteria from DoR
- [ ] One engineer agrees to start

DoR is **author discipline**, enforced via team lead at sprint planning. Tickets failing DoR go back.

---

## 4. Definition of Done (DoD) — The Big One

A unit of work is "done" when **all** apply:

### Code
- [ ] Feature implemented per acceptance criteria
- [ ] All changes pass TypeScript strict
- [ ] Lint passes with zero warnings
- [ ] Prettier-formatted
- [ ] No new `any`, `as`, `!` without justified comment
- [ ] No `console.log` / `debugger` / `test.only` / `.skip`
- [ ] Error handling at appropriate layer
- [ ] Input validated (Zod at boundary)
- [ ] Permissions checked (if multi-tenant code path)

### Tests
- [ ] Unit tests for new pure logic
- [ ] Integration tests for procedure / service behavior
- [ ] Component tests for new UI
- [ ] E2E if new user-facing workflow
- [ ] RLS test if touching multi-tenant schema
- [ ] Migration test if adding migration
- [ ] Coverage did not regress
- [ ] All tests green locally + CI

### Documentation
- [ ] Public API has JSDoc
- [ ] README updated if module's public surface changed
- [ ] ADR written if significant architectural decision
- [ ] Release-note entry drafted (customer-facing changes)
- [ ] Runbook created/updated if operational impact

### Observability
- [ ] Key business events emit structured logs
- [ ] Metrics + dashboards updated if needed
- [ ] SLO / alert updated if new service or significant load change
- [ ] Error tracking (Sentry) sees new errors

### Security
- [ ] No secrets in code (gitleaks clean)
- [ ] SAST / SCA pass (no high+ unresolved)
- [ ] No hardcoded user-visible strings (i18n)
- [ ] Authorization tested

### Accessibility (frontend)
- [ ] axe-core passes on new / changed UI
- [ ] Keyboard-operable
- [ ] Contrast OK in light + dark

### i18n (frontend)
- [ ] User-visible strings in message files
- [ ] Date / number formatting via locale-aware helpers

### Review
- [ ] Required approvals obtained (per CODEOWNERS)
- [ ] All review threads resolved
- [ ] No outstanding blocking comments

### Feature flags
- [ ] If behind flag: default state set correctly per env
- [ ] Flag removal planned (tracking ticket)

### Rollback
- [ ] Rollback path documented (feature flag off, revert PR, migration rollback)
- [ ] Safe to revert without manual intervention

Only when every box is checked is the work done. DoD checked by reviewer + author together.

---

## 5. Merge Gate — What Must Pass For PR → `main`

### Automated (CI-enforced)

| Check | Gate |
|-------|------|
| Lint | Zero errors; zero warnings |
| Format check (Prettier) | Must pass |
| Typecheck (`tsc --noEmit`) | Zero errors |
| Unit tests | All pass |
| Component tests | All pass |
| Integration tests | All pass |
| Build (prod) | Must succeed |
| Bundle budget | Within thresholds |
| Accessibility (axe-core) | Zero violations |
| SAST (Semgrep) | Zero high+ unresolved |
| SAST (CodeQL) | Zero high+ unresolved |
| SCA (Snyk, pnpm audit) | Zero high+ unresolved (exceptions allowlisted) |
| Secret scan (gitleaks) | Zero findings |
| Container scan (Trivy) | If Dockerfile changed: zero CRITICAL/HIGH |
| IaC scan (tfsec + checkov) | If terraform changed: zero high+ |
| E2E smoke tests | All pass on preview env |
| Schema snapshot | Matches committed snapshot (or PR explicitly updates it) |
| Commit message format | Valid Conventional Commits |

### Human-enforced

| Check | Enforced by |
|-------|------------|
| ≥ 1 approval (or 2+ per CODEOWNERS) | GitHub branch protection |
| Review threads resolved | Reviewer confirms |
| PR title matches Conventional Commits | Action auto-validates |
| Linked issue in description | Reviewer confirms (strict for non-trivial PRs) |

### Temporary waivers (emergency)
- `hotfix` label + 3 approvals + VP Eng waiver
- Still requires CI green (never skip quality gates entirely)

---

## 6. Post-Merge to `main`

Once merged:

| Action | When | Enforced by |
|--------|------|------------|
| Auto-deploy to staging | Immediate | `cd-staging.yml` |
| Integration tests on staging | Post-deploy | Pipeline |
| E2E full suite on staging | Post-deploy (async) | Pipeline |
| Observability checks | 15 min soak | Alerts |
| Release Please PR (new version candidate) | On merge | Bot |

### Broken `main` policy
- Any red on `main` = top priority; author fixes first
- Revert is acceptable if fix will take > 30 min
- New merges blocked until `main` green (via merge queue or manual hold)

---

## 7. Staging Soak Gate — Before Production

### Minimum soak
- Regular release: **24 hours**
- Hotfix: **2 hours** (with VP Eng waiver)
- Major change affecting core workflows: **48 hours**

### Required observations during soak
- [ ] Staging SLOs green
- [ ] No new error patterns in Sentry
- [ ] Log volume not significantly increased
- [ ] Latency not regressed vs prior staging build
- [ ] E2E suite passed at least once post-deploy
- [ ] If migration: applied cleanly, no locks observed
- [ ] Manual smoke check of changed areas

If any red → fix in a follow-up PR; soak clock resets.

---

## 8. Production Release Gate

### Pre-flight (automated, see `devops/CI-CD.md` cd-production.yml)

- [ ] Version tag resolves to a staging build ≥ soak-minimum hours old
- [ ] Change window check: Tue / Thu 10–14 UTC (unless hotfix)
- [ ] SLO burn rate not critical (error budget check)
- [ ] No ongoing incident (Statuspage green)
- [ ] Change ticket referenced

### Approvals (human)

- [ ] 2 reviewers approve in GitHub Environment
- [ ] Reviewers are different people from PR author
- [ ] At least one approver is SRE or Eng Lead

### Rollout mechanics

- [ ] Migration runs + completes successfully
- [ ] Canary 1% — SLO analysis passes
- [ ] Canary 5% — SLO analysis passes
- [ ] Canary 25% — SLO analysis passes
- [ ] 100% promotion
- [ ] Smoke tests pass on prod
- [ ] 30-minute observation post-promotion

Any failure at any step → Argo Rollouts aborts → traffic flips back to stable → investigate.

### Post-release

- [ ] Sentry release created
- [ ] Grafana annotation added
- [ ] Statuspage updated (if customer-visible)
- [ ] Release notes published
- [ ] Deploy announced in `#deploys`
- [ ] DORA metrics updated

---

## 9. Hotfix Gate (Special Path)

Hotfixes are risky. Gate is **more** restrictive, not less:

- [ ] Root cause identified
- [ ] Fix minimally scoped (only what's necessary)
- [ ] Full CI passes
- [ ] ≥ 3 approvals (including VP Eng or designate)
- [ ] Change ticket + risk review
- [ ] Staging ≥ 2h
- [ ] Canary progression same as normal (not bypassed)
- [ ] Postmortem scheduled within 48h

The speedup is in change-window (outside Tue/Thu) and soak (2h instead of 24h). Quality gates do not relax.

---

## 10. Security Gate

For security-sensitive changes (auth, permissions, secrets, data handling):

- [ ] Security champion or AppSec team reviewed
- [ ] Threat model updated if new trust boundary
- [ ] ADR for significant decisions
- [ ] No new public endpoint without auth
- [ ] SAST clean on the diff
- [ ] Manual security testing (if scope warrants)
- [ ] Pen test on the change if material (auth flow, SSO, RBAC)

Security finds are blockers, not suggestions.

---

## 11. Compliance Gate (for SOC 2 / ISO 27001-scoped changes)

Certain changes touch compliance-scoped controls:
- Authentication / authorization
- Logging + audit trail
- Encryption / key management
- Access control changes
- Any change to prod IAM / infra

Additional gates:
- [ ] Compliance officer acknowledged (for material changes)
- [ ] Change record filed (ServiceNow / Linear)
- [ ] Evidence captured in compliance tool (Drata / Vanta)
- [ ] Audit log confirms expected events after deploy

---

## 12. Data Migration Gate

For PRs introducing DB migrations:

- [ ] Classified as **Safe** / **Ambiguous** / **Unsafe** (see `devops/CI-CD.md §6`)
- [ ] If Ambiguous/Unsafe: split into expand → migrate → contract
- [ ] Dry-run tested on staging with prod-like data
- [ ] Time/lock analysis attached
- [ ] Rollback plan explicit
- [ ] Monitoring / alerts for migration health
- [ ] If long-running: coordinated maintenance window

Unsafe migrations not reachable until broken into safe steps.

---

## 13. Performance Gate

### Per-PR (automated)
- Bundle size budgets (frontend routes)
- Lighthouse CI budgets (if preview-env)
- Micro-benchmarks on hot paths (if labeled `perf:`)

### Pre-release
- k6 baseline-load must pass (nightly on `main`)
- No p95 or p99 regression vs previous release > 10%
- No error-rate regression

### Regression policy
Threshold regression → PR / release blocked until:
- Regression root-cause identified
- Either fixed or explicitly accepted with tracking ticket

---

## 14. Documentation Gate

Before merging significant changes:

- [ ] Public API JSDoc current
- [ ] README reflects current public surface
- [ ] ADR exists if significant decision
- [ ] Release notes drafted (customer-visible changes)
- [ ] Runbook created/updated (operational changes)

Check by reviewer. Docs drift is silent tech debt.

---

## 15. Feature Flag Gate

For new features shipped behind flags:

- [ ] Flag defined in flag service (not hardcoded)
- [ ] Default state per env set (dev: ON, staging: ON, prod: OFF initially)
- [ ] Kill switch tested (disable in staging → feature disappears cleanly)
- [ ] Rollback plan = flip flag (not revert code)
- [ ] Removal tracking ticket created (90-day SLA)

### Flag removal gate
When removing a flag (post full rollout):
- [ ] Metrics show flag at 100% (or target state) for 2+ weeks
- [ ] No edge cases depend on the old path
- [ ] PR removes both the flag AND the dead code branch

---

## 16. UI Gate

Frontend-specific:

- [ ] Renders correctly in light + dark mode
- [ ] Responsive down to 375px viewport (if mobile is in scope for feature)
- [ ] Accessibility tests pass
- [ ] Keyboard-operable end-to-end
- [ ] i18n strings extracted
- [ ] Visual regression not unexpectedly changed
- [ ] Error states handled
- [ ] Loading states handled (skeleton, not spinner)
- [ ] Empty states handled

Full detail: `frontend/UI-PATTERNS.md` + `frontend/ACCESSIBILITY.md`.

---

## 17. Observability Gate

Before shipping a new service or significant feature:

- [ ] Structured logs with context (traceId, tenantId, userId)
- [ ] Metrics emitted (RED pattern: Rate, Errors, Duration)
- [ ] Dashboard includes new service/feature
- [ ] SLO defined (if customer-facing)
- [ ] Alerts configured + have runbooks
- [ ] Sentry configured + release tracking working

"If it breaks, will I know? Will I know fast? Will I know why?" All three yes.

---

## 18. Release Notes Gate

Before prod release:

- [ ] Technical changelog auto-generated from commits
- [ ] Customer-facing release notes drafted by product
- [ ] Breaking changes called out explicitly
- [ ] Migration guidance if customer action needed
- [ ] Published to docs site + email to tenant admins

No "silent" releases of customer-visible changes.

---

## 19. Beta / GA Promotion Gate

For features moving from beta → GA:

- [ ] Feature flag has been ON for ≥ 2 weeks for beta tenants
- [ ] Usage metrics show actual adoption (not just "enabled, unused")
- [ ] Error rate on this feature ≤ overall product baseline
- [ ] Positive customer feedback (or neutral; no active complaints)
- [ ] Docs are customer-ready
- [ ] Support runbook exists
- [ ] GTM / marketing coordinated (if material feature)

GA = we commit to supporting it. That commitment has a bar.

---

## 20. Deprecation / Removal Gate

For removing a feature or API:

- [ ] Deprecation announced ≥ deprecation period ago (internal: 2 sprints; external: 6-12 months)
- [ ] Metrics show near-zero usage
- [ ] Known consumers individually notified
- [ ] Migration guidance documented
- [ ] Removal plan phased (dark-launch removal, then physical removal)
- [ ] Release notes call it out

Breaking changes with inadequate notice = relationship damage. Gate exists to protect that.

---

## 21. Third-Party Dependency Gate

Before adding a new runtime dependency:

- [ ] License on allowlist (MIT / Apache / BSD / ISC / MPL)
- [ ] No known high CVEs
- [ ] Actively maintained (commit within 6 months)
- [ ] Not a micro-package (>100 lines of value)
- [ ] Bundle-size impact acceptable
- [ ] No conflicts with existing deps
- [ ] Senior engineer approval
- [ ] ADR if strategic (replaces/enables a capability)

Dev dependencies: lighter bar, but still allowlist + CVE checks.

---

## 22. Retry / Abort Criteria

### Retry a gate
- CI flake retry: 1× retry is OK for known-flaky jobs (labeled)
- Canary analysis: never retry auto; human judgment after investigation

### Abort a release
- Canary fails SLO analysis: auto-aborts; no human needed
- Smoke tests fail post-deploy: human decision whether to forward-fix or rollback
- Incident declared during release: abort, flip back, investigate

### Don't abort just because someone's nervous
Nervous ≠ data. If numbers are green, proceed. Nervousness → post-release more observation.

---

## 23. Gate Ownership

Every gate has an owner who maintains it:

| Gate | Owner |
|------|-------|
| Lint/format/type | Platform eng |
| Unit / integration tests | Feature team (local) |
| Security gates | AppSec team |
| Bundle budgets | Frontend lead |
| Performance gates | Backend lead + SRE |
| Release gates | Release manager (weekly) |
| Compliance gates | Compliance officer |

Owner tunes thresholds, fixes broken gates, reviews effectiveness quarterly.

---

## 24. Gate Health Metrics

### Metrics we track
- **False positive rate** (gate fails on correct code): should be < 5%
- **Bypass rate** (gates waived with emergency override): should be < 1%
- **Gate-detected defects** (bugs caught by gates that would've reached prod): positive trend
- **Time in gates** (wall time PR spends in CI + review): should be < 12h median

### Reviewed quarterly
Gates that fail too often → retune or replace. Gates never failing → maybe redundant (or the behavior is genuinely solid).

---

## 25. Principles Summary

1. **Every gate is explicit** — no implicit "someone checks"
2. **Automated where mechanical, human where judgment**
3. **Gates exist to prevent harm** — don't add gates that don't catch real issues
4. **Gates are maintained** — stale gates become noise
5. **Waiver is rare + logged** — bypass happens, is transparent
6. **Gate failure = fix first, merge second** — never ship past a red gate "temporarily"
7. **Gates apply equally to everyone** — no senior-exempt; no junior-only-bypass

---

## 26. Related Documents

- `REVIEW.md` — human review portion of the merge gate
- `TESTING-STRATEGY.md` — what tests feed the gates
- `SECURITY-TESTING.md` — security gates detail
- `TECH-DEBT.md` — when we take debt consciously
- `../devops/CI-CD.md` — pipeline that executes gates
- `../devops/RELEASE.md` — production release gate mechanics
- `DOCUMENTATION.md` — docs gate
