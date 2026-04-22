-- ============================================================================
-- AIMS v2 — Immutability Enforcement
-- ============================================================================
-- Once a finding/report/engagement is ISSUED, the record is frozen.
-- Required by GAGAS (§6.55, §8.51), SOX (§802), ISO 19011 (audit evidence integrity).
--
-- Approach:
--   - status columns transition to terminal values (ISSUED, LOCKED, APPROVED+)
--   - trigger prevents UPDATE on columns other than metadata/audit_trail fields
--   - locked_at timestamp is set at terminal transition
--   - Amendments are handled via NEW records that supersede old ones
-- ============================================================================

-- ============================================================================
-- 1. GENERIC IMMUTABILITY TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_prevent_locked_update()
RETURNS TRIGGER AS $$
DECLARE
  -- Fields that ARE allowed to change even after lock
  allowed_metadata_fields TEXT[] := ARRAY[
    '_version',
    'updated_at',
    'deleted_at'    -- Soft delete allowed with audit trail
  ];
BEGIN
  -- If OLD record is locked and NEW tries to change anything meaningful
  IF OLD.locked_at IS NOT NULL THEN
    -- Check if any non-metadata field is changing
    IF row_to_json(NEW)::JSONB - allowed_metadata_fields
      IS DISTINCT FROM
       row_to_json(OLD)::JSONB - allowed_metadata_fields
    THEN
      RAISE EXCEPTION
        'Record % is locked (locked_at=%). Modifications require creating an amendment/new version.',
        OLD.id, OLD.locked_at
      USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.fn_prevent_locked_update IS
  'Prevents updates to records with locked_at set. Metadata fields (updated_at, version, deleted_at) allowed. Attach to tables with locked_at columns.';

-- ============================================================================
-- 2. ATTACH TO TABLES WITH IMMUTABILITY REQUIREMENTS
-- ============================================================================

-- Engagements (locked after ISSUED status)
CREATE TRIGGER trg_engagements_immutability
  BEFORE UPDATE ON public.engagements
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_locked_update();

-- Findings (locked after ISSUED — critical for legal defensibility)
CREATE TRIGGER trg_findings_immutability
  BEFORE UPDATE ON public.findings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_locked_update();

-- Reports (locked after ISSUED)
CREATE TRIGGER trg_reports_immutability
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_locked_update();

-- Independence Declarations (immutable after signing)
CREATE TRIGGER trg_independence_immutability
  BEFORE UPDATE ON public.independence_declarations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_locked_update();

-- ============================================================================
-- 3. STATUS-BASED AUTO-LOCK TRIGGERS
-- ============================================================================

-- Auto-set locked_at when finding transitions to ISSUED
CREATE OR REPLACE FUNCTION public.fn_auto_lock_on_issued()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to ISSUED and not already locked
  IF NEW.status::TEXT = 'ISSUED' AND OLD.status::TEXT != 'ISSUED' AND NEW.locked_at IS NULL THEN
    NEW.locked_at := CURRENT_TIMESTAMP;
    NEW.locked_by := fn_current_user_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_findings_auto_lock
  BEFORE UPDATE ON public.findings
  FOR EACH ROW
  WHEN (NEW.status::TEXT = 'ISSUED')
  EXECUTE FUNCTION public.fn_auto_lock_on_issued();

CREATE TRIGGER trg_reports_auto_lock
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  WHEN (NEW.status::TEXT = 'DRAFT' IS NOT TRUE)  -- Any status other than DRAFT
  EXECUTE FUNCTION public.fn_auto_lock_on_issued();

-- ============================================================================
-- 4. PREVENT STATUS REVERSION
-- ============================================================================
-- Cannot go from ISSUED back to DRAFT.

CREATE OR REPLACE FUNCTION public.fn_prevent_status_reversion()
RETURNS TRIGGER AS $$
DECLARE
  -- Terminal statuses that cannot be reverted
  terminal_statuses TEXT[] := ARRAY['ISSUED', 'CLOSED', 'WITHDRAWN', 'LOCKED'];
BEGIN
  IF OLD.status::TEXT = ANY(terminal_statuses)
     AND NEW.status::TEXT NOT IN (SELECT unnest(terminal_statuses))
  THEN
    RAISE EXCEPTION
      'Cannot revert % from terminal status % to %. Create amendment/new version instead.',
      TG_TABLE_NAME, OLD.status, NEW.status
    USING ERRCODE = 'invalid_transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_findings_no_status_reversion
  BEFORE UPDATE ON public.findings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_prevent_status_reversion();

CREATE TRIGGER trg_reports_no_status_reversion
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_prevent_status_reversion();

-- ============================================================================
-- 5. WORKPAPER VERSION IMMUTABILITY
-- ============================================================================
-- Workpaper versions are immutable — to change content, create new version.

CREATE OR REPLACE FUNCTION public.fn_prevent_workpaper_version_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow soft delete
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Block other changes
  IF row_to_json(OLD)::JSONB IS DISTINCT FROM row_to_json(NEW)::JSONB THEN
    RAISE EXCEPTION
      'Workpaper version % is immutable. Create a new version to change content.',
      OLD.id
    USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workpaper_versions_immutable
  BEFORE UPDATE ON public.workpaper_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_workpaper_version_update();

-- ============================================================================
-- 6. STANDARD PACK IMMUTABILITY (ONCE PUBLISHED)
-- ============================================================================

CREATE OR REPLACE FUNCTION platform.fn_prevent_published_pack_update()
RETURNS TRIGGER AS $$
DECLARE
  immutable_statuses TEXT[] := ARRAY['EFFECTIVE', 'TRANSITIONING', 'SUPERSEDED', 'WITHDRAWN'];
BEGIN
  -- Allow status transitions (e.g., PROPOSED -> EFFECTIVE)
  -- Allow metadata-only updates
  IF OLD.status::TEXT = ANY(immutable_statuses) THEN
    -- Content and key metadata cannot change
    IF OLD.pack_content::TEXT IS DISTINCT FROM NEW.pack_content::TEXT
       OR OLD.code IS DISTINCT FROM NEW.code
       OR OLD.version IS DISTINCT FROM NEW.version
       OR OLD.content_hash IS DISTINCT FROM NEW.content_hash
    THEN
      RAISE EXCEPTION
        'Standard pack %:% (status=%) is published and cannot be modified. Create a new version.',
        OLD.code, OLD.version, OLD.status
      USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_standard_packs_immutable
  BEFORE UPDATE ON platform.standard_packs
  FOR EACH ROW
  EXECUTE FUNCTION platform.fn_prevent_published_pack_update();

-- ============================================================================
-- 7. INDEPENDENCE DECLARATION IMMUTABILITY
-- ============================================================================
-- Signed independence declarations CANNOT be modified (audit evidence)

CREATE OR REPLACE FUNCTION public.fn_independence_immutable_once_signed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL THEN
    -- Only allow timestamp-only updates (like updated_at)
    IF OLD.responses::TEXT IS DISTINCT FROM NEW.responses::TEXT
       OR OLD.has_impairments IS DISTINCT FROM NEW.has_impairments
       OR OLD.impairment_details IS DISTINCT FROM NEW.impairment_details
       OR OLD.signed_by IS DISTINCT FROM NEW.signed_by
       OR OLD.signed_hash IS DISTINCT FROM NEW.signed_hash
    THEN
      RAISE EXCEPTION
        'Independence declaration % was signed on %. Cannot be modified. Create new declaration if needed.',
        OLD.id, OLD.signed_at
      USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_independence_immutable_once_signed
  BEFORE UPDATE ON public.independence_declarations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_independence_immutable_once_signed();

-- ============================================================================
-- 8. APPROVAL RECORD IMMUTABILITY
-- ============================================================================
-- Once an approval decision is recorded (APPROVED/REJECTED), it's immutable.

CREATE OR REPLACE FUNCTION public.fn_prevent_approval_decision_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.decided_at IS NOT NULL THEN
    IF OLD.status::TEXT IS DISTINCT FROM NEW.status::TEXT
       OR OLD.decision_comments IS DISTINCT FROM NEW.decision_comments
       OR OLD.signed_hash IS DISTINCT FROM NEW.signed_hash
       OR OLD.signed_by IS DISTINCT FROM NEW.signed_by
    THEN
      RAISE EXCEPTION
        'Approval decision (id=%) was made on %. Cannot be modified. Create new approval if needed.',
        OLD.id, OLD.decided_at
      USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_approvals_immutable_decision
  BEFORE UPDATE ON public.approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_approval_decision_change();

-- ============================================================================
-- 9. CHECK CONSTRAINTS
-- ============================================================================

-- Engagement date consistency
ALTER TABLE public.engagements
  ADD CONSTRAINT chk_engagements_actual_dates
  CHECK (actual_start_date IS NULL OR actual_end_date IS NULL OR actual_start_date <= actual_end_date);

ALTER TABLE public.engagements
  ADD CONSTRAINT chk_engagements_planned_dates
  CHECK (planned_start_date IS NULL OR planned_end_date IS NULL OR planned_start_date <= planned_end_date);

ALTER TABLE public.engagements
  ADD CONSTRAINT chk_engagements_period_dates
  CHECK (period_start_date IS NULL OR period_end_date IS NULL OR period_start_date <= period_end_date);

-- Engagement budgeted hours non-negative
ALTER TABLE public.engagements
  ADD CONSTRAINT chk_engagements_budgeted_hours
  CHECK (budgeted_hours IS NULL OR budgeted_hours >= 0);

-- Finding valid time consistency
ALTER TABLE public.findings
  ADD CONSTRAINT chk_findings_valid_dates
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to);

-- Questioned costs non-negative
ALTER TABLE public.findings
  ADD CONSTRAINT chk_findings_questioned_costs_known
  CHECK (questioned_costs_known IS NULL OR questioned_costs_known >= 0);

ALTER TABLE public.findings
  ADD CONSTRAINT chk_findings_questioned_costs_likely
  CHECK (questioned_costs_likely IS NULL OR questioned_costs_likely >= 0);

-- Classification requires scheme
ALTER TABLE public.findings
  ADD CONSTRAINT chk_findings_classification
  CHECK (
    (classification IS NULL AND classification_scheme IS NULL)
    OR (classification IS NOT NULL AND classification_scheme IS NOT NULL)
  );

-- CAP due date must be after or equal to engagement period
ALTER TABLE public.corrective_actions
  ADD CONSTRAINT chk_corrective_actions_completed_after_start
  CHECK (started_at IS NULL OR completed_at IS NULL OR started_at <= completed_at);

-- Time entry hours reasonable
ALTER TABLE public.time_entries
  ADD CONSTRAINT chk_time_entries_hours
  CHECK (hours >= 0 AND hours <= 24);

-- CPE hours non-negative
ALTER TABLE public.cpe_records
  ADD CONSTRAINT chk_cpe_records_hours
  CHECK (hours >= 0);

-- Fiscal year reasonable
ALTER TABLE public.annual_audit_plans
  ADD CONSTRAINT chk_annual_audit_plans_fiscal_year
  CHECK (fiscal_year >= 1900 AND fiscal_year <= 2200);

-- Tenant fiscal year start month
ALTER TABLE public.tenants
  ADD CONSTRAINT chk_tenants_fiscal_year_start_month
  CHECK (fiscal_year_start_month >= 1 AND fiscal_year_start_month <= 12);

-- Retention years reasonable
ALTER TABLE public.tenants
  ADD CONSTRAINT chk_tenants_retention_years
  CHECK (retention_years >= 1 AND retention_years <= 100);

-- ============================================================================
-- 10. OPTIMISTIC CONCURRENCY CONTROL
-- ============================================================================
-- Increment version on every update.

CREATE OR REPLACE FUNCTION public.fn_increment_version()
RETURNS TRIGGER AS $$
BEGIN
  IF row_to_json(OLD) IS DISTINCT FROM row_to_json(NEW) THEN
    NEW._version := COALESCE(OLD._version, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all major tables with _version column
CREATE TRIGGER trg_engagements_version BEFORE UPDATE ON public.engagements FOR EACH ROW EXECUTE FUNCTION public.fn_increment_version();
CREATE TRIGGER trg_findings_version BEFORE UPDATE ON public.findings FOR EACH ROW EXECUTE FUNCTION public.fn_increment_version();
CREATE TRIGGER trg_recommendations_version BEFORE UPDATE ON public.recommendations FOR EACH ROW EXECUTE FUNCTION public.fn_increment_version();
CREATE TRIGGER trg_corrective_actions_version BEFORE UPDATE ON public.corrective_actions FOR EACH ROW EXECUTE FUNCTION public.fn_increment_version();
CREATE TRIGGER trg_workpapers_version BEFORE UPDATE ON public.workpapers FOR EACH ROW EXECUTE FUNCTION public.fn_increment_version();
CREATE TRIGGER trg_reports_version BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.fn_increment_version();
CREATE TRIGGER trg_approvals_version BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.fn_increment_version();
