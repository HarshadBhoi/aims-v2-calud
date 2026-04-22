# SOC 2 Program

> SOC 2 Type II is the US enterprise trust baseline. This doc covers our scope selection, Trust Service Criteria (TSC) mapping, Type I → Type II sequencing, audit management, and the specific controls we operate.

---

## 1. What SOC 2 Is (and Isn't)

SOC 2 = Service Organization Controls 2, defined by AICPA. An independent CPA firm examines our controls against the Trust Services Criteria and issues a report.

### Types
- **Type I**: Design of controls at a point in time. "Does the design meet TSC?"
- **Type II**: Operational effectiveness over a period (typically 6–12 months). "Did the controls actually work?"

### What SOC 2 is NOT
- Not a certification (it's an attestation, issued as a report)
- Not a pass/fail (the report documents findings and deficiencies)
- Not cross-industry mandatory (but often contractually required by US enterprise)
- Not a substitute for doing security well (you can pass with imperfect security; you can fail with good security if evidence isn't produced)

---

## 2. Trust Service Criteria (TSC)

Five criteria categories. **Security is always required**; others are optional but increase customer trust.

| Category | Required? | What it covers |
|----------|-----------|----------------|
| **Security** (CC — Common Criteria) | Always | Access, change mgmt, risk mgmt, monitoring |
| **Availability** (A) | Optional | System uptime, DR, performance |
| **Confidentiality** (C) | Optional | Protection of non-public info |
| **Processing Integrity** (PI) | Optional | Completeness + accuracy of processing |
| **Privacy** (P) | Optional | Collection, use, retention, disclosure of personal info |

### AIMS scope
- Phase 2 Type I: **Security + Availability + Confidentiality**
- Phase 3 Type II: Same
- Phase 4+: Consider adding **Privacy** TSC (when GDPR program matures + if customers ask)
- **Processing Integrity** not pursued (not directly relevant — we don't process "transactions" in the financial sense)

---

## 3. Common Criteria (Security) — What's In It

Nine CC groups. Each has sub-criteria (CC1.1, CC1.2, etc.). Total ~40 criteria.

### CC1 — Control Environment (tone at the top)
- CC1.1 — Integrity + ethical values
- CC1.2 — Board of Directors / oversight
- CC1.3 — Structures, authorities, responsibilities
- CC1.4 — Competence (hiring, training)
- CC1.5 — Accountability

### CC2 — Communication + Information
- CC2.1 — Quality of information
- CC2.2 — Internal communication
- CC2.3 — External communication (customers, partners)

### CC3 — Risk Assessment
- CC3.1 — Risk identification (objectives + risks)
- CC3.2 — Risk analysis
- CC3.3 — Fraud risk
- CC3.4 — Assessing changes in risk

### CC4 — Monitoring Activities
- CC4.1 — Ongoing + separate evaluations
- CC4.2 — Deficiency communication + remediation

### CC5 — Control Activities
- CC5.1 — Selection + development of controls
- CC5.2 — Technology general controls
- CC5.3 — Deployment via policies + procedures

### CC6 — Logical + Physical Access
- CC6.1 — Logical access (authentication)
- CC6.2 — Registration + authorization
- CC6.3 — Removal of access
- CC6.4 — Physical access
- CC6.5 — Data disposal
- CC6.6 — Perimeter + prevention
- CC6.7 — Data in transit
- CC6.8 — Malicious code

### CC7 — System Operations
- CC7.1 — Vulnerability mgmt
- CC7.2 — Anomaly detection
- CC7.3 — Incident response
- CC7.4 — Incident resolution
- CC7.5 — Recovery

### CC8 — Change Management
- CC8.1 — Changes authorized, tested, documented

### CC9 — Risk Mitigation
- CC9.1 — Vendor + third-party risk
- CC9.2 — Business disruption

---

## 4. Availability TSC (A)

- **A1.1** — Environmental protections (hosting provider covers; we inherit)
- **A1.2** — Monitoring + capacity
- **A1.3** — Recovery (BCP + DR)

Our BCP/DR (`devops/DISASTER-RECOVERY.md`) directly satisfies.

---

## 5. Confidentiality TSC (C)

- **C1.1** — Identification + maintenance of confidential info
- **C1.2** — Disposal / destruction

Data classification + retention + encryption satisfy.

---

## 6. Our Control Matrix (Illustrative Subset)

Every TSC criterion mapped to a control in our environment. Example:

| TSC | Our control | Implementation | Policy | Evidence |
|-----|-------------|----------------|--------|----------|
| CC6.1 | MFA required for all access | Okta enforcement | Access Control | Okta audit log |
| CC6.1 | Password strength requirements | Okta policy | Authentication | Okta config snapshot |
| CC6.2 | New user onboarding → access request → approval | HR + IT onboarding | Onboarding | Jira tickets |
| CC6.3 | Offboarding within 1 business day | Automated via HR → SSO disable | Offboarding | HRIS + Okta events |
| CC6.6 | Network segmentation | VPC + NACLs + SGs | Infrastructure | Terraform + AWS Config |
| CC6.6 | WAF for public endpoints | AWS WAFv2 | Infrastructure | Terraform + WAF log |
| CC6.7 | Data in transit encrypted | TLS 1.3 everywhere | Encryption | Cert + config |
| CC6.8 | Malware protection | EDR on endpoints; container scan | Endpoint | CrowdStrike (or similar) + Trivy |
| CC7.1 | Vuln scanning | Snyk + Semgrep + Trivy + ZAP | Vulnerability Mgmt | Tool dashboards |
| CC7.2 | Anomaly detection | GuardDuty + Sentry + custom alerts | Monitoring | Alert history |
| CC7.3 | Incident response plan | Documented + drilled | Incident Response | Drill records |
| CC7.5 | DR procedure | Documented + tested | BCP/DR | Drill records |
| CC8.1 | Change mgmt — code | PR review + CI gates | Change Mgmt | GitHub approvals |
| CC8.1 | Change mgmt — infra | Terraform + OIDC + CI | Change Mgmt | Terraform audit |
| CC9.1 | Vendor risk assessment | Onboarding questionnaire + DPA | Third-Party Risk | Vendor register |
| A1.2 | Monitoring + capacity | Grafana + SLO alerts | BCP | Dashboards |
| A1.3 | DR drill annual | Quarterly scenarios; annual live | BCP | Drill records |
| C1.1 | Data classification enforced | Labels + access controls | Data Classification | Labels + DLP |
| C1.2 | Data disposal procedures | Offboarding + termination | Data Retention | Certificates |

Full matrix lives in Drata / Vanta. Hundreds of control-evidence pairings.

---

## 7. Type I — What It Takes

### Prep (3–4 months)
- Policies authored + approved
- Controls implemented (may already be — just documenting)
- Evidence-generating tools integrated with Drata / Vanta
- Staff trained
- Pen test completed (findings addressed)
- Vendor DPAs signed
- Risk register + Risk assessment
- Remediation of any gaps
- Pre-audit readiness assessment (we do this internally)

### Audit (1–2 months)
- Kickoff meeting with auditor
- Description of system
- Controls walk-through
- Sample-based testing (yes, even for Type I — "does each control exist at this point?")
- Management interviews (sample staff)
- Report draft → review → final

### Output
- SOC 2 Type I report
- Usable as of report date
- Signals to customers we're progressing

### Common Type I findings
- Policy-control misalignment (policy says X, control does Y)
- Missing approval trails
- Gaps in vendor documentation
- Training not documented

All fixable; enters Type II with better posture.

---

## 8. Type II — What It Takes

### Observation window
Typically **6 to 12 months**. We choose 12 for stronger signal.

### During observation
Controls **must operate throughout**. Not "be present" — but produce evidence throughout:
- Quarterly access reviews actually happened
- All PRs went through review
- All deploys followed change-mgmt
- Incidents (if any) followed IR process
- Vendor reviews happened on schedule
- Training completed by all staff

Any gap = auditor calls out in findings.

### Sample-based testing
Auditor samples X% of each control population:
- 25 of 200 onboarded users → verify approval flow
- 40 of 500 PRs → verify review
- 15 of 30 deploys → verify change approval
- 10 of 50 incidents → verify IR process followed

### Auditor deliverables
- Sampling methodology
- Evidence collection + verification
- Interview staff
- Review tooling (Drata / Vanta) for continuous evidence
- Draft report → management response → final

### Findings categorization
- **Unqualified opinion** (clean) — preferred
- **Qualified opinion** — material deficiency in one or more controls
- **Adverse opinion** — pervasive deficiencies (rare; disastrous)
- **Disclaimer** — auditor can't form opinion (e.g., insufficient evidence)

Most mature programs get unqualified. Working toward qualified at worst; never adverse.

### Management response
For any finding, management's response documented in the report. Template:
- Acknowledge finding
- Root cause
- Remediation plan
- Timeline
- Responsible party

---

## 9. Continuous Compliance During Type II

Not cram. Continuous. Daily / weekly activity:

### Daily (automated + review)
- Drata / Vanta sync (AWS, Okta, GitHub, Slack)
- Alert on any failing control (e.g., new admin added without approval)

### Weekly
- Failed / at-risk controls review
- Evidence collection audit
- Minor gaps addressed

### Monthly
- Control operating effectiveness review
- Policy exception review
- Compliance metrics to Security Steering Committee

### Quarterly
- Full review of each TSC area
- Auditor check-in (if engaged)
- Training completion audit
- Access review

---

## 10. Auditor Selection

Top SOC 2 auditors for SaaS: BDO, Marcum, A-LIGN, Prescient, Johanson Group, Schellman. Many others.

### Criteria
- AICPA-accredited (non-negotiable)
- SaaS + tech industry experience
- Integration with Drata / Vanta (smoother evidence flow)
- Reasonable cost
- Good references from peer companies

### Contract
- Fixed fee preferred
- Clear scope (TSC criteria, systems in scope)
- Timeline
- Rights to use report for customer disclosures (always yes)
- Annual renewal option

### Red flags
- Auditor pushing for out-of-scope ("upsell")
- Requires specific tools beyond ours
- Vague fee structure
- Recent merged with competitor (chaos risk)

---

## 11. Report Management

### Receiving the report
- Draft → management response period
- Final report issued
- Period of coverage stated (for Type II)

### Publishing
- Under NDA to customers
- Not published publicly (it's sensitive operational detail)
- Share via trust center with gated access

### Customer access
- Sales team + CS able to share upon signed NDA
- Usually PDF; some customers want an auditor letter confirming validity
- Renewal window: send updated report to customers annually

### Storage
- Final report + management response kept indefinitely (evidence)
- All evidence + workpapers retained 7+ years

---

## 12. Type II Bridge Letters

Between report dates, customers may ask "is your attestation still valid?" Auditor can issue a **bridge letter** attesting no material changes since last report. Useful for customer relations; ~$500–2000 per letter.

We offer bridge letters on request.

---

## 13. Scope Description ("System Description")

Part of the SOC 2 report. Describes:
- Our services
- Our infrastructure
- Boundaries (what's in, what's out)
- Subprocessors we rely on (and controls we inherit from them)
- Complementary User Entity Controls (things **customers** must do on their side)

Draft with auditor; iterate. Drata / Vanta starts with a template.

---

## 14. Complementary User Entity Controls (CUEC)

Controls that customers are expected to perform. Examples:
- Administer their own user access (we provide tools; they manage users)
- Promptly notify us of user termination
- Use MFA (we enable; they configure their IdP)
- Review their audit logs
- Protect their API keys
- Configure their tenant's security settings

CUECs in the report set expectations. Common for enterprise SaaS.

---

## 15. SOC 2 + Other Frameworks

### SOC 2 + ISO 27001
- Controls largely overlap; one implementation, map to both
- SOC 2 report + ISO 27001 certificate — strongest US + international signal
- ISO 27001's SoA maps naturally to SOC 2 TSCs

### SOC 2 + HIPAA
- SOC 2 with Privacy TSC + HIPAA gets to a strong posture
- Some HIPAA-specific controls don't map to SOC 2 (minimum necessary, BAA)

### SOC 2 + FedRAMP
- FedRAMP is stricter; SOC 2 prep is foundation
- FedRAMP adds parameterized controls (e.g., password length specified) — SOC 2 more principle-based

---

## 16. Typical Year 1 Costs

### Audit fee
- Type I: $30–60k
- Type II (first year): $50–80k
- Type II (subsequent): $40–70k

### Tooling
- Drata / Vanta: $8–20k/year
- Plus integrations + maintenance

### Internal time
- 0.5–1 FTE during observation period
- Peaks at audit fieldwork (2–4 weeks)

### Pen test (supports SOC 2)
- $15–40k annually

**Total year 1 (Type II)**: $100–180k + internal staff time.

---

## 17. Common Pitfalls

### Pitfall 1: Treating SOC 2 as a checkbox
- Controls exist on paper but don't actually work
- Caught in Type II evidence gaps
- **Fix**: integrated into daily work (continuous evidence)

### Pitfall 2: Over-scoping
- Including everything = huge audit, high cost, slow
- **Fix**: Focus scope on what matters for customers

### Pitfall 3: Under-scoping (to save money)
- Report useful for fewer customers
- Customer follow-ups: "that's great, but what about X?"
- **Fix**: include what customers ask about

### Pitfall 4: Late evidence collection
- Scrambling 2 weeks before audit
- Gaps visible to auditor
- **Fix**: Drata / Vanta from day 1

### Pitfall 5: Policy-reality mismatch
- Policy says quarterly access review; actually annual
- Exception from reality = finding
- **Fix**: either update policy or get back to doing quarterly

### Pitfall 6: Ignoring findings between audits
- "We'll fix next year"
- Compound deficiencies
- **Fix**: remediate within commit period stated in management response

### Pitfall 7: Ignoring the report once issued
- Gets published to customers without re-reading
- Contains inaccuracies
- **Fix**: review final report carefully

---

## 18. Preparing Customers for SOC 2 Discussions

### Before attestation (Phase 1)
- Honest: "we're pursuing SOC 2 Type I next phase. Full program in place; audit scheduled Q3."
- Offer: security questionnaire, pen test summary, trust center
- Sometimes sufficient; sometimes not

### During first cycle (Type I in progress)
- "Type I expected [date]. Can share management-letter-style summary."
- Evidence of operational maturity

### After Type I
- Share Type I report under NDA
- "Type II coming in 12 months"
- Usually enough for most US mid-market

### After Type II
- The standard expectation
- Bridge letter between reports if needed

---

## 19. SOC 2 — What It Doesn't Cover

Be honest with customers:
- SOC 2 is not GDPR compliance
- Not ISO 27001
- Not HIPAA (unless explicitly in scope)
- Not FedRAMP
- Not a breach guarantee

We provide SOC 2 + GDPR-ready + HIPAA-capable + etc. — stack of overlapping assurances.

---

## 20. Related Documents

- [`COMPLIANCE-FRAMEWORKS.md`](COMPLIANCE-FRAMEWORKS.md) — program roadmap
- [`ISO27001.md`](ISO27001.md) — parallel framework
- [`POLICIES.md`](POLICIES.md) — policies supporting TSCs
- [`EVIDENCE-COLLECTION.md`](EVIDENCE-COLLECTION.md) — Drata / Vanta mechanics
- [`TRUST-CENTER.md`](TRUST-CENTER.md) — SOC 2 report delivery
- [`../devops/DISASTER-RECOVERY.md`](../devops/DISASTER-RECOVERY.md) — A1.3 supporting
- [`../devops/RUNBOOKS.md`](../devops/RUNBOOKS.md) — CC7.3 / CC7.5 supporting
