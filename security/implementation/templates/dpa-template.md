# Data Processing Agreement (DPA)

<!--
REFERENCE IMPLEMENTATION — DPA template for AIMS as a processor of customer
personal data. GDPR Art. 28 compliant; CCPA-aligned; adaptable for sector
specifics.

Legal must review before use with any customer. Treat this as a starting
point, not a final document.

Placeholder tokens:
  <CUSTOMER_ENTITY>  — customer legal name
  <CUSTOMER_ADDR>    — customer address
  <DATE>             — effective date
  <CUSTOMER_SIGNATORY>  — customer signatory
-->

# DATA PROCESSING AGREEMENT

This Data Processing Agreement ("**DPA**") forms part of the Master Services Agreement or equivalent ("**Agreement**") between:

**AIMS Technologies, Inc.** ("AIMS", "Processor"), a Delaware corporation, having its principal place of business at [Address]

**and**

**`<CUSTOMER_ENTITY>`** ("Customer", "Controller"), having its principal place of business at `<CUSTOMER_ADDR>`

Effective Date: `<DATE>`

---

## 1. Definitions

Terms not defined herein have the meanings set forth in the applicable Data Protection Laws.

- **Data Protection Laws**: all applicable data protection and privacy laws, including the EU General Data Protection Regulation 2016/679 ("GDPR"), UK GDPR, California Consumer Privacy Act as amended by CPRA ("CCPA"), and other applicable laws.
- **Personal Data**: any information relating to an identified or identifiable natural person processed by AIMS on behalf of Customer under the Agreement.
- **Process** / **Processing**: as defined in GDPR Art. 4(2).
- **Controller**, **Processor**, **Data Subject**, **Sub-processor**: as defined in GDPR Art. 4.
- **Security Incident**: a breach of security leading to accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Personal Data.
- **Services**: the AIMS platform and related services as defined in the Agreement.

---

## 2. Scope + Roles

### 2.1
This DPA applies to Processing of Personal Data by AIMS on behalf of Customer in connection with the Services.

### 2.2
Under this DPA:
- Customer is the **Controller** (or a Processor acting on behalf of its own customer, the Controller)
- AIMS is the **Processor** (or Sub-processor)

### 2.3
Details of Processing are set forth in **Annex I**.

---

## 3. Customer Obligations

### 3.1
Customer represents and warrants that:
- It has the legal basis required under Data Protection Laws to authorize AIMS's Processing
- Its instructions to AIMS comply with Data Protection Laws
- It has provided any necessary notices to, and obtained any necessary consents from, Data Subjects
- It has implemented appropriate technical and organizational measures for its own obligations

### 3.2
Customer shall not provide to AIMS special categories of personal data (as defined in GDPR Art. 9) unless expressly contemplated by the Services and an amendment to this DPA is in place (e.g., for PHI, a BAA is required).

---

## 4. AIMS Obligations

### 4.1 Documented instructions
AIMS shall Process Personal Data only on Customer's documented instructions, including instructions given through configuration of the Services, the Agreement, and this DPA. If AIMS is required by law to Process Personal Data outside Customer's instructions, AIMS shall inform Customer before Processing unless the law prohibits such notice.

### 4.2 Confidentiality
AIMS shall ensure that personnel authorized to Process Personal Data are bound by appropriate confidentiality obligations.

### 4.3 Security measures
AIMS shall implement appropriate technical and organizational measures as described in **Annex II**, which shall be no less rigorous than industry standards for similar services. These include:
- Encryption of Personal Data in transit and at rest
- Measures to ensure ongoing confidentiality, integrity, availability
- Ability to restore availability in a timely manner after an incident
- Regular testing, assessing, and evaluating the effectiveness of measures

### 4.4 Sub-processors
AIMS uses Sub-processors listed at `https://trust.aims.io/subprocessors` ("**Sub-processor List**"). Customer authorizes AIMS's use of current Sub-processors by executing this DPA.

### 4.5 New Sub-processor notification
AIMS shall notify Customer of any proposed additions or changes to Sub-processors at least thirty (30) days in advance (via email, in-product notification, or Sub-processor List updates with subscription option). Customer may object on reasonable data protection grounds within such notice period. If objection is unresolved, Customer may terminate the Agreement for the affected Services.

### 4.6 Sub-processor terms
AIMS shall impose data protection obligations on Sub-processors no less protective than those in this DPA.

### 4.7 Data Subject Rights
AIMS shall provide reasonable assistance to Customer to enable Customer to respond to Data Subject requests (access, rectification, erasure, restriction, portability, objection).

### 4.8 Assistance with compliance
AIMS shall provide reasonable assistance to Customer regarding:
- Data Protection Impact Assessments (GDPR Art. 35)
- Prior consultation with supervisory authorities (Art. 36)
- Security of Processing obligations (Art. 32)

### 4.9 Security Incident notification
AIMS shall notify Customer of a confirmed Security Incident affecting Customer's Personal Data without undue delay and in any event within seventy-two (72) hours of AIMS's determination that a Security Incident has occurred. Notification shall include, to the extent available:
- Nature of the Security Incident
- Categories and approximate number of Data Subjects affected
- Categories and approximate number of Personal Data records affected
- Likely consequences
- Measures taken or proposed to address it

### 4.10 Records of Processing
AIMS shall maintain records of its Processing activities under Art. 30(2) GDPR and make them available to Customer upon request.

### 4.11 Audit rights
Customer may, at its expense and on reasonable advance notice (not more than once per year, except following a Security Incident), conduct audits of AIMS's Processing. AIMS may satisfy this obligation by providing Customer with:
- Current SOC 2 Type II report
- Current ISO 27001 certification and Statement of Applicability
- Other third-party audit reports reasonably sufficient to demonstrate compliance

On-site audits may be conducted only where the above are insufficient, at Customer's expense, under a separate confidentiality agreement, and scoped to avoid disruption.

### 4.12 Deletion or return of Personal Data
Upon termination of the Agreement and at Customer's election, AIMS shall delete or return Personal Data within thirty (30) days, subject to legal requirements for retention. Deletion includes cryptographic erasure for encrypted backups. Upon written request, AIMS shall provide written certification of deletion.

---

## 5. International Transfers

### 5.1
AIMS may transfer Personal Data to countries outside the country of origin. AIMS implements appropriate transfer mechanisms, including:
- Standard Contractual Clauses (Commission Decision 2021/914) where applicable
- EU–US Data Privacy Framework certification (where subprocessors are certified)
- Adequacy decisions
- Binding Corporate Rules (if applicable)

### 5.2
Where the European Commission's Standard Contractual Clauses apply:
- Module 2 (Controller-to-Processor) applies to transfers from Customer (Controller) to AIMS (Processor)
- Module 3 (Processor-to-Processor) applies where Customer is a Processor and AIMS its Sub-processor
- Clauses are incorporated by reference; attached as Annex III where required
- Governing law: Ireland (or as specified in Annex III)

### 5.3
For UK transfers, the UK International Data Transfer Addendum is incorporated by reference.

---

## 6. California-Specific Provisions

To the extent CCPA applies:

### 6.1
AIMS is a "service provider" as defined in the CCPA with respect to Personal Information covered by the CCPA ("California Personal Information") that Customer discloses to AIMS.

### 6.2
AIMS shall not:
- Sell California Personal Information
- Share California Personal Information for cross-context behavioral advertising
- Retain, use, or disclose California Personal Information outside the direct business relationship with Customer or beyond AIMS's obligations to Customer
- Combine California Personal Information with personal information from other sources except as permitted by CCPA Regulations

### 6.3
AIMS shall assist Customer in responding to verifiable consumer requests.

### 6.4
If AIMS determines it can no longer meet its service provider obligations, it shall notify Customer and cease processing, or Customer may direct deletion.

---

## 7. Liability + Indemnification

### 7.1
Liability under this DPA is subject to the limitations of liability set forth in the Agreement.

### 7.2
Notwithstanding any liability cap, nothing in this DPA or the Agreement limits a party's liability for:
- Breach of confidentiality obligations
- Gross negligence or willful misconduct
- Liability that cannot be excluded under applicable law

---

## 8. Term + Termination

### 8.1
This DPA is effective from the Effective Date and continues for the term of the Agreement.

### 8.2
Obligations regarding retention, deletion, Security Incident notification, and audit survive termination as provided herein.

---

## 9. General

### 9.1
This DPA shall be governed by the law governing the Agreement, except where mandatory law requires otherwise.

### 9.2
If any provision of this DPA is found unenforceable, the remaining provisions remain in effect.

### 9.3
In case of conflict between the Agreement and this DPA, this DPA prevails with respect to Personal Data Processing.

### 9.4
This DPA may be updated by AIMS to reflect changes in law; material changes notified to Customer 30 days in advance.

### 9.5
This DPA may be executed in counterparts, including electronically.

---

## Signatures

**AIMS TECHNOLOGIES, INC.**
Signature: ___________________________
Name: ___________________________
Title: ___________________________
Date: ___________________________

**`<CUSTOMER_ENTITY>`**
Signature: ___________________________
Name: `<CUSTOMER_SIGNATORY>`
Title: ___________________________
Date: ___________________________

---

## ANNEX I — Details of Processing

### Subject matter
Provision of the AIMS audit information management platform and related Services under the Agreement.

### Duration
For the term of the Agreement and until deletion / return per Section 4.12.

### Nature + purpose
Processing is for the provision of Services, including: hosting, storage, retrieval, display, computation, reporting, and communications necessary for Customer's use of AIMS.

### Categories of Personal Data (typical)
- Name, email, job title, organization (Customer's users)
- Login credentials (hashed), session identifiers
- Usage metadata (logins, actions taken)
- Free-text content uploaded by Customer (may include Personal Data about third parties described in audit records)
- IP addresses, device identifiers for security purposes

### Categories of Data Subjects (typical)
- Customer's employees, contractors, consultants
- Customer's auditees, interviewees, stakeholders (where Customer uploads such information)
- Customer's own customers (where Customer performs audits involving end-user data)

### Obligations + rights of Controller
As specified in this DPA and Data Protection Laws.

---

## ANNEX II — Technical and Organizational Measures

### Access controls
- Single Sign-On (SSO) with Multi-Factor Authentication for all AIMS staff accessing production
- Role-based access control (RBAC) and attribute-based (ABAC)
- Just-in-time privileged access with dual approval
- Quarterly access reviews
- Customer-side: SSO, MFA, granular role configuration

### Encryption
- TLS 1.3 in transit
- AES-256 with AWS KMS at rest
- Per-tenant encryption keys (envelope encryption)

### Network security
- VPC isolation
- Web Application Firewall
- DDoS protection
- Intrusion detection

### Application security
- Secure development lifecycle
- SAST, SCA, DAST scanning
- Annual third-party penetration testing
- Vulnerability management with severity-based SLAs

### Physical security
- AWS data center controls (SOC 2, ISO 27001, FedRAMP controls as applicable to AWS)
- Remote-first workforce; endpoint controls

### Operational security
- 24x7 monitoring
- Incident response plan
- Annual disaster recovery drill
- Business continuity plan
- Logging + audit trail (hash-chained)

### Organizational
- Annual security awareness training for all staff
- Background checks for new hires in sensitive roles
- Signed confidentiality obligations
- Documented policies + procedures

### Certifications (current or targeted)
- SOC 2 Type II (Security, Availability, Confidentiality)
- ISO 27001:2022
- HIPAA-ready (Phase 5)
- GDPR-aligned processing

---

## ANNEX III — Standard Contractual Clauses (if applicable)

<!-- Attach or incorporate by reference, as required by the specific transfer scenario. -->
