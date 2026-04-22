# Trust Center

> Customer-facing transparency site at `trust.aims.io`. Publishes compliance posture, subprocessors, security practices, status + incidents. Gated documents (SOC 2 report, pen test) available on signed NDA. The first thing enterprise security teams look at.

---

## 1. Why A Trust Center

Enterprise security teams evaluate us during sales. Before trust centers existed, they sent 200-question security questionnaires. We now:
- Answer the common 80% publicly
- Gate the sensitive 20% behind NDA
- Always-current — no stale PDFs

Result: faster sales cycles, fewer support tickets, more customer confidence.

Modern trust centers are table stakes for B2B SaaS targeting enterprise.

---

## 2. Tooling

### Options
- **SafeBase** — market leader; polished
- **Drata Trust Center** — integrated if we use Drata
- **Vanta Trust Report** — integrated if we use Vanta
- **Conveyor** — trust center + questionnaire automation
- **Custom site** — more control, more maintenance

### Our choice
**Drata / Vanta integrated Trust Center (Phase 2)** — same tool, reduced duplication. Swap to SafeBase or Conveyor (Phase 3+) if we outgrow.

### Authentication
- Public sections: no login
- Gated documents: request form → NDA signed → auto-grant access (or manual approval for first-time requesters)

---

## 3. Site Structure

```
trust.aims.io/
├── / (overview)                  ← compliance badges, quick facts
├── /compliance/                   ← certifications, attestations
│   ├── soc2
│   ├── iso27001
│   ├── hipaa
│   ├── gdpr
│   └── fedramp (Phase 6)
├── /security/                     ← security practices overview
│   ├── data-protection
│   ├── access-control
│   ├── network-security
│   ├── application-security
│   ├── incident-response
│   └── disaster-recovery
├── /privacy/                      ← privacy program
│   ├── policy                     (public)
│   ├── dpa (template)             (gated with NDA)
│   ├── subprocessors              (always public)
│   └── data-residency
├── /documents/                    ← gated downloads
│   ├── soc2-report                (NDA)
│   ├── iso27001-certificate       (public link to body's registry)
│   ├── pentest-summary            (NDA)
│   ├── caiq-response              (NDA)
│   ├── sig-lite-response          (NDA)
│   ├── insurance-certificate      (NDA)
│   ├── dpa-template               (NDA)
│   └── baa-template               (NDA, Phase 5)
├── /status/                       ← live status page (external link or embed)
├── /transparency/                 ← annual transparency report (Phase 3+)
├── /vulnerability-disclosure/     ← VDP + security.txt
└── /contact/                      ← security@, privacy@, dpo@
```

---

## 4. Overview Landing Page

First impression. Target: 30-second scan answers "should we trust them?"

### Elements
- **Compliance badges**: SOC 2 Type II ✅ · ISO 27001 ✅ · GDPR ✅ · HIPAA-ready · CCPA ✅
- **Quick facts**:
  - X thousand customers
  - Y countries served
  - Z years of SOC 2 clean
  - Data centers: US-East, US-West, EU-Central
- **Last updated**: auto-stamp
- **Quick links**: request SOC 2 report, sign DPA, contact security

### What NOT to do
- Don't oversell ("unhackable!", "military-grade!")
- Don't fake certifications (auditors will find out)
- Don't hide the good parts — surface them

---

## 5. Compliance Section

For each certification / attestation:

### Page contents
- **Status**: current cert / date of last audit
- **Scope**: what's covered
- **Audit firm + accreditation**
- **Report period** (for SOC 2)
- **How to obtain the report** (request flow)
- **Validity** (e.g., ISO 3-year cycle; SOC 2 annual)
- **History** — past cycles (minus detailed findings)

### Example — SOC 2 page
> AIMS is SOC 2 Type II attested, covering Security, Availability, and Confidentiality Trust Service Criteria.
>
> - Most recent report period: 2026-04-01 through 2026-09-30
> - Auditor: [Firm Name], AICPA-accredited
> - Scope: AIMS v2 production SaaS platform
> - Request full report: [form]

---

## 6. Security Section

High-level descriptions of practices. Not the internal docs; written for non-experts.

### Sub-pages

**Data protection**
- Encryption in transit (TLS 1.3)
- Encryption at rest (KMS)
- Per-tenant isolation (RLS)
- Backups + DR

**Access control**
- SSO for employees (Okta)
- MFA mandatory
- Just-in-Time production access
- Customer-side: SSO, SAML, OIDC, RBAC, MFA enforcement options

**Network security**
- VPC isolation
- WAF + DDoS protection (Cloudflare + AWS Shield)
- TLS everywhere

**Application security**
- SDLC with security integrated
- SAST / SCA / DAST
- Annual external pen test
- Vulnerability disclosure program

**Incident response**
- Dedicated team + 24×7 on-call
- Documented runbooks
- Customer notification per contract
- Annual drills

**Disaster recovery**
- RPO 15 min; RTO 1 hour
- Cross-region backups
- Quarterly DR drills

Level: enterprise security teams want specifics, not just "we're secure." Be concrete.

---

## 7. Privacy Section

- Public privacy policy (for our direct data subjects)
- Data Processing Agreement (DPA) template — gated behind NDA
- **Subprocessor list** — always public (GDPR Art. 28)
- **Data residency** options — which data centers, how to opt in
- **Subject rights** — how to exercise (GDPR + CCPA)

### Subprocessor list
Auto-generated from our vendor register. Updated real-time.

Per vendor:
- Name (with link to their security page)
- Purpose
- Data types
- Location(s)
- Added date

Customer notifications (email) for new additions — 30-day opt-out window.

---

## 8. Documents Section (Gated)

### Request flow

1. Visitor enters company name, email, role
2. Selects documents they want
3. Clicks NDA (standard template — no negotiation for common requests)
4. NDA e-signed (DocuSign or similar)
5. Access granted automatically:
   - SOC 2 report: download link
   - Pen test: download link
   - Questionnaire responses: download link
6. Access valid 90 days; auto-extendable

### Watermarking
Downloads watermarked with requester name + date. Deters leakage.

### Manual review for unusual requests
- Competitors identified → manual review
- High-sensitivity docs (pen test detailed findings) → security team review
- Custom docs (tailored questionnaire) → 3–5 business days

### What's gated vs not

| Doc | Access |
|-----|--------|
| ISO 27001 certificate image | Public |
| ISO 27001 SoA | NDA |
| SOC 2 report | NDA |
| Pen test executive summary | NDA |
| Pen test full report | NDA + extra review |
| Bug bounty program page | Public |
| CAIQ / SIG-lite | NDA |
| DPA template | Public or NDA (depending on customer) |
| BAA template | NDA (Phase 5) |
| Insurance certificate | NDA |
| Risk register | Never (internal) |
| Internal policies (full) | Never (summary in security section sufficient) |

---

## 9. Status Page

Live system status embedded or linked from trust center.

- `status.aims.io` — hosted Statuspage (or similar)
- Real-time operational status
- Incident history (past 90 days)
- Scheduled maintenance
- Email / RSS subscription for customers

See `devops/OBSERVABILITY.md` for internal dashboard; status page is the customer view.

---

## 10. Vulnerability Disclosure Page

- Scope of VDP
- Out of scope
- How to report
- Our response SLA
- Safe harbor statement
- Credit (hall of fame)
- Link to `security.txt`

### security.txt (`/.well-known/security.txt`)
```
Contact: mailto:security@aims.io
Contact: https://trust.aims.io/vulnerability-disclosure
Expires: 2027-04-20T00:00:00Z
Acknowledgments: https://trust.aims.io/hall-of-fame
Preferred-Languages: en
Canonical: https://aims.io/.well-known/security.txt
Policy: https://trust.aims.io/vulnerability-disclosure
```

Standard RFC 9116.

---

## 11. Transparency Report (Phase 3+)

Annual publication:
- DSR statistics (received, fulfilled, by type)
- Law enforcement requests received
- Breaches experienced (sanitized, factual)
- Customer notifications sent
- Compliance audit results (at summary level)

Signals commitment to openness. Precedents: Twitter, Google, Apple transparency reports.

---

## 12. Contact Section

Direct contacts for specific needs:
- `security@aims.io` — vulnerability reports, security questions
- `privacy@aims.io` — privacy inquiries, DSRs
- `dpo@aims.io` — DPO-specific (Phase 4+)
- `legal@aims.io` — subpoenas, legal process
- `support@aims.io` — general
- Mailing address (for legal process)

Response SLAs stated — we commit publicly.

---

## 13. Maintenance Cadence

- **Continuous**: subprocessor list (auto-updates), status page
- **On event**: new certification, new subprocessor, policy update, incident
- **Monthly**: compliance badges currency, contact info, VDP stats
- **Quarterly**: security section refresh (new capabilities), questionnaire responses
- **Annually**: transparency report, full trust center review

### Ownership
- Primary: CISO + Security team
- Content: shared with CS, Sales enablement
- Legal-sensitive sections: Legal reviews

---

## 14. Customer Onboarding Flow

1. **Prospect visits trust.aims.io** — gets 80% of answers
2. **Security team reviewer** requests gated docs → NDA → auto-grant
3. **Internal review** by prospect's security team
4. **Questions** emailed to `security@aims.io` — response within SLA
5. **Deep-dive call** if needed (large enterprise)
6. **DPA review** (Legal-to-Legal)
7. **Close**

From "first visit" to "close" often a week or two for typical mid-market. Enterprise can take 2–3 months.

---

## 15. Metrics

Internal tracking:
- Unique visitors (trust center)
- Document requests (per doc type)
- NDA signatures
- Time from request to document access
- Security questions received per week
- Sales cycle correlation with trust center engagement

Reported to Sales + Marketing + Security monthly.

---

## 16. SEO + Discoverability

- Public pages indexed (marketing benefit)
- Link from main site footer ("Security", "Trust")
- Link from sign-up / pricing pages
- Link in sales outreach signatures
- Link in RFP responses

Customers Google "AIMS SOC 2" — trust center should rank #1.

---

## 17. Competitive Comparison

Periodically check what competitors publish. Common baseline (Phase 3):
- SOC 2 Type II (standard)
- ISO 27001 (if global)
- Privacy + DPA
- Subprocessors
- DPA template
- Security overview (10+ pages)
- Trust badge on main site

We aim to match and slightly exceed.

---

## 18. What NOT to Put on Trust Center

- **Specific attack techniques we defend against** (roadmap for attackers)
- **Named employees** (beyond executive team; even they minimally)
- **Specific vendor details beyond "name"** (their security is theirs to discuss)
- **Incident details mid-investigation**
- **Pricing / contract specifics** (belongs in sales)
- **Customer names without written permission** (case studies with consent OK)

---

## 19. Customer-Specific Questionnaires

Despite trust center, some customers send questionnaires anyway (CAIQ, SIG, custom). Our process:

1. Intake received (sales or CS)
2. Assigned to Security Team member
3. Baseline: our "master questionnaire response" from `implementation/templates/security-questionnaire.md`
4. Customer-specific additions
5. Review by Security + CS
6. Delivered within SLA (10 business days typical)

Saved responses build corpus — next customer's questionnaire takes hours not weeks.

Automation: Conveyor or similar (Phase 3+) matches questions to answers.

---

## 20. Sample Questionnaire Responses (Internal Library)

`implementation/templates/security-questionnaire.md` has ~200 pre-written responses to common questions:

- "Do you encrypt data at rest?" → Yes, AES-256 via AWS KMS
- "Do you have an incident response plan?" → Yes, link to summary
- "What's your RPO / RTO?" → 15 min / 1 hour
- "Do you perform pen tests?" → Yes, annually by [firm type]
- "SOC 2?" → Type II current; report via [link]
- ...

CS + Sales empowered to answer from library; Legal for contract specifics.

---

## 21. NDA Management

- **Standard NDA template** (our template; mutual; 2-year confidentiality)
- Customer's NDA accepted if comparable terms
- Triage by Legal if unusual terms
- Executed NDAs stored centrally (legal document management)
- Access auto-revoked after 90 days (re-request if needed)

Lightweight for common requests; heavier for unusual.

---

## 22. Launch Checklist (Phase 1 Trust Center)

- [ ] Domain configured (`trust.aims.io`)
- [ ] Tooling selected + set up
- [ ] Initial content authored (security overview, privacy, subprocessors)
- [ ] Compliance section (aspirational: SOC 2 in progress, ISO later)
- [ ] VDP page + security.txt
- [ ] Status page linked
- [ ] Contact emails set up + monitored
- [ ] NDA template ready
- [ ] Document gating + access flow tested
- [ ] Main site link added
- [ ] Announcement to current + prospective customers

---

## 23. What We Don't Do

- **Overstate certifications** ("SOC 2 ready!" without audit) — say what's true
- **Hide behind NDAs excessively** — enough is public that prospects can evaluate
- **Publish internal runbooks** — summary suffices
- **Make trust center hard to find** — link prominently
- **Stale content** — quarterly check minimum

---

## 24. Related Documents

- [`COMPLIANCE-FRAMEWORKS.md`](COMPLIANCE-FRAMEWORKS.md) — roadmap + what to publish
- [`PRIVACY.md`](PRIVACY.md) — privacy content
- [`THIRD-PARTY-RISK.md`](THIRD-PARTY-RISK.md) — subprocessor list
- [`../devops/OBSERVABILITY.md`](../devops/OBSERVABILITY.md) — status page feed
- `implementation/templates/security-questionnaire.md` — response library
- `implementation/templates/dpa-template.md` — DPA
