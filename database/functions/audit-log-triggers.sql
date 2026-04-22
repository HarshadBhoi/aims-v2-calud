-- ============================================================================
-- AIMS v2 — Audit Log Triggers with Hash Chain
-- ============================================================================
-- Implements tamper-evident audit logging using a hash chain.
--
-- Every inserted audit_log row contains:
--   - contentHash = SHA-256 of this row's key fields
--   - previousHash = SHA-256 of the previous row
-- If ANY row is tampered with, the chain breaks. Detection is O(n).
-- ============================================================================

-- ============================================================================
-- 1. HASH CHAIN ENFORCEMENT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION audit.fn_compute_audit_log_hash()
RETURNS TRIGGER AS $$
DECLARE
  prev_hash TEXT;
  new_hash  TEXT;
  canonical_content TEXT;
BEGIN
  -- Look up previous hash in same tenant (or platform-level if tenant_id NULL)
  SELECT content_hash INTO prev_hash
  FROM audit.audit_log
  WHERE (
    (NEW.tenant_id IS NULL AND tenant_id IS NULL)
    OR tenant_id = NEW.tenant_id
  )
  ORDER BY chain_position DESC
  LIMIT 1;

  -- Build canonical representation of this row
  canonical_content := concat_ws(
    '|',
    NEW.tenant_id,
    NEW.action::TEXT,
    NEW.entity_type,
    COALESCE(NEW.entity_id, ''),
    COALESCE(NEW.user_id, ''),
    NEW.logged_at::TEXT,
    COALESCE(NEW.before_data::TEXT, ''),
    COALESCE(NEW.after_data::TEXT, ''),
    COALESCE(prev_hash, '')
  );

  -- Compute SHA-256 hash
  new_hash := encode(digest(canonical_content, 'sha256'), 'hex');

  NEW.previous_hash := prev_hash;
  NEW.content_hash := new_hash;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_log_compute_hash
  BEFORE INSERT ON audit.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_compute_audit_log_hash();

COMMENT ON FUNCTION audit.fn_compute_audit_log_hash IS
  'Computes SHA-256 hash chain for audit_log. Prevents undetected tampering.';

-- ============================================================================
-- 2. PREVENT UPDATES AND DELETES ON AUDIT LOG
-- ============================================================================

CREATE OR REPLACE FUNCTION audit.fn_prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only. Updates and deletes are prohibited. Action: %', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON audit.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_prevent_audit_log_modification();

CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON audit.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_prevent_audit_log_modification();

COMMENT ON FUNCTION audit.fn_prevent_audit_log_modification IS
  'Blocks UPDATE and DELETE on audit_log. Append-only enforcement.';

-- ============================================================================
-- 3. HASH CHAIN VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION audit.fn_verify_audit_log_chain(
  p_tenant_id TEXT DEFAULT NULL,
  p_from_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  verified_count BIGINT,
  first_break_position BIGINT,
  first_break_id TEXT,
  status TEXT
) AS $$
DECLARE
  rec RECORD;
  expected_hash TEXT;
  canonical_content TEXT;
  computed_hash TEXT;
  last_hash TEXT;
  count_verified BIGINT := 0;
  break_position BIGINT := NULL;
  break_id TEXT := NULL;
BEGIN
  last_hash := NULL;

  FOR rec IN
    SELECT *
    FROM audit.audit_log
    WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
      AND (p_from_date IS NULL OR logged_at >= p_from_date)
    ORDER BY chain_position ASC
  LOOP
    -- Verify previous_hash matches last_hash
    IF count_verified > 0 AND rec.previous_hash IS DISTINCT FROM last_hash THEN
      break_position := rec.chain_position;
      break_id := rec.id;
      EXIT;
    END IF;

    -- Verify content_hash is correct
    canonical_content := concat_ws(
      '|',
      rec.tenant_id,
      rec.action::TEXT,
      rec.entity_type,
      COALESCE(rec.entity_id, ''),
      COALESCE(rec.user_id, ''),
      rec.logged_at::TEXT,
      COALESCE(rec.before_data::TEXT, ''),
      COALESCE(rec.after_data::TEXT, ''),
      COALESCE(rec.previous_hash, '')
    );

    computed_hash := encode(digest(canonical_content, 'sha256'), 'hex');

    IF rec.content_hash IS DISTINCT FROM computed_hash THEN
      break_position := rec.chain_position;
      break_id := rec.id;
      EXIT;
    END IF;

    last_hash := rec.content_hash;
    count_verified := count_verified + 1;
  END LOOP;

  RETURN QUERY SELECT
    count_verified,
    break_position,
    break_id,
    CASE
      WHEN break_position IS NULL THEN 'VALID'::TEXT
      ELSE 'TAMPERED'::TEXT
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit.fn_verify_audit_log_chain IS
  'Verifies the integrity of the audit_log hash chain. Returns VALID or TAMPERED with break point.';

-- ============================================================================
-- 4. GENERIC AUDIT TRIGGER FOR TENANT-SCOPED TABLES
-- ============================================================================
-- Attach to any table to auto-log changes.

CREATE OR REPLACE FUNCTION audit.fn_log_change()
RETURNS TRIGGER AS $$
DECLARE
  action_type audit.AuditLogAction;
  entity_type_var TEXT := TG_ARGV[0];  -- First argument: entity type name
  tenant_id_var TEXT;
  user_id_var TEXT;
BEGIN
  -- Determine action type
  action_type := CASE TG_OP
    WHEN 'INSERT' THEN 'CREATE'::audit.AuditLogAction
    WHEN 'UPDATE' THEN 'UPDATE'::audit.AuditLogAction
    WHEN 'DELETE' THEN 'DELETE'::audit.AuditLogAction
  END;

  -- Determine tenant_id
  tenant_id_var := fn_current_tenant_id();
  user_id_var := fn_current_user_id();

  -- Skip audit logging if tenant context not set (e.g., during migration)
  IF tenant_id_var IS NULL AND NOT fn_is_superadmin() THEN
    RAISE EXCEPTION 'Cannot modify % without tenant context. Set app.current_tenant_id.', entity_type_var;
  END IF;

  -- Determine entity_id
  DECLARE
    entity_id_var TEXT;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      entity_id_var := (OLD.id)::TEXT;
    ELSE
      entity_id_var := (NEW.id)::TEXT;
    END IF;

    -- Insert into audit log
    INSERT INTO audit.audit_log (
      id,
      tenant_id,
      action,
      entity_type,
      entity_id,
      user_id,
      before_data,
      after_data,
      logged_at
    ) VALUES (
      encode(gen_random_bytes(16), 'hex'),  -- Quick unique ID (replace with CUID2 lib in app)
      tenant_id_var,
      action_type,
      entity_type_var,
      entity_id_var,
      user_id_var,
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::JSONB ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::JSONB ELSE NULL END,
      CURRENT_TIMESTAMP
    );
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit.fn_log_change IS
  'Generic audit trigger. Attach with: CREATE TRIGGER trg_audit_X AFTER INSERT OR UPDATE OR DELETE ON X FOR EACH ROW EXECUTE FUNCTION audit.fn_log_change(''X_entity_type'');';

-- ============================================================================
-- 5. ATTACH AUDIT TRIGGERS TO KEY TABLES
-- ============================================================================

-- Engagements
CREATE TRIGGER trg_audit_engagements
  AFTER INSERT OR UPDATE OR DELETE ON public.engagements
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('engagement');

-- Findings (high-security: most important audit trail)
CREATE TRIGGER trg_audit_findings
  AFTER INSERT OR UPDATE OR DELETE ON public.findings
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('finding');

-- Recommendations
CREATE TRIGGER trg_audit_recommendations
  AFTER INSERT OR UPDATE OR DELETE ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('recommendation');

-- Corrective Actions
CREATE TRIGGER trg_audit_corrective_actions
  AFTER INSERT OR UPDATE OR DELETE ON public.corrective_actions
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('corrective_action');

-- Workpapers
CREATE TRIGGER trg_audit_workpapers
  AFTER INSERT OR UPDATE OR DELETE ON public.workpapers
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('workpaper');

-- Reports
CREATE TRIGGER trg_audit_reports
  AFTER INSERT OR UPDATE OR DELETE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('report');

-- Independence Declarations
CREATE TRIGGER trg_audit_independence
  AFTER INSERT OR UPDATE OR DELETE ON public.independence_declarations
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('independence_declaration');

-- Approvals (workflow state changes)
CREATE TRIGGER trg_audit_approvals
  AFTER INSERT OR UPDATE OR DELETE ON public.approvals
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('approval');

-- Users (for role/permission changes)
CREATE TRIGGER trg_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('user');

-- User-Tenant (role grants)
CREATE TRIGGER trg_audit_user_tenants
  AFTER INSERT OR UPDATE OR DELETE ON public.user_tenants
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('user_tenant');

-- Management responses
CREATE TRIGGER trg_audit_mgmt_responses
  AFTER INSERT OR UPDATE OR DELETE ON public.management_responses
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('management_response');

-- Checklist completions
CREATE TRIGGER trg_audit_checklist_instances
  AFTER INSERT OR UPDATE OR DELETE ON public.checklist_instances
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('checklist_instance');

-- Files (for upload/deletion tracking)
CREATE TRIGGER trg_audit_files
  AFTER INSERT OR UPDATE OR DELETE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_log_change('file');

-- ============================================================================
-- 6. PARTITIONING audit_log BY MONTH
-- ============================================================================
-- Auto-create partitions for incoming months.

-- Convert audit_log to partitioned table (done during initial migration)
-- NOTE: This assumes the table was created with PARTITION BY RANGE (logged_at).
-- Prisma doesn't directly support partitioning, so this is done via raw SQL migration.

-- Automatic partition creation via pg_cron
CREATE OR REPLACE FUNCTION audit.fn_create_monthly_partitions(
  months_ahead INT DEFAULT 3
) RETURNS VOID AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  partition_name TEXT;
  i INT;
BEGIN
  FOR i IN 0..months_ahead LOOP
    start_date := date_trunc('month', CURRENT_DATE + (i * INTERVAL '1 month'))::DATE;
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'audit_log_' || to_char(start_date, 'YYYY_MM');

    -- Create partition if not exists
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS audit.%I PARTITION OF audit.audit_log
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );

    -- Create indexes on partition
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON audit.%I (tenant_id, entity_type, entity_id, logged_at)',
      partition_name || '_tenant_entity_idx', partition_name
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit.fn_create_monthly_partitions IS
  'Creates audit_log partitions for upcoming months. Scheduled monthly via pg_cron.';

-- Schedule monthly partition creation
-- SELECT cron.schedule('audit-log-partitions', '0 0 1 * *', $$SELECT audit.fn_create_monthly_partitions(3);$$);

-- ============================================================================
-- 7. ARCHIVAL: DROP OLD PARTITIONS AFTER RETENTION
-- ============================================================================

CREATE OR REPLACE FUNCTION audit.fn_archive_old_partitions(
  retention_years INT DEFAULT 7
) RETURNS VOID AS $$
DECLARE
  cutoff_date DATE;
  partition_record RECORD;
BEGIN
  cutoff_date := (CURRENT_DATE - (retention_years * INTERVAL '1 year'))::DATE;

  FOR partition_record IN
    SELECT
      c.relname AS partition_name,
      pg_catalog.pg_get_expr(c.relpartbound, c.oid) AS range_spec
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'audit'
      AND c.relkind = 'r'
      AND c.relname LIKE 'audit_log_%'
  LOOP
    -- Parse range spec to determine partition end date
    -- If end date < cutoff, archive (export + drop)
    -- Production: export to S3/cold storage before dropping
    -- This is a placeholder — full implementation depends on archival infrastructure
    RAISE NOTICE 'Partition % range: %', partition_record.partition_name, partition_record.range_spec;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule annually
-- SELECT cron.schedule('audit-log-archival', '0 2 1 1 *', $$SELECT audit.fn_archive_old_partitions(7);$$);
