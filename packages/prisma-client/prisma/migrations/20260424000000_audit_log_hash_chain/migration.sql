-- AIMS v2 — Audit log hash chain (tamper-evident append-only log)
--
-- Every mutation to a tracked business-object table fires a trigger that
-- appends a row to audit.audit_log. The row's content_hash is SHA-256 of a
-- canonical JSON representation that INCLUDES the previous row's hash.
-- Breaking any row breaks the chain; audit.verify_chain() detects the break.
--
-- Tracked tables (slice A business journey):
--   engagements, pack_attachments, findings, approval_requests,
--   reports, report_versions
--
-- Not using pgcrypto (banned for field encryption by ADR-0001). Using
-- Postgres's built-in sha256() for one-way hashing only — no key material.

-- ─── Canonical hash function ──────────────────────────────────────────────
-- Shared by both the trigger (which INSERTs new rows) and verify_chain
-- (which recomputes expected hashes during audit). Deterministic for a given
-- input; any byte change produces a different hash.

CREATE OR REPLACE FUNCTION audit.compute_row_hash(
  p_tenant_id   text,
  p_action      text,
  p_entity_type text,
  p_entity_id   text,
  p_after_data  jsonb,
  p_logged_at   timestamptz,
  p_prev_hash   text
) RETURNS text AS $$
  SELECT encode(
    sha256(
      convert_to(
        json_build_object(
          'v',           1,
          'tenantId',    p_tenant_id,
          'action',      p_action,
          'entityType',  p_entity_type,
          'entityId',    p_entity_id,
          'afterData',   p_after_data,
          'loggedAt',    to_char(p_logged_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'previousHash', p_prev_hash
        )::text,
        'UTF8'
      )
    ),
    'hex'
  );
$$ LANGUAGE sql IMMUTABLE;

-- ─── Trigger function: appends to audit.audit_log on any mutation ────────

CREATE OR REPLACE FUNCTION audit.trigger_audit_log() RETURNS trigger AS $$
DECLARE
  v_tenant_id   text;
  v_entity_id   text;
  v_after_data  jsonb;
  v_before_data jsonb;
  v_action      text;
  v_prev_hash   text;
  v_content_hash text;
  v_logged_at   timestamptz := clock_timestamp();
BEGIN
  -- Determine action + extract row data.
  -- The tracked tables all have `id` and `tenantId` columns, so this works
  -- for every trigger attached to them.
  IF TG_OP = 'INSERT' THEN
    v_action      := 'CREATE';
    v_tenant_id   := (NEW)."tenantId";
    v_entity_id   := (NEW).id;
    v_after_data  := to_jsonb(NEW);
    v_before_data := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action      := 'UPDATE';
    v_tenant_id   := (NEW)."tenantId";
    v_entity_id   := (NEW).id;
    v_after_data  := to_jsonb(NEW);
    v_before_data := to_jsonb(OLD);
  ELSIF TG_OP = 'DELETE' THEN
    v_action      := 'DELETE';
    v_tenant_id   := (OLD)."tenantId";
    v_entity_id   := (OLD).id;
    v_after_data  := NULL;
    v_before_data := to_jsonb(OLD);
  END IF;

  -- Serialize chain writes so two concurrent mutations can't fork the chain.
  -- xact-scoped lock releases on COMMIT/ROLLBACK.
  PERFORM pg_advisory_xact_lock(hashtext('aims.audit_log_chain'));

  -- Fetch the current tip of the chain (may be NULL on the very first row).
  SELECT "contentHash"
  INTO v_prev_hash
  FROM audit.audit_log
  ORDER BY "chainPosition" DESC
  LIMIT 1;

  v_content_hash := audit.compute_row_hash(
    v_tenant_id,
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    v_after_data,
    v_logged_at,
    v_prev_hash
  );

  INSERT INTO audit.audit_log (
    "id",
    "tenantId",
    "action",
    "entityType",
    "entityId",
    "afterData",
    "beforeData",
    "previousHash",
    "contentHash",
    "loggedAt"
  ) VALUES (
    gen_random_uuid()::text,
    v_tenant_id,
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    v_after_data,
    v_before_data,
    v_prev_hash,
    v_content_hash,
    v_logged_at
  );

  RETURN NULL; -- AFTER trigger — return value ignored
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Verification function ────────────────────────────────────────────────
-- Walks the chain in chainPosition order, recomputes each hash, and returns
-- the first break or NULL if the whole chain verifies.
--
-- Returns a single row:
--   ok          boolean — true if chain intact
--   broken_at   bigint  — chainPosition of first broken row, NULL if ok
--   total_rows  bigint  — number of rows verified (or examined before break)
--   reason      text    — human-readable explanation

CREATE OR REPLACE FUNCTION audit.verify_chain()
RETURNS TABLE(ok boolean, broken_at bigint, total_rows bigint, reason text) AS $$
DECLARE
  r record;
  expected_prev text := NULL;
  expected_hash text;
  row_count     bigint := 0;
BEGIN
  FOR r IN
    SELECT *
    FROM audit.audit_log
    ORDER BY "chainPosition" ASC
  LOOP
    row_count := row_count + 1;

    -- Check that this row's prev_hash matches the running expected value.
    IF r."previousHash" IS DISTINCT FROM expected_prev THEN
      ok         := false;
      broken_at  := r."chainPosition";
      total_rows := row_count;
      reason     := format(
        'previous_hash mismatch at chainPosition %s: row has %L, expected %L',
        r."chainPosition",
        r."previousHash",
        expected_prev
      );
      RETURN NEXT;
      RETURN;
    END IF;

    -- Recompute this row's content_hash and compare.
    expected_hash := audit.compute_row_hash(
      r."tenantId",
      r."action",
      r."entityType",
      r."entityId",
      r."afterData",
      r."loggedAt",
      r."previousHash"
    );

    IF r."contentHash" != expected_hash THEN
      ok         := false;
      broken_at  := r."chainPosition";
      total_rows := row_count;
      reason     := format(
        'content_hash mismatch at chainPosition %s (row was tampered)',
        r."chainPosition"
      );
      RETURN NEXT;
      RETURN;
    END IF;

    expected_prev := r."contentHash";
  END LOOP;

  ok         := true;
  broken_at  := NULL;
  total_rows := row_count;
  reason     := format('chain intact (%s rows)', row_count);
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Attach triggers to the six business-object tables ────────────────────

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "public"."engagements"
  FOR EACH ROW EXECUTE FUNCTION audit.trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "public"."pack_attachments"
  FOR EACH ROW EXECUTE FUNCTION audit.trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "public"."findings"
  FOR EACH ROW EXECUTE FUNCTION audit.trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "public"."approval_requests"
  FOR EACH ROW EXECUTE FUNCTION audit.trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "public"."reports"
  FOR EACH ROW EXECUTE FUNCTION audit.trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "public"."report_versions"
  FOR EACH ROW EXECUTE FUNCTION audit.trigger_audit_log();
