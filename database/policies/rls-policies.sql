-- ============================================================================
-- AIMS v2 — Row-Level Security (RLS) Policies
-- ============================================================================
-- Enforces tenant isolation at the database layer.
-- Even a compromised application cannot leak cross-tenant data.
--
-- Pattern:
--   1. App sets tenant context at session start:
--      SET LOCAL app.current_tenant_id = 'tenant_cuid_here';
--      SET LOCAL app.current_user_id   = 'user_cuid_here';
--      SET LOCAL app.is_superadmin     = 'false';
--
--   2. RLS policies filter: WHERE tenant_id = current_setting('app.current_tenant_id')
--
--   3. Superadmin operations use a dedicated role that bypasses RLS.
-- ============================================================================

-- ============================================================================
-- 1. HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_current_tenant_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', TRUE);
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_current_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_user_id', TRUE);
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.is_superadmin', TRUE)::BOOLEAN, FALSE);
EXCEPTION
  WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION fn_current_tenant_id IS
  'Returns the tenant_id set by the application for the current session. Returns NULL if not set.';

COMMENT ON FUNCTION fn_is_superadmin IS
  'Returns TRUE if the current session is a superadmin (platform operator). Used for RLS bypass.';

-- ============================================================================
-- 2. GENERIC TENANT ISOLATION POLICY
-- ============================================================================
-- Apply to every tenant-scoped table.

-- Enable RLS on all public schema tenant-scoped tables
ALTER TABLE public.tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_standard_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_team_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_phases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_programs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_program_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workpapers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workpaper_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workpaper_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_tests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finding_test_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sampling_worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.independence_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_reviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpe_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_universe_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_audit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_matrix     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files              ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.workflow_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.idempotency_keys    ENABLE ROW LEVEL SECURITY;

ALTER TABLE platform.tenant_standard_packs ENABLE ROW LEVEL SECURITY;

-- FORCE RLS so that the table owner is also subject to policies
-- (otherwise app user with table ownership bypasses RLS)
ALTER TABLE public.tenants            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.engagements        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_standard_packs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_team_members   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_phases  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.planning_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.work_programs      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.work_program_procedures FORCE ROW LEVEL SECURITY;
ALTER TABLE public.observations       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.findings           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.management_responses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.corrective_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workpapers         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workpaper_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workpaper_links    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_tests        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finding_test_links FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sampling_worksheets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reports            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_instances FORCE ROW LEVEL SECURITY;
ALTER TABLE public.independence_declarations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.peer_reviews       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.certifications     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cpe_records        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_universe_entities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.annual_audit_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.control_matrix     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approvals          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.files              FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. TENANT-SCOPED POLICIES
-- ============================================================================

-- Tenants table — users can only see their own tenant
CREATE POLICY tenant_isolation_tenants ON public.tenants
  USING (
    fn_is_superadmin()
    OR id = fn_current_tenant_id()
  );

-- Engagements
CREATE POLICY tenant_isolation_engagements ON public.engagements
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Findings
CREATE POLICY tenant_isolation_findings ON public.findings
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Recommendations
CREATE POLICY tenant_isolation_recommendations ON public.recommendations
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Corrective Actions
CREATE POLICY tenant_isolation_corrective_actions ON public.corrective_actions
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Workpapers
CREATE POLICY tenant_isolation_workpapers ON public.workpapers
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Reports
CREATE POLICY tenant_isolation_reports ON public.reports
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Approvals
CREATE POLICY tenant_isolation_approvals ON public.approvals
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Independence Declarations
CREATE POLICY tenant_isolation_independence ON public.independence_declarations
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Checklist Instances
CREATE POLICY tenant_isolation_checklists ON public.checklist_instances
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Peer Reviews
CREATE POLICY tenant_isolation_peer_reviews ON public.peer_reviews
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Time Entries
CREATE POLICY tenant_isolation_time_entries ON public.time_entries
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- CPE Records
CREATE POLICY tenant_isolation_cpe_records ON public.cpe_records
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Certifications
CREATE POLICY tenant_isolation_certifications ON public.certifications
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Audit Universe
CREATE POLICY tenant_isolation_audit_universe ON public.audit_universe_entities
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Annual Audit Plans
CREATE POLICY tenant_isolation_annual_plans ON public.annual_audit_plans
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Risk Assessments (per ADR-0009 — per-FY history table)
CREATE POLICY tenant_isolation_risk_assessments ON public.risk_assessments
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Control Matrix / PRCM (per ADR-0008 — separate model upstream of audit_tests)
CREATE POLICY tenant_isolation_control_matrix ON public.control_matrix
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Notifications (user-scoped within tenant)
CREATE POLICY tenant_isolation_notifications ON public.notifications
  USING (
    fn_is_superadmin()
    OR (
      tenant_id = fn_current_tenant_id()
      AND user_id = fn_current_user_id()
    )
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Files
CREATE POLICY tenant_isolation_files ON public.files
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- Users — users can see other users in their tenant(s)
CREATE POLICY tenant_isolation_users ON public.users
  USING (
    fn_is_superadmin()
    OR id = fn_current_user_id()
    OR id IN (
      SELECT user_id FROM public.user_tenants
      WHERE tenant_id = fn_current_tenant_id()
    )
  );

-- User-Tenant relationships
CREATE POLICY tenant_isolation_user_tenants ON public.user_tenants
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
    OR user_id = fn_current_user_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- ============================================================================
-- 4. AUDIT LOG (read-own-tenant, append-only)
-- ============================================================================

-- Read policy: can see own tenant audit log
CREATE POLICY audit_log_read ON audit.audit_log
  FOR SELECT
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  );

-- Insert policy: must insert with own tenant (or NULL for platform events)
CREATE POLICY audit_log_insert ON audit.audit_log
  FOR INSERT
  WITH CHECK (
    tenant_id IS NULL OR tenant_id = fn_current_tenant_id()
  );

-- NO UPDATE, NO DELETE policies — enforced by lack of permission + trigger

-- ============================================================================
-- 5. WORKFLOW EVENTS (append-only per tenant)
-- ============================================================================

CREATE POLICY workflow_events_read ON audit.workflow_events
  FOR SELECT
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  );

CREATE POLICY workflow_events_insert ON audit.workflow_events
  FOR INSERT
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- ============================================================================
-- 6. IDEMPOTENCY KEYS (tenant-scoped)
-- ============================================================================

CREATE POLICY idempotency_tenant_isolation ON audit.idempotency_keys
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- ============================================================================
-- 7. PLATFORM SCHEMA — Standard Packs (read-all, write-platform-admin)
-- ============================================================================

-- Standard Packs are public read (all tenants need to see available packs)
-- Writes restricted to platform admins via role grants (see roles.sql)

-- Tenant Standard Packs activation — tenant-scoped
CREATE POLICY tenant_pack_activation ON platform.tenant_standard_packs
  USING (
    fn_is_superadmin()
    OR tenant_id = fn_current_tenant_id()
  )
  WITH CHECK (
    tenant_id = fn_current_tenant_id()
  );

-- ============================================================================
-- 8. TESTING: Cross-Tenant Isolation
-- ============================================================================

-- This function should be run as part of automated tests
CREATE OR REPLACE FUNCTION test_tenant_isolation(
  tenant_a_id TEXT,
  tenant_b_id TEXT
) RETURNS TABLE(test_name TEXT, passed BOOLEAN, detail TEXT) AS $$
BEGIN
  -- Test 1: Tenant A cannot see Tenant B engagements
  SET LOCAL app.current_tenant_id = tenant_a_id;
  SET LOCAL app.is_superadmin = 'false';

  RETURN QUERY
  SELECT
    'engagements_isolation'::TEXT,
    NOT EXISTS (SELECT 1 FROM public.engagements WHERE tenant_id = tenant_b_id),
    'Tenant A should not see Tenant B engagements'::TEXT;

  -- Test 2: Tenant A cannot see Tenant B findings
  RETURN QUERY
  SELECT
    'findings_isolation'::TEXT,
    NOT EXISTS (SELECT 1 FROM public.findings WHERE tenant_id = tenant_b_id),
    'Tenant A should not see Tenant B findings'::TEXT;

  -- Test 3: Tenant A cannot see Tenant B audit log
  RETURN QUERY
  SELECT
    'audit_log_isolation'::TEXT,
    NOT EXISTS (SELECT 1 FROM audit.audit_log WHERE tenant_id = tenant_b_id),
    'Tenant A should not see Tenant B audit log'::TEXT;

  -- Reset
  RESET app.current_tenant_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION test_tenant_isolation IS
  'Automated test to verify tenant isolation is working. Run in CI after any RLS policy changes.';
