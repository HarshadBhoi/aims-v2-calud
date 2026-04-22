# Security Testing

> Layered security testing program: SAST + SCA on every PR, DAST + container scans continuously, annual third-party pen test, vulnerability disclosure + (Phase 3) bug bounty. Responsible disclosure process; VEX attestation for SBOM.

---

## 1. Program Overview

```
  Layer                 Frequency           Owner               Outcome
  ────────────────────  ─────────────────  ────────────────    ───────────────────
  SAST (Semgrep, CodeQL)Every PR            Every engineer      Blocks merge (H+)
  SCA (Snyk, Dep-bot)   Every PR + daily    Every engineer      Blocks merge (H+)
  Secrets (gitleaks)    Pre-commit + CI     Every engineer      Blocks merge (any)
  Container scan (Trivy)Every image build   Every engineer      Blocks merge (H+)
  IaC scan (tfsec)      Every TF change     Platform            Blocks merge (H+)
  DAST (ZAP)            Weekly staging      AppSec              Findings → issues
  Pen test (external)   Annual + major rel  AppSec + vendor     Report + fix plan
  Red team exercise     Annual              Security            Report + program
  Vuln disclosure       Continuous          AppSec              SLA-driven
  Bug bounty (Phase 3)  Continuous          AppSec              Payouts + fixes
  Compliance audit      Annual              Compliance          SOC 2, ISO 27001
```

Every layer catches a different class of issue. Gaps in one are covered by others.

---

## 2. SAST — Static Application Security Testing

### Semgrep
Primary SAST for application code. Runs on every PR.

Rulesets:
- `p/owasp-top-ten` (generic)
- `p/typescript` (TS-specific anti-patterns)
- `p/nodejs` (Node ecosystem)
- `p/react` (JSX XSS, dangerouslySetInnerHTML)
- `p/secrets` (inline credentials)
- `r/javascript.lang.security.*`
- Custom rules in `.semgrep/rules/` for AIMS-specific concerns:
  - Direct SQL (we use Prisma; raw SQL needs reviewer approval)
  - Skipping auth middleware on a procedure
  - Returning raw error objects to clients
  - Logging of known-PII fields

Findings above **medium** block merge. Acknowledged findings can be waived in `.semgrepignore` with justification + reviewer approval.

### CodeQL
Secondary SAST; GitHub-native, deeper data-flow analysis. Runs on every PR + nightly on `main`. Catches things Semgrep misses (taint-flow bugs, injection patterns across modules).

Findings above **high** block merge; **medium** reported to team, triaged weekly.

### What SAST Catches
- Injection vulnerabilities (SQLi, XSS, command injection)
- Insecure deserialization
- Hardcoded secrets
- Use of deprecated crypto (`md5`, `sha1` for security)
- Missing authorization checks
- Unsafe regex (ReDoS)
- Type confusion

### What SAST Misses (and why other layers exist)
- Business-logic flaws (e.g., "a staff auditor can submit their own approval")
- Runtime-only issues (e.g., environment-dependent paths)
- Third-party dependency vulnerabilities (SCA does this)
- Infrastructure misconfigurations (IaC scan does this)

---

## 3. SCA — Software Composition Analysis

### Snyk
Primary SCA. Runs on every PR + daily against `main`.

Scope:
- All JS/TS dependencies (pnpm-lock.yaml)
- Dockerfile base image analysis
- Integration with IDE (VS Code plugin) for pre-commit feedback

Severity gates:
- **Critical**: merge blocked; fix immediately; security-ticket P1
- **High**: merge blocked; fix within 7 days
- **Medium**: non-blocking; fix within 30 days
- **Low**: tracked; batched quarterly

Exceptions via `.snyk` file require: CVE id, risk justification, mitigation, expiry (≤ 90 days).

### Dependabot
Automated PRs for dep updates:
- Security-only PRs (critical + high) auto-created, auto-merge via bot if CI passes
- Minor/patch grouped weekly by ecosystem
- Major version bumps manual (may need code changes)

### pnpm audit
Belt-and-suspenders; runs in CI. Fails build on `--audit-level=high`.

### License Compliance
- FOSSology or Snyk Licenses — ensures no GPL / AGPL in a proprietary SaaS
- Allowlist: MIT, Apache-2.0, BSD-*, ISC, MPL-2.0 (with review)
- Blocklist: GPL-*, AGPL-*
- Unknown / missing LICENSE → block until resolved

---

## 4. Secrets Scanning — gitleaks

### Layer 1: Pre-commit (Husky)
```bash
# .husky/pre-commit
gitleaks protect --staged --no-banner
```
Catches most secrets locally before push.

### Layer 2: CI
Full repo scan on every PR. Different config (more patterns, deeper history).

### Layer 3: GitHub native
GitHub's secret scanning scans pushed commits. Partner program auto-revokes known key formats (AWS, Stripe, GitHub PATs).

### Layer 4: TruffleHog (monthly, full history)
Deep scan including deleted branches, orphan commits. Sometimes finds what 1-2-3 missed.

### If a secret is detected post-push
**Immediate** (per `devops/SECRETS.md §11`):
1. Rotate the secret
2. Scan for evidence of use (CloudTrail, service logs)
3. Rewrite history? **No** — git history is public record; rotating is the fix
4. Security team notified; postmortem within 48h

---

## 5. Container Scanning — Trivy

Every image built in CI is scanned by **Trivy**:
- OS package CVEs
- Application dep CVEs (language-specific)
- Dockerfile best-practice violations
- Secret leakage in layers
- License issues

Gate: **CRITICAL + HIGH** block merge (with `--ignore-unfixed` — unfixed CVEs don't block if no patch exists).

Images signed with Cosign before push (see `devops/CI-CD.md §10`). Unsigned images rejected by Kyverno at cluster admission.

### Registry-level scan (ECR Enhanced)
Continuous rescans as new CVEs published. Alerts if an image in-use has newly-disclosed critical CVE → runbook to roll out patch or mitigate.

### Base image hygiene
- Distroless bases (see `devops/CONTAINERS.md §2`)
- Pinned by digest (not tag) — reproducible, tamper-evident
- Rebuilt weekly to absorb upstream security fixes

---

## 6. IaC Scanning — tfsec + Checkov + Kyverno

### tfsec + Checkov (Terraform)
On every PR that touches `terraform/`:
- tfsec (focused on AWS misconfigs: public S3, open SGs, IAM wildcards)
- Checkov (broader: compliance rulesets mapped to SOC 2, HIPAA, CIS)

Gate: **high+** blocks merge.

### Kyverno (runtime, on k8s admission)
Continuous enforcement in cluster:
- Deny privileged containers
- Require signed images
- Require resource limits
- Deny `hostPath`, `hostNetwork`
- Enforce NetworkPolicy existence per namespace

Violations rejected at admission — can't deploy insecure workloads even if CI missed it.

---

## 7. DAST — Dynamic Application Security Testing

### OWASP ZAP
Weekly automated scan against **staging** environment.

Scope:
- Baseline scan: passive + safe active checks (no destructive)
- Full scan: quarterly, scheduled; some payloads destructive — run with care
- API scan (uses OpenAPI spec): endpoint-level fuzzing

Findings → tickets → triaged weekly.

### Nuclei (supplementary)
Template-based active scan (thousands of checks for known CVEs). Runs monthly.

### What DAST catches that SAST doesn't
- Configuration issues only visible at runtime (headers, cookies, TLS)
- Behavioral issues (rate-limit absence, auth bypasses via parameter tampering)
- Third-party-introduced issues (WAF rules, CDN caching headers)

### Running DAST safely
- **Never against production** (risk of destructive payloads + noise in real data)
- Staging with synthetic data only
- Coordinated with on-call (avoid false pages during scans)
- Authenticated scans (provide ZAP with test tenant + user)

---

## 8. Pen Test — External Firm

### Cadence
- **Annual comprehensive pen test** — external boutique firm (CrowdStrike, Bishop Fox, NCC, or similar)
- **Per-major-release targeted test** — when a significant area changes (new auth flow, new public API)
- **On-demand** when contractually required by customer (e.g., enterprise onboarding)

### Scope
Each engagement scoped to a specific target:
- Full-stack SaaS (web + API + infra)
- Auth subsystem (MFA, SSO, session management)
- Multi-tenant isolation (RLS, per-tenant key boundaries)
- Compliance-relevant (HIPAA, FedRAMP prep)

### Deliverables
- Executive summary (for customers + leadership)
- Technical findings + reproduction steps
- Severity ratings (CVSS)
- Remediation guidance
- Retest after fix — included in engagement

### Response SLA by severity
- **Critical**: fix within 7 days; prefer < 48h
- **High**: fix within 30 days
- **Medium**: fix within 90 days or accept risk with documented rationale
- **Low**: batched with regular work

### Pentest prep runbook
In `devops/runbooks/pentest-prep.md`:
- Create dedicated test tenant + credentials
- Seed representative data
- Provide SDK / API docs
- Freeze non-security deploys during engagement
- Daily standup with pentest lead

---

## 9. Vulnerability Disclosure Policy

Public `security.txt` at `https://aims.io/.well-known/security.txt`:

```
Contact: security@aims.io
Expires: 2027-04-20T00:00:00Z
Acknowledgments: https://aims.io/security/hall-of-fame
Policy: https://aims.io/security/vdp
Preferred-Languages: en
```

### VDP Scope
- In scope: our production services, our open-source repos, our SaaS web app + API
- Out of scope: phishing attempts, vendor-provided services (hosted email, payment processor — report to them), DoS/DDoS, social engineering of employees

### Response SLA
- Acknowledgment of receipt: **24 hours**
- First triage: **72 hours**
- Disclosure timeline: coordinated; default 90 days to remediation before public disclosure

### Safe harbor
Research in good faith within scope is not pursued legally. Details in public VDP doc.

---

## 10. Bug Bounty (Phase 3)

### Platform
**HackerOne** or **Intigriti** — managed triage reduces operational load.

### Scope
Narrower than VDP. Critical assets only:
- Production web + API
- Auth subsystems
- Public REST API
- Mobile app (if we have one)

### Payouts
Market rates benchmarked annually. Example starting scale:
- Critical (RCE, auth bypass, cross-tenant data access): $5000–$25,000
- High (privilege escalation, PII leak): $1,500–$7,500
- Medium (CSRF, XSS, unauthorized action): $250–$1,500
- Low (best-practice): $50–$250

Amounts adjust with impact + quality of report.

### Program rules
- Test tenant provided (never real customer data)
- No auto-scanners without coordination (duplicates + noise)
- No destructive payloads on live endpoints
- Findings disclosed after fix

### Why Phase 3
Bug bounty before a mature security baseline = overwhelming noise. We need:
- Clean SAST/SCA baseline
- Mature pen test history
- Staffed AppSec team capable of triaging
- Product mature enough to have "interesting" attack surface

Target: bug bounty launch Phase 3 (~18 months post-GA).

---

## 11. Red Team Exercise

### What
Annual simulated attack: an external firm attempts to achieve specific goals (e.g., "access a specific tenant's findings") using any non-physical method.

### Differs from pen test
- Pen test: scoped technical assessment of system X
- Red team: goal-oriented, any tactic (social eng, supply chain, phishing, techincal)

### Blue team response
Our security team responds as if real. Measures: did we detect? How fast? What worked, what didn't?

### Outcome
- Full report of attack paths
- Gaps in detection
- Training curriculum updates
- Annual report to board

---

## 12. Tabletop Exercises

Monthly. No system access — just a scenario + the team walks through response.

Examples:
- "A disgruntled engineer deleted their SSO role but kept an active session. They are exfiltrating data. What happens?"
- "A zero-day in Node.js is announced. How fast do we patch? What if the fix is in Node 22.13 and we're on 22.11?"
- "Tenant admin reports unauthorized finding modifications. Audit log shows their user did it. They deny. Investigate."

Builds muscle memory + identifies gaps in runbooks.

---

## 13. Compliance Audits

### SOC 2 Type II (Phase 5)
- Annual audit after Type I (Phase 4)
- External auditor (Big 4 or specialist) tests controls over 12-month period
- Evidence collection automated via Drata / Vanta
- Output: SOC 2 report available under NDA to customers

### ISO 27001 (Phase 5)
- Certification audit annual
- Internal audit quarterly
- Stage 1 + Stage 2 external audits
- Output: ISO 27001 certificate

### FedRAMP Moderate (Phase 6)
- 3PAO assessment
- Continuous monitoring
- Annual re-authorization

### Pen test + SAST / SCA / IaC scan findings feed compliance evidence. Dual-use: security tests are audit evidence.

---

## 14. Security Champions Program

### Role
Each team has one volunteer "security champion" (not a separate security engineer):
- Attends weekly AppSec sync
- Reviews SAST / SCA findings for team's area
- Ambassador for security practices
- Rotates annually

### Training budget
- Annual security training (3 hours, mandatory for engineers)
- OWASP Top 10 refresher
- Champions get additional training: offensive sec fundamentals, secure code review

### Benefits
- Security is distributed; AppSec team stays small
- Teams own their findings
- Faster triage (someone familiar with the code)

---

## 15. Threat Modeling

See also `auth/SECURITY.md` for auth-specific threats (STRIDE model already done).

### When to do threat modeling
- New architectural component (new service, new data flow)
- Major refactor of trust boundary
- New 3rd-party integration
- Compliance audit prep

### Process
- 60–90 min workshop with service owner + AppSec + SRE
- Data flow diagram on the whiteboard
- STRIDE per trust boundary
- Output: risk ledger in `security/threat-models/`
- Mitigations logged as tickets

### Lightweight version
Every ADR that introduces a new trust boundary has a "Threats considered" section. For routine changes this is enough.

---

## 16. Incident Response (Security Specifics)

General incident flow in `devops/RUNBOOKS.md §4`. Security-specific additions:

### Security incident declaration
- Any suspected breach, data exfiltration, or authz bypass → security incident (higher bar than availability)
- CISO/Security lead informed within 30 min
- Legal informed within 1 hour if customer data potentially impacted

### Preservation
- Do not "clean up" a compromised environment immediately — preserve evidence
- Capture system state (EC2 snapshots, pod dumps, logs)
- Chain of custody for any forensic artifacts

### Regulatory notifications
- GDPR: 72 hours to regulator if PII breach
- State-specific (US): varies; DPO decides
- Customer contracts may impose shorter windows

### Public disclosure
- Not until coordinated with affected customers
- Draft approved by Legal + CEO
- Statuspage + blog post
- Hall of shame ≠ our name if we acted well

---

## 17. Metrics We Track

| Metric | Target | Current |
|--------|--------|---------|
| Mean time to triage SAST finding | < 2 business days | TBD |
| Mean time to remediate Critical CVE | < 48 h | TBD |
| Mean time to remediate High CVE | < 7 d | TBD |
| % PRs blocked by security gate | < 5% | TBD |
| Unpatched High+ CVEs older than SLA | 0 | TBD |
| Pen test findings above Low | Trending down YoY | — |
| Bug bounty findings | (Phase 3) | — |
| Security training completion | 100% | — |

Reported to engineering leadership monthly; to board annually.

---

## 18. What We Do Not Do

- **No security-theater gates** — every gate catches real issues or it goes
- **No relying on SAST alone** — layered defense only
- **No security reviews at end of project** — integrated from design
- **No blocking on Low CVEs** — triage + batch, don't paralyze releases
- **No "just ignore that finding"** — document + mitigate, expire exceptions
- **No production pen tests** without explicit customer notice + approval
- **No blame culture for pen test findings** — they're data; ownership is the team's, not the individual's

---

## 19. Related Documents

- `../auth/SECURITY.md` — STRIDE threat model, auth-specific threats
- `../devops/CI-CD.md` — security tools in pipelines
- `../devops/SECRETS.md` — secrets lifecycle
- `../devops/INFRASTRUCTURE.md` — SCPs, network security
- `REVIEW.md` — security review in PRs
- `TECH-DEBT.md` — tracking + expiring security debt
