# Acceptable Use Policy (AUP)

<!--
REFERENCE IMPLEMENTATION — AUP signed by every employee + contractor at
onboarding and annually. Short, imperative, plain language.
-->

## Metadata

| Field | Value |
|-------|-------|
| **Policy** | Acceptable Use Policy |
| **Version** | 1.0 |
| **Effective date** | 2026-04-20 |
| **Approved by** | CISO + Head of HR |
| **Review cadence** | Annual |
| **Next review** | 2027-04-20 |
| **Owner** | CISO + HR |
| **Classification** | Internal |
| **Applies to** | All employees, contractors, consultants, interns |

---

## 1. Purpose

This policy sets expectations for how company systems, information, and resources may be used. Following it protects customers, the company, and you.

## 2. What's Expected

### 2.1 Use resources for work
Company systems (laptop, email, SaaS accounts, cloud access) are issued for work purposes. Incidental personal use is allowed — reasonable, not commercial, and never jeopardizing security or productivity.

### 2.2 Protect credentials
- Use a company-managed password manager (1Password, Bitwarden, etc.)
- Enable MFA everywhere
- Never share passwords or MFA codes with anyone, including IT / Security
- Never reuse personal passwords for work accounts

### 2.3 Keep company data on company systems
- Don't email customer or confidential data to personal accounts
- Don't upload company files to personal cloud drives
- Don't screenshot or photograph sensitive screens
- Don't forward work to personal devices for "convenience"

### 2.4 Handle data per its classification
Follow `DATA-CLASSIFICATION.md`. If unsure of classification, ask.

### 2.5 Keep your equipment secure
- Lock your screen when stepping away (⌘+Ctrl+Q / Win+L)
- Clean desk: no sensitive info visible
- Full-disk encryption enabled (company-provisioned by default)
- Keep OS + apps updated
- Report lost / stolen devices within 1 hour

### 2.6 Install only approved software
- Use company app catalog / MDM-provisioned apps
- If you need something new, request via IT
- Never disable security tooling (EDR, MDM)

### 2.7 Report suspicious activity
- Phishing attempts → forward to `phishing@aims.io`
- Suspected security incident → `security@aims.io` or `#security` Slack
- Accidental data exposure → report immediately; no blame for good-faith reports

### 2.8 Return assets on departure
- All devices, badges, storage, printed materials
- Complete exit checklist with IT + HR

---

## 3. What's Prohibited

### 3.1 Unauthorized access
- Do not access data, systems, or accounts you're not authorized for
- Curiosity is not authorization — if it's not part of your role, don't look

### 3.2 Bypassing security controls
- Don't disable MFA
- Don't install browser extensions that weaken security (auto-fillers outside approved PM, etc.)
- Don't use alternative DNS / VPN to circumvent corporate controls
- Don't share SSO sessions or personal access to SaaS

### 3.3 Sharing customer data outside approved channels
- No forwarding to personal email
- No sharing in unapproved SaaS (personal Slack, etc.)
- No external ChatGPT / LLM use with customer data unless using an approved and BAA/DPA-covered service

### 3.4 Harassment, illegal activity, discrimination
- No harassment, bullying, or hostile conduct on any work channel
- No use of resources for illegal activity
- Compliance with company Code of Conduct + EEO policies

### 3.5 Personal commercial activity on company systems
- Don't run personal businesses on work laptop
- Don't use work accounts for your side projects

### 3.6 Introducing malware
- Don't click suspicious links, open unexpected attachments
- Don't plug in found USB drives
- Don't disable EDR / antivirus

### 3.7 Physical security violations
- Don't tailgate (let unauthorized person follow you into office)
- Don't share badges
- Don't leave laptops unattended in public

---

## 4. AI + LLM Usage

### Permitted (with guardrails)
- Approved tools (ChatGPT Enterprise, Claude, company-sanctioned coding assistants)
- Non-confidential inputs
- Outputs reviewed before use (AI can hallucinate)

### Prohibited
- Customer Confidential or Regulated data into personal AI accounts
- Use of unapproved AI services for work
- Using AI to generate code without security review

See `engineering/CODE-STANDARDS.md` for AI-assisted coding guidelines.

---

## 5. Monitoring

### What we monitor
- System access + authentication events
- Network activity on company devices + networks
- Cloud service usage
- Email (for security — not content surveillance)
- Endpoint behavior (EDR)

### Why
- Security + incident response
- Compliance evidence
- Performance + capacity

### Privacy
- Personal browsing (on company device, reasonable use): not inspected except where security-relevant
- Personal email: never inspected
- Health information: never inspected
- Exceptions: investigation of specific misconduct or legal process, with HR + Legal involvement

---

## 6. Consequences of Violation

- **Minor or first offense**: coaching, documented
- **Significant or repeat**: formal performance action by HR
- **Willful, negligent causing harm, or illegal**: termination; referral to law enforcement if applicable; legal action

---

## 7. Questions

Ask:
- Your manager
- IT / Security (`#security` Slack)
- HR (for AUP interpretation)
- Anonymous: `ethics@aims.io`

"In doubt, ask" is always acceptable. Bad-faith dodging of this policy is not.

---

## 8. Related Documents

- `information-security.md` — master policy
- `data-classification.md` — data handling
- `access-control.md` — access specifics
- Code of Conduct (HR)
- Privacy Notice

---

## Acknowledgment

I have read, understand, and agree to comply with this Acceptable Use Policy.

**Employee / Contractor Name**: ___________________________

**Signature**: ___________________________

**Date**: ___________________________

<!-- Signed via company HR e-signature platform; record stored in Drata / Vanta. -->
