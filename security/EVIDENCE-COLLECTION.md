# Evidence Collection — Continuous Compliance

> Drata / Vanta automates evidence collection across our systems. Maps evidence to SOC 2, ISO 27001, HIPAA, GDPR controls. Turns "annual audit scramble" into "pull reports from the tool." The infrastructure of compliance.

---

## 1. Why Evidence Automation

Manual evidence collection fails at scale:
- 100+ controls × multiple frameworks = hundreds of evidence items
- Auditors want fresh evidence (not 10-month-old screenshots)
- Humans forget, drift, skip
- Scramble at audit time = exhausted team, findings for missed items

Drata / Vanta (and competitors) integrate with our stack, pull evidence continuously, map it to frameworks, alert on gaps.

Result: **audit prep is sampling, not collecting.**

---

## 2. Platform Choice

Market leaders (all reasonable):

| Platform | Strength | Weakness |
|----------|----------|----------|
| **Drata** | Rich integrations, UX, customer testimonials | Pricing grows with scale |
| **Vanta** | Market presence, partner ecosystem | Some prefer Drata's UX |
| **Secureframe** | Competitive pricing, active development | Smaller ecosystem |
| **Sprinto** | Cost-effective for early stage | Fewer integrations |
| **Tugboat Logic / OneTrust** | Enterprise + privacy breadth | More complex |
| **Thoropass (Laika)** | Auditor-integrated | Newer |

### Our choice (Phase 2)
**Drata or Vanta** — equivalent for our scale. Pick one, commit for 2+ years. Migrating later is painful (integrations, history, mappings).

### Evaluation criteria
- Frameworks supported (SOC 2, ISO 27001, HIPAA, GDPR, CCPA, FedRAMP)
- Integrations with our stack (AWS, GitHub, Okta, Slack, Jira/Linear, Datadog, Sentry, Snyk, etc.)
- Policy library (templates + customization)
- Evidence automation depth (auto-collection vs manual upload)
- Risk management module
- Vendor risk module
- Customer trust center integration
- Questionnaire automation
- Pricing (scales with users / integrations)
- Auditor integration (most major auditors directly consume)
- Support responsiveness

---

## 3. What Gets Automated

### Identity + Access
- SSO integration (Okta / Google Workspace)
- MFA enrollment %
- Password policy screenshots
- Offboarding timeliness (HRIS + SSO correlation)
- Admin action audit logs
- Access review completions

### Code + Change Management
- GitHub: PR approval rates, branch protection config, commit signing
- Merge-commit metadata
- Code review records
- CI / CD audit trail

### Infrastructure
- AWS: Config rules, CloudTrail, IAM state, security group evidence
- Kubernetes: admission policy evidence
- Terraform: drift detection evidence
- Backup execution logs

### Security
- Vulnerability scan results (Snyk, Semgrep)
- Patch status (days-to-patch metrics)
- Pen test report + retest evidence
- SBOM artifacts
- Image scan logs

### Availability
- Uptime metrics (from status page or observability)
- Incident records
- DR drill evidence (runbook output)
- Backup verification

### HR / People
- Training completion (from training platform)
- Background check completion
- Acknowledgment of AUP + policies
- Offboarding checklists
- Hiring approval records

### Privacy
- DSR response timeliness
- Breach response evidence
- Consent records

### Vendor Risk
- Vendor questionnaires
- DPA tracking
- Subprocessor updates

### Incidents
- Incident records
- Postmortems
- Action item closure

---

## 4. Integration Map (Illustrative)

```
  Drata / Vanta
       │
       ├── AWS (CloudTrail, Config, IAM, EKS)
       ├── GitHub (PRs, branch protection, audit)
       ├── Okta (users, MFA, login, offboarding)
       ├── Google Workspace (backup IdP + email)
       ├── Slack (admin + access evidence, incident channels)
       ├── Jira / Linear (incidents, tasks)
       ├── Snyk (vuln scan)
       ├── Semgrep (SAST)
       ├── Sentry (errors, release tracking)
       ├── Datadog / Grafana (monitoring)
       ├── AWS Inspector (CVE on instances)
       ├── Intune / Jamf / Kandji (MDM for endpoints)
       ├── HRIS (Rippling / BambooHR / Gusto) — hire/fire
       ├── KnowBe4 (training)
       ├── DocuSign (NDA + policy signatures)
       ├── Zendesk / Intercom (support - for DSR tracking)
       └── (More as added)
```

### Effort
Initial: 1 FTE × 1 month to wire. Ongoing: a few hours / week.

---

## 5. Policy Library

Drata / Vanta ship 50+ policy templates. We customize:
- Use template as starting point
- Edit for our context
- CISO approves
- Tool signs + dates + tracks
- Employees acknowledge (click-through) — also tracked

Our custom policies (this folder) replace corresponding templates where we want specificity beyond vendor default.

### Employee acknowledgment workflow
- New hire: onboarding flow signs all applicable policies
- Annual: reaffirmation on changes
- Tracked: who signed what when

---

## 6. Control Monitoring

Drata / Vanta define controls, map to framework criteria, set automated tests. Example:

### Control: MFA Enforced on Production Access
- **Framework mapping**: SOC 2 CC6.1, ISO 27001 A.5.17, HIPAA §164.308(a)(5)
- **Test**: query Okta API weekly — all users in "Production-Access" group have MFA factor enrolled
- **Expected**: 100%
- **On failure**: Slack alert + Jira ticket to Security team
- **Evidence retained**: last 90 days of query results

Hundreds of such controls. Tool runs tests; humans respond to failures.

### Failure handling
- **Real failure** → remediate + document
- **False positive** → refine test / exception
- **Expected exception** (e.g., service account without MFA) → document exception with approval

---

## 7. Continuous vs Point-In-Time Evidence

### Point-in-time
Manual screenshot, policy version, SBOM snapshot. Fine for:
- Annual policy approvals
- Training completion at end of year
- DR drill report

### Continuous
Live integration pulling evidence daily/weekly. For:
- Access control enforcement
- Vulnerability scan results
- Change management records

### Balance
Auditors prefer continuous (stronger). Some controls are inherently point-in-time. Drata / Vanta handle both.

---

## 8. Audit Workflow

### Pre-audit
1. Announce audit scope + period with auditor
2. Auditor given read-only access to Drata / Vanta
3. Auditor reviews control design + evidence catalog
4. Gap review — we plug holes

### During audit
1. Auditor samples evidence from Drata / Vanta directly (less back-and-forth)
2. Auditor samples from sources (sometimes verifies tool isn't misleading)
3. Interview staff
4. Review management processes (meeting minutes, committee decisions)

### Post-audit
1. Draft findings → management response
2. Final report
3. Publish to trust center

### Auditor-integrated tools
Most Drata / Vanta partner auditors can read their platform directly — further reduces friction.

---

## 9. Evidence Retention

### Per control
- Active collection window: platform manages (typically 12-24 months)
- Annual archive: evidence snapshots archived to S3 (long-term, immutable)
- Retention: 7 years minimum (SOC 2 + ISO)

### Legal holds
- Litigation-related evidence preserved beyond normal retention
- Tracked separately by Legal

### Exit / vendor change
- Export all evidence before switching tools
- Store in our own S3 + maintain access
- Avoid lock-in even with tool investment

---

## 10. Exceptions Register

Continuous tracking:
- **Exception ID**
- **Control** not met
- **Reason** (technical limitation, risk-accepted, compensating control)
- **Approver** (CISO / VP / CEO per severity)
- **Expiry date** (max 90 days; renewable)
- **Compensating control**
- **Review evidence** (who verified compensating control is operating)

Auditors review. Patterns flag — if same area always exceptioned, policy may be wrong.

---

## 11. Metrics from Evidence Platform

Dashboards show:
- Control operating effectiveness: target 100% (allow 1-2% failure with investigation)
- Employee policy acknowledgment: 100%
- Training completion: 100%
- Time from finding to remediation: per SLA
- Open risks: trending down
- Vendor assessments current: 100%
- DSR response timeliness

Monthly Security Steering Committee reviews; quarterly deep-dive.

---

## 12. Customer Trust Center Integration

Drata / Vanta trust center modules pull live:
- Current compliance badges
- Subprocessor list (from vendor register)
- Policy list
- Status of controls (summarized, not detailed)
- Document access gating + NDA flow

Saves running a separate CMS for trust.aims.io.

---

## 13. Security Questionnaire Automation

Drata / Vanta have questionnaire tools:
- Library of common question-answer pairs
- Match incoming questionnaire → pre-filled responses
- Flag new questions (human writes; added to library)
- Collaboration with Sales / CS

Reduces questionnaire response time from weeks to days.

---

## 14. Limitations of Evidence Platforms

### What they do well
- Integrate widely
- Map controls to frameworks
- Automate evidence collection
- Policy + acknowledgment tracking
- Alert on drift
- Trust center + questionnaire helpers

### What they don't do
- Actual security (you still need good controls)
- Judgment on exceptions (humans decide)
- Framework-specific nuance in all cases (auditor judgment matters)
- Forensics + incident response execution
- Customer-specific custom controls (some configurable)

Tool is scaffolding; program is the building.

### Failure modes
- Over-reliance ("Drata says green → we're green") — verify independently
- Stale integrations (token expired, missing evidence)
- Custom-controls drift (tool doesn't know about them)
- Exceptions accumulating — tool tracks, humans ignore

Regular (monthly) health check of the platform itself.

---

## 15. Cost

### Direct
- Drata / Vanta: $8k-$30k/year (scales with employees + integrations + frameworks)
- Auditor integration: usually included
- Add-ons: vendor risk, privacy modules may cost extra

### Indirect
- 1 FTE (or 0.5) to operate the tool
- Time saved on audits (vs no tool): 50-70% reduction in audit prep time

ROI typically positive from Year 1 as soon as first audit is done with it.

---

## 16. Running Without A Platform (Anti-Pattern)

For truly early-stage:
- Spreadsheets + Notion + manual screenshots
- Works for <20 person teams, single framework
- Breaks at scale; breaks at audit

Do not ship to enterprise without Drata / Vanta. Table stakes by Phase 2.

---

## 17. Multi-Framework Mapping

Same evidence → multiple framework controls. Drata / Vanta do this automatically:

```
  Evidence: "Weekly Okta MFA enrollment report"
     │
     ├── maps to SOC 2: CC6.1, CC6.2
     ├── maps to ISO 27001: A.5.17, A.8.5
     ├── maps to HIPAA: §164.308(a)(5)(ii)(D)
     ├── maps to GDPR: Art. 32(1)(b) (via security-of-processing evidence)
     └── maps to FedRAMP: IA-2(1), IA-2(2) (Phase 6)
```

One evidence item, five frameworks satisfied.

---

## 18. Staff Workflow

Drata / Vanta embed into daily work minimally:
- Onboarding: auto-adds to tool; employee signs policies
- Regular: occasional re-acknowledgment
- Training: completion syncs
- Offboarding: HR → disable → evidence captured

Security team:
- Daily: check alerts
- Weekly: review failing controls
- Monthly: full dashboard review + metrics
- Quarterly: exception review + steering committee prep
- Annually: audit prep + conducting

Most employees interact rarely. Security + CISO live in it.

---

## 19. Runbook: New Framework Rollout

When adding a framework (e.g., HIPAA Phase 5):
1. Enable framework in Drata / Vanta
2. Review mapped vs unmapped controls
3. Fill unmapped with new policies / procedures
4. Configure new integrations if needed
5. Pilot period: monitor for gaps
6. Full audit when ready

Tool accelerates but doesn't replace the scoping + implementation work.

---

## 20. Auditor Observations

Things auditors notice (positive + negative):
- **Positive**: live evidence, thorough history, clean exception register, fast responses
- **Negative**: stale evidence, undocumented exceptions, policy-reality mismatch, last-minute submissions

Continuous platform use produces the positive.

---

## 21. Related Documents

- [`SOC2.md`](SOC2.md) — framework that evidence supports
- [`ISO27001.md`](ISO27001.md) — same
- [`HIPAA.md`](HIPAA.md) — same
- [`PRIVACY.md`](PRIVACY.md) — privacy evidence
- [`SECURITY-PROGRAM.md`](SECURITY-PROGRAM.md) — governance this supports
- [`TRUST-CENTER.md`](TRUST-CENTER.md) — customer-facing outputs
- [`POLICIES.md`](POLICIES.md) — policy library in Drata
- `implementation/policies/` — policy templates
