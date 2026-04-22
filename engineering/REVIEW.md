# Code Review

> Reviews are education, not gatekeeping. Reviewers are first-class contributors, weighted equally to writers. Feedback is specific, actionable, and kind. Small PRs reviewed quickly beat large PRs reviewed whenever.

---

## 1. Why We Review

- Catches bugs humans notice that tools miss (logic errors, subtle concurrency, UX issues)
- Spreads knowledge (the reviewer learns the area; the author learns from feedback)
- Maintains codebase consistency (patterns propagate)
- Surfaces architectural concerns before they ossify
- Satisfies compliance controls (SOC 2 CC8.1 — change mgmt; ISO 27001 A.14.2)

**We do NOT review to**:
- Prove the reviewer is smart
- Slow down the author
- Micromanage style (tools enforce style)
- Gate-keep "the right way" (there's usually more than one)

---

## 2. Who Reviews What

### Default: 1 reviewer
Most changes require 1 reviewer from the relevant team. The reviewer must:
- Understand the feature area
- Not be the author
- Be available within the review SLA (see §5)

### 2 reviewers required for
- Migrations in `database/migrations/`
- Changes to `auth/`
- Changes to `security/` or SECURITY-related rules
- Terraform changes to `production/` environments
- Standard pack schema changes (`data-model/`)
- Files labeled `CODEOWNERS` as requiring 2
- PRs labeled `high-risk` by the author
- Breaking API changes (triggers `api/CONVENTIONS.md` review)

### 3 reviewers required for
- Hotfix bypass of normal release window (see `devops/RELEASE.md §16`)
- Changes to this `engineering/` folder itself

### CODEOWNERS-enforced
```
# .github/CODEOWNERS
/apps/api/src/auth/              @acme-aims/security @acme-aims/backend
/apps/api/src/billing/           @acme-aims/backend-billing
/apps/web/app/(auth)/            @acme-aims/security @acme-aims/frontend
/database/migrations/**          @acme-aims/backend @acme-aims/platform
/terraform/environments/production/** @acme-aims/platform
/engineering/**                  @acme-aims/eng-leadership
/data-model/                     @acme-aims/product @acme-aims/backend
/standard-packs/**               @acme-aims/product
```

GitHub auto-requests these owners; at least one must approve.

---

## 3. What The Author Owes The Reviewer

### Small PRs
Target < 400 lines changed. Larger → split.

### Good description
PR description must include:

```markdown
## Summary
What this change does, in 1–3 sentences.

## Why
Motivation — linked issue, or context if not obvious.

## Approach
Key decisions. Alternatives considered and rejected.

## Test plan
- [ ] Unit tests cover X
- [ ] Integration test for Y (file: path/to/test)
- [ ] Manual: reviewed UI at /staging in light + dark mode
- [ ] Performance: ran `k6 run …`, p95 unchanged

## Screenshots / videos
(for UI changes)

## Risks / rollout plan
What could go wrong? How to mitigate? Feature-flag? Migration safety?

## Related
Closes LIN-1234
```

Template auto-populated. Missing sections = back to author.

### Self-review before requesting
Authors read their own diff first. Catches typos, leftover debug code, forgotten files. 60 seconds saves the reviewer's 20 minutes.

### Draft PRs for early feedback
Open as **Draft** when you want direction but not merge. Move to **Ready for review** only when all CI green + author has self-reviewed.

### Respond within 24 business hours
To every non-nit comment. Either:
- Make the change + reply "done"
- Disagree with reasoning
- Ask for clarification

Ghosting is rude + slows the team.

### Keep branches up to date
Rebase on `main` before requesting re-review. CI must be green on the latest commit.

---

## 4. What The Reviewer Owes The Author

### Respond within the SLA
- Normal PRs: **within 1 business day**
- Urgent/blocking (labeled): **within 4 business hours**
- Hotfix (labeled): **within 1 business hour**

If you can't in the window, say so — unblock with a peer or comment "I'll review tomorrow AM."

### Review in one pass when possible
Don't dribble out comments over 3 days. Block time, review, comment comprehensively.

### Specific, actionable feedback
- ❌ "This is confusing."
- ✅ "Consider extracting lines 40–65 into `computeApprovalRoute()` — the inline logic makes `handleSubmit` hard to scan."

- ❌ "Are you sure this is safe?"
- ✅ "This reads `findings` then writes back without locking. If two users approve concurrently, could we double-count? Consider `SELECT FOR UPDATE` or optimistic concurrency via `_version`."

### Classify your feedback
Use prefixes so authors prioritize:

| Prefix | Meaning |
|--------|---------|
| `blocking:` | Must fix before merge |
| `question:` | I want to understand; answer may or may not change code |
| `suggestion:` | Improvement you might consider (non-blocking) |
| `nit:` | Style / polish (non-blocking; often ignore) |
| `praise:` | Call out things done well (rare is fine; genuine is required) |
| `thought:` | Brainstorming; for future consideration, not this PR |

Without prefixes, ambiguity burns cycles.

### Request changes, don't approve with "please fix before merge"
If you have blocking feedback, **request changes**. Don't approve-with-caveat; the author may merge missing your note. Approve only when happy with the final state.

### Review the code, not the author
- "This class is too large" — reviews code.
- "You're making this too complicated" — reviews author. Don't.

### Assume good intent
The author usually had a reason. Ask before criticizing.

### Praise generously when warranted
- Clever approach
- Thorough tests
- Great PR description
- Graceful handling of review feedback

30-second note to say "nice work on this — the state-machine modeling is clean." Compounds over time.

---

## 5. Review SLAs

| Label | Review SLA | Merge SLA |
|-------|-----------|-----------|
| `urgent` (security, hotfix) | < 1 h | Same day |
| `blocked-by-review` | < 4 h | Within 1 day |
| default | < 1 business day | Within 3 business days |
| `draft` | No SLA (author not ready) | — |

PR opened Friday 16:00 → reviewer expected Monday AM (not Sunday).

### What to do when SLA breaches
Author:
1. Ping reviewer in PR
2. If no response in 2 hours, message their manager
3. As last resort, find another qualified reviewer

Not: merge without review.

---

## 6. Review Checklist — What to Look At

### Correctness
- Does the code do what the PR says?
- Are edge cases handled? (null, empty list, first/last item, concurrent access)
- Are errors caught at the right layer?
- Are error messages actionable?

### Tests
- Is behavior covered at the right level (unit vs integration vs E2E)?
- Do test names describe behavior?
- Any `.only` or `.skip` committed?
- Flaky tests introduced?

### Types
- Any `any`? `as`? `!`? Justified?
- Zod schema where user input enters?
- Is type shape minimal (no over-specifying internal fields in public API)?

### Security
- Any user input parsed without validation?
- Any SQL not using Prisma?
- Any shell/file operation with user input?
- Any new external dep (check CVE history, maintenance)?
- Logging PII?

### Performance
- N+1 queries?
- Large list rendered without virtualization?
- Missing DB index for new query?
- Bundle size impact acceptable?

### Multi-tenancy
- Every Prisma query includes `tenantId`?
- RLS policy tested?
- Cache keys include tenant?

### Consistency
- Follows existing patterns in neighboring code?
- Uses existing utilities instead of reinventing?
- Naming aligns with `CODE-STANDARDS.md`?

### Docs
- Public API has JSDoc?
- ADR exists for significant decisions?
- README or runbook updated if operational impact?

### Accessibility (frontend)
- `aria-label` on icon-only buttons?
- Keyboard-operable?
- Color + icon, not color alone?
- axe-core passes on new components?

### i18n (frontend)
- No hardcoded user-visible strings?
- New strings in `messages/en-US.json`?

### Observability
- Log key business events?
- Metric emitted where useful?
- No PII in logs?

---

## 7. How Much To Block On

### Block on
- Correctness bugs
- Security issues (any)
- Missing tests
- Architectural drift (new pattern replacing a valid existing one without justification)
- Documentation gaps (missing ADR for significant decision, missing JSDoc on public API)
- Breaking changes without migration plan

### Don't block on
- Preference-level style (formatter handles it)
- "I'd do it differently" without concrete issue
- Bikeshedding names that are "fine, not my favorite"
- Additions that go beyond the PR's scope

**Rule of thumb**: would this change **hurt customers** if shipped as-is? If no → suggestion, not blocker.

---

## 8. The Review Conversation

### Author + Reviewer agree
Great; apply change + mark resolved.

### Author + Reviewer disagree
1. Author responds with reasoning
2. If still blocked, escalate to tech lead of feature area
3. Last resort: engineering manager decides
4. Outcome recorded (ADR if significant; otherwise in PR comment)

### Don't litigate in DMs
Review conversation in the PR. Durable, searchable, shared context.

### "Going in circles" — cap at 2 rounds
If a topic has 2 back-and-forth exchanges without resolution, ask a third person. Async review should not become async debate.

---

## 9. Review Anti-Patterns

| Anti-pattern | What to do instead |
|--------------|---------------------|
| "LGTM 🚀" without reading | Actually read. Review is a paid activity. |
| Rubber-stamp approvals for speed | Push back; ask for time if needed |
| Nit-picking on style while ignoring a logic bug | Lead with blockers; nits last |
| Suggesting the author rewrite the whole thing | If that's the answer, request changes + pair synchronously |
| "I'll approve when tests pass" → approve without re-reading | Re-read the final state |
| Battle over framework idiomatic vs. our-standard | Standard wins; if standard is wrong, update standard (separate PR) |
| Reviewer-as-bottleneck | Distribute reviews; no single person owns > 30% of a team's PRs |
| Ignoring stale `nit:` comments in own PR | Resolve or explicitly ignore; don't leave hanging |

---

## 10. PR Size Guidance

| Size (lines changed) | Review effort | Recommendation |
|----------------------|---------------|----------------|
| < 50 | 5–10 min | Ideal; merge same day |
| 50–200 | 15–30 min | Normal; merge within 1 day |
| 200–400 | 30–60 min | OK; split if natural boundary exists |
| 400–800 | 1–2 h | Prefer to split; still reviewable |
| 800–1500 | 2–4 h | Split. Discuss architecture before coding if this is "inevitable" |
| > 1500 | 4+ h | Split. Always. |

### Strategies for large work
- **Stacked PRs**: chain 3–5 small PRs (`feat/foo-part-1` → `feat/foo-part-2` → ...)
- **Feature flags**: ship dormant code behind a flag; enable in separate PR
- **Refactor-first**: a standalone refactor PR, then smaller feature PR on top
- **Pair programming**: drafted together, reviewed by a third

### Exceptions
- Generated code (e.g., regenerated Prisma client)
- Lockfile updates
- Large formatting / rename PRs (separate from logic changes; see `LINTING-FORMATTING.md §14`)

---

## 11. Draft → Ready → Merge Flow

```
 [branch pushed]
      │
      ▼
 ┌─────────────┐
 │   Draft PR  │  ← use when you want early feedback, but CI may be red
 └──────┬──────┘
        │ ready for review
        ▼
 ┌─────────────┐  CI green
 │   Open PR   │  ← reviewers assigned via CODEOWNERS
 └──────┬──────┘
        │ approvals + all threads resolved
        ▼
 ┌─────────────┐
 │  Merge ≠ PR │  ← **squash-merge**; title = commit message
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │ Post-merge  │  ← verify the commit lands, CI passes, deploys to dev
 └─────────────┘
```

### Merging
- **Author merges their own PR** (not reviewer)
- Must have: all approvals, CI green, all threads resolved, branch up to date
- Squash-merge with cleaned-up commit message (PR title, fixed body)
- Delete branch on merge

### Merge queue (optional — adopt Phase 2)
Auto-merges PRs serially when queue length grows; re-runs CI on each.

---

## 12. Reviewing Your Own Team Mates

### Manager reviewing reports
Fine. Same standards. Don't be softer than peer reviews; that's not kindness, it's undermining.

### Senior reviewing junior
- Extra patience on "the obvious thing"
- Pair synchronously when feedback is heavy
- Explain *why* not just *what* to change
- Recognize growth in later PRs

### Junior reviewing senior
- Your perspective is valuable — fresh eyes catch assumptions
- Questions are reviews: "Why does this need a retry?" is a valid comment
- Don't pretend to understand what you don't — ask

### Cross-team reviews
Sometimes you review code for a team you don't own. Be mindful:
- Defer on domain-specific patterns (you may not know the team's conventions)
- Focus on cross-cutting concerns (security, a11y, performance, API contract)
- Request a second reviewer from the owning team

---

## 13. Architecture Review

### When to escalate to architecture review
- New service boundary
- New data model / significant schema change
- New external dependency (paid service, SaaS)
- New runtime technology (language, framework)
- Decisions that cross multiple team boundaries

### Process
1. Author writes an ADR (see `DOCUMENTATION.md §6`) — stored in `docs/adr/`
2. ADR shared in `#architecture` Slack + posted for async review (48h)
3. If controversial, live discussion scheduled (60 min max)
4. Decision recorded in the ADR (accepted / rejected / superseded)
5. Code PR references ADR

### Who approves architecture decisions
- Small/team-local: tech lead of affected team
- Cross-team: principal engineers
- Significant investment ($100k+, strategic): engineering leadership

---

## 14. Security Reviews

See `SECURITY-TESTING.md`. Reviewer-level specifics:
- Any code in `auth/`, `billing/`, or `admin/` — at least one reviewer on security-champions list
- Any change affecting authorization logic — explicit security-review label
- External API surface changes — contract + security review together

### AppSec review trigger
- New authentication mechanism
- New webhook consumer
- New admin capability
- Any CVE handling fix
- Encryption changes

AppSec team paged; their review is blocking.

---

## 15. Performance-Sensitive PRs

Label `perf:` triggers:
- Benchmark run required (`pnpm bench:affected`)
- Reviewer checks N+1, cache effectiveness, query plan
- Optional: load test run (labeled `perf-test-required`)

---

## 16. Tooling — Making Review Painless

| Tool | Purpose |
|------|---------|
| GitHub native UI | Primary surface |
| GitHub CLI (`gh`) | Fast local workflow (`gh pr review`, `gh pr checkout`) |
| VS Code GitHub PR plugin | In-editor review |
| `gh-dash` (or similar TUI) | Fast triage |
| CI status in PR | Pipeline results inline |
| Diff viewer: unified, whitespace-ignored option | Authors resist whitespace-noise |
| Linked issue tracker (Linear) | Context on the "why" |

### Side-by-side vs unified diff
Individual preference. Tools support both.

### Re-review indicators
GitHub shows "files changed since last review" — reviewer uses this on revisit.

---

## 17. Review Metrics (Watched, Not Ranked)

Metric-led review is easy to game. We look at trends, not individuals:

| Metric | Target trend |
|--------|--------------|
| Median time-to-first-review | < 4 business hours |
| Median time-to-merge | < 1 business day |
| Avg PR size | < 300 lines |
| % PRs with < 50 lines | > 30% |
| % approvals < 10 min after opening | < 5% (higher = rubber-stamping) |
| Review coverage (who reviews what) | Distributed; no single reviewer dominates |

Reviewed in quarterly engineering retros. Outliers discussed; no PIP-style performance gating on these.

---

## 18. Post-Merge Responsibilities

### Author
- Watch CI on `main` for 30 min after merge
- If rollback needed, hit `Revert` in GitHub promptly; fix-forward in new PR
- Respond to incident if your PR caused it

### Reviewer
- If the merged change misbehaved, help investigate — not blame
- Feedback loop: "this is what I missed; here's a pattern to look for next time"

---

## 19. Growing Reviewers

### New engineer first 30 days
- Paired reviewer (senior) reviews same PRs; junior's review is training ground
- Debrief weekly: "what would you have asked about here?"

### After 90 days
- Reviewer in their own right for team code
- Cross-team reviews start at 6 months

### Reviewer growth explicit
- Promotion criteria include review quality + volume
- Regular check-ins on "what's a good review?"

---

## 20. What We Don't Do

- **Ship without review** (except rare emergency hotfix — escalated, logged)
- **Pre-approve** ("approve-before-you-push")
- **Merge-freeze just because a reviewer is unavailable** (find another)
- **Merge our own PR without review** (except the rare `chore:` lockfile bump — and even those get ping-for-review)
- **Reject PRs without explaining why** (specific blocker reason always)
- **Ghost PRs** (either engage or unassign)
- **Gatekeep "the one true way"** — standards set floor; reviews don't enforce personal preference

---

## 21. Related Documents

- `CODE-STANDARDS.md` — standards this review applies
- `LINTING-FORMATTING.md` — tools handle mechanical stuff
- `TESTING-STRATEGY.md` — what tests reviewer looks for
- `SECURITY-TESTING.md` — security review specifics
- `DOCUMENTATION.md` — ADR process
- `QUALITY-GATES.md` — what must pass for merge
