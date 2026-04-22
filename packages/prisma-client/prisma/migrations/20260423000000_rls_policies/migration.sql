-- AIMS v2 — Row-Level Security policies (defence-in-depth per ADR-0002)
--
-- Primary enforcement is the Prisma Client Extension (packages/prisma-client/src/
-- prisma-extension.ts) — this migration layers Postgres RLS on top as a fallback.
--
-- Pattern:
--   Every query runs inside a transaction that first calls set_config to set
--   'app.current_tenant'. RLS policies evaluate current_setting('app.current_tenant', true)
--   and filter rows / block writes that don't match.
--
--   If someone ever bypasses the Prisma Client Extension (raw SQL, different client,
--   misconfigured middleware) AND is using a role that doesn't have BYPASSRLS,
--   RLS catches the attempt at the database layer.
--
-- Roles (seeded in infra/postgres/init.sql for dev):
--   aims_app          — runtime. RLS active.
--   aims_migration    — DDL + seed. BYPASSRLS (bypasses these policies).
--   aims_readonly     — analytics. RLS active; reads only.
--   aims_superadmin   — break-glass. BYPASSRLS.
--
-- Tenant-scoped models: Tenant (self-scope by id), User, MfaSecret, Session,
-- SessionBlocklist, Engagement, PackAttachment, Finding, ApprovalRequest, Report,
-- ReportVersion, AuditLog, OutboxEvent.
--
-- Cross-tenant: StandardPack (platform schema). RLS intentionally not enabled.

-- ─── public schema: enable RLS and add tenant_isolation policy ─────────────

ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tenants" FORCE ROW LEVEL SECURITY;

-- Tenant is self-scoped: its own id is the tenantId.
CREATE POLICY tenant_self_isolation ON "public"."tenants"
  USING ("id" = current_setting('app.current_tenant', true))
  WITH CHECK ("id" = current_setting('app.current_tenant', true));

-- All other public tables: scope by tenantId column.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'users', 'mfa_secrets', 'sessions', 'session_blocklist',
    'engagements', 'pack_attachments', 'findings',
    'approval_requests', 'reports', 'report_versions'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'public', t);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', 'public', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I.%I ' ||
      'USING ("tenantId" = current_setting(''app.current_tenant'', true)) ' ||
      'WITH CHECK ("tenantId" = current_setting(''app.current_tenant'', true))',
      'public', t
    );
  END LOOP;
END $$;

-- ─── audit schema: same pattern ───────────────────────────────────────────

ALTER TABLE "audit"."audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit"."audit_log" FORCE ROW LEVEL SECURITY;

-- audit_log.tenantId is nullable (platform-level events). Tenant users see only
-- their own rows (NULL comparison returns NULL, not true, so NULL rows excluded).
-- Platform admins reach platform-level events via the admin client (BYPASSRLS role).
CREATE POLICY tenant_isolation ON "audit"."audit_log"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "audit"."outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit"."outbox_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "audit"."outbox_events"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

-- ─── platform schema: NO RLS (StandardPack is deliberately cross-tenant) ──
-- Intentionally empty. StandardPack is read by all tenants; no filter applied.

-- ─── Grants (guarded — roles may not exist in test containers) ────────────
-- Dev infra init.sql creates aims_app/aims_migration/aims_readonly.
-- Test containers may have only the default test user. Guard with IF EXISTS.

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'aims_app') THEN
    -- Schema USAGE (required to reach tables)
    EXECUTE 'GRANT USAGE ON SCHEMA public TO aims_app';
    EXECUTE 'GRANT USAGE ON SCHEMA audit TO aims_app';
    EXECUTE 'GRANT USAGE ON SCHEMA platform TO aims_app';

    -- Table grants
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aims_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA audit TO aims_app';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA platform TO aims_app';

    -- Sequence USAGE (for autoincrement columns, e.g. audit_log.chain_position)
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aims_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA audit TO aims_app';

    -- Default privileges for future tables (created by subsequent migrations
    -- as aims_migration).
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aims_migration IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aims_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aims_migration IN SCHEMA audit GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aims_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aims_migration IN SCHEMA platform GRANT SELECT ON TABLES TO aims_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aims_migration IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO aims_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aims_migration IN SCHEMA audit GRANT USAGE, SELECT ON SEQUENCES TO aims_app';
  END IF;

  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'aims_readonly') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO aims_readonly';
    EXECUTE 'GRANT USAGE ON SCHEMA audit TO aims_readonly';
    EXECUTE 'GRANT USAGE ON SCHEMA platform TO aims_readonly';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO aims_readonly';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA audit TO aims_readonly';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA platform TO aims_readonly';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aims_migration IN SCHEMA public GRANT SELECT ON TABLES TO aims_readonly';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aims_migration IN SCHEMA audit GRANT SELECT ON TABLES TO aims_readonly';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aims_migration IN SCHEMA platform GRANT SELECT ON TABLES TO aims_readonly';
  END IF;
END $$;
