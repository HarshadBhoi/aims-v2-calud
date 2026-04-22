# Permissions Model

> RBAC (role-based) + ABAC (attribute-based) hybrid authorization. Complete permission catalog.

---

## Authorization Layers

```
┌───────────────────────────────────────────────────────┐
│ Layer 1: Authentication (are you who you say?)       │
│  — Verified in auth middleware (ctx.auth)            │
├───────────────────────────────────────────────────────┤
│ Layer 2: Tenant scoping (which org?)                 │
│  — Enforced via PostgreSQL RLS + session vars        │
├───────────────────────────────────────────────────────┤
│ Layer 3: RBAC (what role-based permissions?)         │
│  — Checked in tRPC middleware: requirePermission()   │
├───────────────────────────────────────────────────────┤
│ Layer 4: ABAC (does your attribute grant access?)    │
│  — Checked in service layer: are you on the team?   │
├───────────────────────────────────────────────────────┤
│ Layer 5: Audit (log every decision)                  │
│  — audit_log captures allow/deny                     │
└───────────────────────────────────────────────────────┘
```

No single layer is sufficient. Defense in depth.

---

## 1. Role Model

Roles are **per-tenant**. A user can have different roles in different tenants.

### Built-In Roles

| Role | Tier | Typical Title | Key Permissions |
|------|------|---------------|-----------------|
| `ADMIN` | Tenant owner | Tenant Administrator | Everything within the tenant |
| `DIRECTOR` | Senior leadership | Audit Director, CAE | Approve, issue, strategic planning |
| `SUPERVISOR` | Middle management | Engagement Supervisor | Manage engagements, review work |
| `SENIOR_AUDITOR` | Senior practitioner | Senior Auditor, Manager | Lead engagements, create findings |
| `STAFF_AUDITOR` | Junior practitioner | Staff Auditor | Fieldwork, documentation |
| `QA_REVIEWER` | Quality review | QA Reviewer, EQR | Cross-engagement review, QAIP |
| `AUDITEE` | Client-side | Business Unit Lead | View assigned findings, submit responses |
| `VIEWER` | Read-only | Observer | View only, no modifications |
| `SUPERADMIN` | Platform-level | AIMS Platform Operator | Cross-tenant (special) |

### Custom Roles (Enterprise Feature)

Enterprise tenants can define custom roles by combining permissions:
```json
{
  "name": "Compliance Specialist",
  "description": "Read all findings, write compliance checklists",
  "inheritsFrom": "STAFF_AUDITOR",
  "addedPermissions": ["checklist:complete", "report:view"],
  "removedPermissions": []
}
```

### Role Hierarchy

Roles don't strictly inherit (e.g., ADMIN isn't DIRECTOR + extra). Each role has its own explicit permission set. This prevents accidental privilege inheritance surprises.

---

## 2. Permission Model

### Permission Format
`{resource}:{action}[:{qualifier}]`

Examples:
- `engagement:create` — Create any engagement in tenant
- `engagement:view_assigned` — View only engagements user is assigned to
- `engagement:view_all` — View all engagements in tenant
- `finding:issue` — Issue a finding (terminal lock with e-signature)
- `report:approve` — Approve a report in workflow

### Qualifiers

- **(none)**: Unrestricted within tenant
- `_assigned`: Only resources user is assigned to (via team membership)
- `_created`: Only resources user created
- `_all`: Explicit "everything in tenant" (usually default if no qualifier)

---

## 3. Complete Permission Catalog

### Tenant & Platform Management
```
tenant:manage                   # Update tenant settings
tenant:view                     # View tenant info
tenant:delete                   # Delete tenant (destroy org)
tenant:suspend                  # Suspend tenant (platform only)

user:invite                     # Invite new users
user:manage                     # Change user roles, deactivate
user:view_all                   # View all users in tenant
user:view_self                  # View own profile (implicit for all)
user:impersonate                # Impersonate for support (SUPERADMIN only)

role:manage                     # Assign/create custom roles
role:view                       # View role definitions

billing:manage                  # Subscription, payment methods
billing:view                    # View billing info + invoices

api_key:create                  # Create API keys
api_key:manage                  # Rotate, revoke API keys
api_key:view                    # List keys (partial, no secrets)

sso:configure                   # Configure SSO
sso:manage                      # Manage SSO providers

audit_log:view                  # View tenant audit log
audit_log:export                # Export audit log
```

### Standard Packs
```
pack:view                       # See activated packs
pack:activate                   # Activate pack for tenant
pack:deactivate                 # Deactivate pack
pack:customize                  # Override pack config per tenant

pack:publish                    # Publish new pack version (SUPERADMIN)
pack:manage_global              # Edit global pack catalog (SUPERADMIN)

crosswalk:view                  # View cross-pack mappings
crosswalk:manage                # Edit crosswalks (SUPERADMIN)
```

### Engagements
```
engagement:create               # Create new engagement
engagement:update               # Update engagement
engagement:delete               # Soft delete (DIRECTOR+)
engagement:view_all             # View all in tenant
engagement:view_assigned        # View only team-assigned
engagement:clone                # Clone existing
engagement:transition           # Change status
engagement:issue                # Issue engagement (terminal)
engagement:archive              # Archive closed engagements

engagement:manage_team          # Add/remove team members
engagement:assign_team          # Assign yourself (for team leads)
```

### Planning
```
planning_doc:create
planning_doc:update
planning_doc:view
planning_doc:delete
planning_doc:approve

work_program:create
work_program:update
work_program:view
work_program:delete
work_program:assign             # Assign procedures to team members
```

### Fieldwork
```
observation:create
observation:update
observation:escalate            # Escalate to finding
observation:view
observation:delete

audit_test:create
audit_test:update
audit_test:view
audit_test:delete

sampling:create
sampling:update
sampling:view
```

### Findings
```
finding:create
finding:update
finding:view                    # View with team membership
finding:view_all                # View all in tenant
finding:view_assigned           # View team-assigned
finding:delete
finding:submit_for_review
finding:approve                 # Approve in workflow
finding:reject
finding:issue                   # Terminal lock with e-signature
finding:withdraw                # Retract issued finding

management_response:create      # Auditee submits response
management_response:update
management_response:evaluate    # Auditor evaluates
management_response:view
```

### Recommendations
```
recommendation:create
recommendation:update
recommendation:delete
recommendation:view
recommendation:accept_risk      # Mark risk as accepted

cap:create                      # Corrective Action Plan
cap:update
cap:submit_evidence             # Auditee uploads evidence
cap:verify                      # Auditor verifies completion
cap:view
```

### Workpapers
```
workpaper:create                # Upload new workpaper
workpaper:update                # Update metadata
workpaper:delete
workpaper:upload_version        # New version
workpaper:view                  # View with team membership
workpaper:view_all
workpaper:review                # Reviewer sign-off
workpaper:approve
workpaper:download
```

### Reports
```
report:create                   # Create draft report
report:update
report:delete
report:view
report:view_all
report:generate_pdf             # Generate PDF (expensive)
report:submit_for_review
report:approve
report:issue                    # Terminal lock + e-signature
report:distribute               # Mark as distributed
report:download
```

### Quality Assurance
```
checklist:complete              # Fill out QA checklist
checklist:review
checklist:view
checklist:manage                # Create tenant-specific checklists

independence:declare            # Submit independence declaration (all roles)
independence:view               # View team members' declarations
independence:manage             # Admin: reset declarations

peer_review:create
peer_review:update
peer_review:view
peer_review:schedule

qaip:manage                     # QAIP assessments (IIA)
qaip:view
```

### Staff, Time, CPE
```
time_entry:create               # Submit own time
time_entry:update               # Update own draft time
time_entry:approve              # Approve team time (SUPERVISOR+)
time_entry:view_all             # View all team time
time_entry:view_self            # View own time (implicit)

cpe:create                      # Log own CPE
cpe:update                      # Update own CPE
cpe:view_all                    # View all users' CPE (SUPERVISOR+)
cpe:view_self                   # View own CPE
cpe:manage                      # Approve/reject CPE claims

certification:create            # Add own certifications
certification:update
certification:view_all
certification:view_self

staff:view_all                  # View staff directory
staff:manage                    # Manage staff assignments
```

### Audit Universe & Annual Planning
```
universe:create
universe:update
universe:delete
universe:view
universe:assess_risk

annual_plan:create
annual_plan:update
annual_plan:approve             # Board approval
annual_plan:view
annual_plan:delete
```

### Approval Workflow
```
approval:view_mine              # My assigned approvals
approval:view_all               # All tenant approvals
approval:act                    # Approve/reject assigned
approval:delegate               # Delegate to another
approval:recall                 # Recall own submission
approval:override               # Override (SUPERADMIN)
```

### Notifications
```
notification:view_own           # Implicit
notification:manage_preferences # Settings
```

### Files
```
file:upload
file:download
file:delete                     # Non-locked files only
file:view_metadata
```

### Advanced / Admin
```
impersonation:use               # SUPERADMIN only
impersonation:audit             # View impersonation log

data:export                     # GDPR export
data:delete_request             # GDPR erasure request
data:anonymize                  # Execute anonymization (ADMIN)

webhook:manage                  # Configure outbound webhooks
webhook:view_events             # View webhook delivery log

platform:admin                  # Platform operator (SUPERADMIN)
```

---

## 4. Default Role → Permission Mapping

### ADMIN
**Philosophy**: Full control within tenant. Cannot affect other tenants.

```
tenant:* (except tenant:suspend, tenant:delete — extreme caution)
user:*
role:*
billing:*
api_key:*
sso:*
audit_log:*
pack:view, pack:activate, pack:deactivate, pack:customize
crosswalk:view
engagement:*
finding:*
report:*
workpaper:*
checklist:*
peer_review:*
qaip:manage, qaip:view
time_entry:*
cpe:*
certification:*
staff:*
universe:*
annual_plan:*
approval:view_all, approval:act, approval:delegate, approval:recall
data:export, data:delete_request, data:anonymize
webhook:*
```

### DIRECTOR
**Philosophy**: Strategic leadership, final approval, QA oversight. Cannot change tenant config.

```
engagement:create, engagement:update, engagement:view_all, engagement:manage_team, engagement:transition, engagement:issue, engagement:clone, engagement:archive
finding:create, finding:update, finding:view_all, finding:approve, finding:issue
report:create, report:update, report:view_all, report:approve, report:issue
workpaper:view_all, workpaper:review, workpaper:approve, workpaper:download
checklist:review
peer_review:create, peer_review:view, peer_review:schedule
qaip:view, qaip:manage
annual_plan:create, annual_plan:update, annual_plan:approve, annual_plan:view
universe:view, universe:assess_risk
approval:view_all, approval:act, approval:delegate
cpe:view_all
time_entry:view_all, time_entry:approve
audit_log:view
```

### SUPERVISOR
**Philosophy**: Day-to-day engagement management and first-level review.

```
engagement:create, engagement:update, engagement:view_all, engagement:manage_team, engagement:transition
planning_doc:create, planning_doc:update, planning_doc:view, planning_doc:approve
work_program:create, work_program:update, work_program:view, work_program:assign
finding:create, finding:update, finding:view_all, finding:approve
recommendation:create, recommendation:update, recommendation:view
cap:update, cap:verify, cap:view
workpaper:view_all, workpaper:review
report:create, report:update, report:view_all, report:submit_for_review
audit_test:view, sampling:view
checklist:complete, checklist:review
time_entry:create, time_entry:update, time_entry:approve, time_entry:view_all
cpe:view_all
approval:view_all, approval:act, approval:delegate
```

### SENIOR_AUDITOR
**Philosophy**: Lead engagements, do complex fieldwork, write findings.

```
engagement:view_assigned
planning_doc:create, planning_doc:update, planning_doc:view
work_program:create, work_program:update, work_program:view, work_program:assign
observation:create, observation:update, observation:view, observation:escalate
audit_test:create, audit_test:update, audit_test:view
sampling:create, sampling:update, sampling:view
finding:create, finding:update, finding:view_assigned, finding:submit_for_review
recommendation:create, recommendation:update, recommendation:view
workpaper:create, workpaper:update, workpaper:upload_version, workpaper:view, workpaper:download
report:create, report:update, report:view_assigned
checklist:complete
independence:declare
time_entry:create, time_entry:update, time_entry:view_self
cpe:create, cpe:update, cpe:view_self
```

### STAFF_AUDITOR
**Philosophy**: Fieldwork execution, documentation.

```
engagement:view_assigned
work_program:view
observation:create, observation:update, observation:view
audit_test:view, sampling:view
finding:view_assigned
workpaper:create, workpaper:update, workpaper:upload_version, workpaper:view, workpaper:download
checklist:complete
independence:declare
time_entry:create, time_entry:update, time_entry:view_self
cpe:create, cpe:update, cpe:view_self
```

### QA_REVIEWER
**Philosophy**: Cross-engagement review for quality.

```
engagement:view_all
finding:view_all
report:view_all
workpaper:view_all, workpaper:review
checklist:review
peer_review:view
qaip:manage, qaip:view
independence:view
audit_log:view
approval:act (for QA_REVIEW workflow step)
```

### AUDITEE
**Philosophy**: Business unit responding to audit — limited view, can respond.

```
engagement:view_assigned
finding:view_assigned
recommendation:view
management_response:create, management_response:update
cap:update, cap:submit_evidence, cap:view
workpaper:view (only those shared with auditee)
report:view_assigned
```

### VIEWER
**Philosophy**: Read-only observer (auditor trainee, external consultant).

```
engagement:view_assigned
finding:view_assigned
report:view_assigned
workpaper:view
recommendation:view
universe:view
```

### SUPERADMIN (Platform Operator)
**Philosophy**: Cross-tenant operations for support/operations.

```
platform:admin
impersonation:use, impersonation:audit
pack:publish, pack:manage_global
crosswalk:manage
audit_log:view (any tenant)
```

---

## 5. ABAC (Attribute-Based Access Control)

Beyond RBAC. Policies check attributes of user, resource, and environment.

### Common ABAC Patterns

#### Team Membership
"User can view engagement if they're on the team":
```typescript
async function canViewEngagement(userId: string, tenantId: string, engagementId: string) {
  const membership = await prisma.engagementTeamMember.findFirst({
    where: { engagementId, userId, removedAt: null },
  });
  return membership !== null;
}
```

#### Conflict of Interest
"Approver cannot approve their own finding":
```typescript
async function canApproveFinding(approvalId: string, userId: string) {
  const approval = await prisma.approval.findUnique({ where: { id: approvalId } });
  const finding = await prisma.finding.findUnique({ where: { id: approval.entityId } });
  if (finding.createdById === userId) return false;  // Can't approve own
  return true;
}
```

#### Time-Bound Access
"API key has expired → deny":
```typescript
async function isApiKeyValid(keyId: string) {
  const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
  return key && !key.revokedAt && key.expiresAt > new Date();
}
```

#### Location-Based
"Some tenants restrict access to their corporate IP":
```typescript
async function isIpAllowed(tenantId: string, ipAddress: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const allowedCidrs = tenant.settings?.allowedIpCidrs ?? [];
  if (allowedCidrs.length === 0) return true;  // No restriction
  return allowedCidrs.some(cidr => ipInCidr(ipAddress, cidr));
}
```

### Implementation Pattern

ABAC checks happen in **service layer**, not tRPC middleware. Middleware handles RBAC; services layer enforces relational logic.

```typescript
// Service
async function getEngagement(tenantId: string, userId: string, engagementId: string) {
  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, tenantId },
  });
  if (!engagement) throw new NotFound();

  // ABAC: check access beyond RBAC
  if (!userHasPermission(user, 'engagement:view_all')) {
    const membership = await prisma.engagementTeamMember.findFirst({
      where: { engagementId, userId, removedAt: null },
    });
    if (!membership) throw new Forbidden();
  }

  return engagement;
}
```

---

## 6. Policy Engine (Future)

For complex ABAC at scale, adopt policy engine like **Cedar** (Amazon), **OPA** (Open Policy Agent), or build lightweight version with CASL.

### CASL Approach (Recommended for MVP)

```typescript
import { AbilityBuilder, createMongoAbility } from '@casl/ability';

function defineAbilitiesFor(user: User, tenantId: string): AppAbility {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  // RBAC
  user.permissions.forEach(p => {
    const [resource, action] = p.split(':');
    can(action, resource);
  });

  // ABAC overlays
  // "Can update only engagements on your team"
  if (!user.permissions.has('engagement:update_all')) {
    cannot('update', 'Engagement').because('Not on team');
    can('update', 'Engagement', {
      teamMembers: { $elemMatch: { userId: user.id, removedAt: null } }
    });
  }

  // "Cannot approve own finding"
  cannot('approve', 'Finding', { createdById: user.id }).because('Self-approval prohibited');

  return build();
}

// Usage
const ability = defineAbilitiesFor(user, tenantId);
if (ability.can('update', engagement)) { /* allow */ }
```

---

## 7. Permission Caching

### Why Cache
Permission checks happen on **every API request**. Loading from DB each time is expensive.

### Cache Layers

**Layer 1: Session JWT**
- User role + high-level permission flags embedded in JWT
- Valid for JWT lifetime (15 min)
- No DB hit for most checks

**Layer 2: Redis (shared)**
- Full permission set per (userId, tenantId)
- TTL: 5 min (shorter than JWT to catch role changes faster)
- Invalidated on role change events

**Layer 3: Database**
- Source of truth (`user_tenants.role` + `user_tenants.permissions` overrides)
- Only hit on cache miss

### Invalidation
```typescript
// When role changes:
await redis.del(`perms:${userId}:${tenantId}`);
await revokeJwtForUser(userId);  // Force JWT refresh

// Caches rebuild on next request
```

### Tradeoff
- 15-min window where stale permissions could be used (JWT hasn't refreshed)
- Mitigated: critical permission changes (demote DIRECTOR to VIEWER) also revoke sessions

---

## 8. Permission Evaluation Flow

```
Request arrives at tRPC procedure
  │
  ▼
Middleware chain:
  1. authRequired → ctx.auth populated (or 401)
  2. tenantContext → RLS session vars set
  3. requirePermission('engagement:view_all') → check ctx.auth.permissions
     - Yes: continue
     - No: check fallback requirement (e.g., 'engagement:view_assigned')
  4. rateLimitCheck → Redis token bucket
  │
  ▼
Procedure resolver:
  - Service layer call
  │
  ▼
Service layer:
  - RBAC check already happened via middleware
  - ABAC check: user on team?
  - RLS check: query filters by tenant_id automatically
  - Database returns tenant-scoped results only
  │
  ▼
Response
  │
  ▼
Audit log (via DB trigger): records access
```

Every layer fails closed. If any layer denies, request denied.

---

## 9. Permission Matrix (UI Reference)

Example: Engagement entity, per-role capability.

| Role | Create | Update | Delete | View Own | View All | Issue | Manage Team | Transition Status |
|------|--------|--------|--------|----------|----------|-------|-------------|-------------------|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DIRECTOR | ✅ | ✅ | 🔒 | ✅ | ✅ | ✅ | ✅ | ✅ |
| SUPERVISOR | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| SENIOR_AUDITOR | ❌ | 🔒 team | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| STAFF_AUDITOR | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| QA_REVIEWER | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| AUDITEE | ❌ | ❌ | ❌ | 🔒 assigned | ❌ | ❌ | ❌ | ❌ |
| VIEWER | ❌ | ❌ | ❌ | 🔒 assigned | ❌ | ❌ | ❌ | ❌ |

✅ = allowed  ❌ = denied  🔒 = conditional (ABAC rule)

UI renders matrix in Admin → Permissions for tenant admins to review.

---

## 10. Tenant Admin Permission Management

Tenant admins can:
- View role → permission assignments
- Override permissions per user (grant +extra, revoke -specific)
- Create custom roles (Enterprise tier)
- Lock certain role assignments (e.g., "ADMIN role can only be assigned by another ADMIN + MFA")

### Permission Override Format
Stored in `user_tenants.permissions` as array:
```json
[
  "+custom:permission",   // Grant this in addition to role defaults
  "-report:approve"       // Remove this from role defaults
]
```

Applied at permission resolution time.

### Audit
Every role change / permission override → `audit_log` + notification to affected user.

---

## 11. Permission Check Patterns

### tRPC Middleware (Fast, Declarative)
```typescript
engagementRouter = router({
  create: permissionProcedure('engagement:create')
    .input(...)
    .mutation(...),

  delete: permissionProcedure('engagement:delete')
    .use(requireRole('ADMIN', 'DIRECTOR'))  // Belt and suspenders
    .input(...)
    .mutation(...),
});
```

### Service Layer (Complex Logic)
```typescript
async function updateEngagement(tenantId, userId, engagementId, updates) {
  // RBAC passed (middleware ensured 'engagement:update')
  // ABAC: must be on team OR have view_all
  const user = await loadUser(userId, tenantId);

  if (!user.permissions.has('engagement:view_all')) {
    const onTeam = await isOnTeam(engagementId, userId);
    if (!onTeam) {
      throw new AppError('FORBIDDEN', 'Not on engagement team');
    }
  }

  // Additional check: engagement not locked
  const current = await prisma.engagement.findFirst({ where: { id: engagementId, tenantId } });
  if (current.lockedAt) {
    throw new AppError('LOCKED', 'Engagement is issued and immutable');
  }

  return prisma.engagement.update({ ... });
}
```

### Frontend (Defensive Only)
```tsx
// UI check is UX only; server is truth
const canEdit = useCan('engagement:update');
const canIssue = useCan('engagement:issue');

<Button disabled={!canEdit}>Edit</Button>
{canIssue && <Button>Issue</Button>}

// Even if user bypasses UI, server rejects unauthorized requests.
```

---

## 12. Tenant-Level Permission Policies

Tenants can set defaults:
- **Default role for invited users**: VIEWER (most secure) vs STAFF_AUDITOR (convenient)
- **Who can invite users**: Just ADMINs? Or SUPERVISORs too?
- **Who can issue findings**: DIRECTOR only, or SUPERVISOR+?
- **Require MFA for specific permissions**: `finding:issue` always requires fresh MFA

### Configuration Example
```json
{
  "tenantSettings": {
    "permissionPolicies": {
      "defaultInviteRole": "VIEWER",
      "canInviteRoles": ["ADMIN", "DIRECTOR"],
      "requireMfaForPermissions": [
        "finding:issue",
        "report:issue",
        "engagement:issue",
        "tenant:manage",
        "user:manage",
        "api_key:create",
        "data:export"
      ],
      "maxSessionsPerUser": null,
      "maxSessionsByRole": {
        "ADMIN": 3,
        "DIRECTOR": 5
      }
    }
  }
}
```

---

## 13. Compliance Considerations

### SOC 2 CC6.1 — Logical Access
- Principle of least privilege (role-based)
- Access reviews (quarterly, via admin UI)
- Audit trail for all permission changes

### SOX §302/404
- Separation of duties (auditor vs approver)
- Cannot approve own work (ABAC enforces)
- Audit trail of approvals

### GAGAS §5.03 — EQR Requirement
- EQR Reviewer must be **separate** from engagement team
- ABAC: `engagement:qaReview` denied if user was on team

### IIA GIAS 2024
- Independence (Principles 2, 7)
- Objectivity (Principle 2): cooling-off period — user who was in operational role for 12 months cannot audit that area. ABAC policy to check.

---

## 14. Testing Strategy

### Unit Tests
```typescript
describe('permissions', () => {
  test('STAFF_AUDITOR cannot approve findings', () => {
    const user = { role: 'STAFF_AUDITOR', permissions: ROLE_PERMISSIONS.STAFF_AUDITOR };
    expect(user.permissions.has('finding:approve')).toBe(false);
  });

  test('DIRECTOR can approve findings', () => {
    const user = { role: 'DIRECTOR', permissions: ROLE_PERMISSIONS.DIRECTOR };
    expect(user.permissions.has('finding:approve')).toBe(true);
  });

  test('User cannot approve own finding', async () => {
    const finding = await createFinding({ createdById: 'user_1' });
    expect(await canApproveFinding(finding.id, 'user_1')).toBe(false);
    expect(await canApproveFinding(finding.id, 'user_2')).toBe(true);
  });
});
```

### Integration Tests
```typescript
test('Cross-tenant isolation — RLS', async () => {
  const engagement = await createEngagement({ tenantId: 'tenant_a' });
  setTenantContext('tenant_b');  // Switch tenant
  const result = await findEngagement(engagement.id);
  expect(result).toBeNull();  // Should not be visible
});
```

### Policy Tests
Tests for each role × each permission × each entity. Automated matrix generation.

---

## 15. Known Permission Anti-Patterns to Avoid

- ❌ **Super-admin impersonation as default access** — too easy to misuse
- ❌ **Client-side permission logic only** — trivially bypassed
- ❌ **Hard-coded permission checks in business logic** — can't change without code
- ❌ **Permission names without prefix** — collisions across modules
- ❌ **Implicit permissions** — undocumented "if you can X then you can Y"
- ❌ **Nested permission checks scattered** — consolidate via middleware
- ❌ **Permission caching without invalidation** — stale perms lead to breaches

---

## 16. Implementation Checklist

- [ ] Define complete permission catalog (this doc)
- [ ] Create role → permission map in code
- [ ] Implement `requirePermission()` middleware
- [ ] Implement `requireRole()` middleware
- [ ] Integrate with tRPC procedure builders
- [ ] Build permission resolution service (with caching)
- [ ] Build ABAC helpers for common patterns (team membership, self-exclusion)
- [ ] Admin UI for viewing/modifying roles
- [ ] Admin UI for user-level permission overrides
- [ ] Audit logging for all permission changes
- [ ] Cache invalidation on role changes
- [ ] Tests (unit + integration)
- [ ] Documentation for tenant admins
- [ ] Fallback for "view_assigned" vs "view_all" pattern
- [ ] Custom role support (Enterprise tier)
