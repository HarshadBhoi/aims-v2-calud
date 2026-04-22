-- ============================================================================
-- AIMS v2 — Database Roles & Grants
-- ============================================================================
-- Principle of least privilege: different roles for different jobs.
-- ============================================================================

-- ============================================================================
-- 1. ROLES
-- ============================================================================

-- Application role — what the API connects as
-- Cannot bypass RLS. Cannot run DDL. Cannot escalate.
CREATE ROLE aims_app NOLOGIN;
COMMENT ON ROLE aims_app IS
  'Application role for API connections. Subject to RLS. No DDL permissions.';

-- Migration role — CI/CD uses this to run schema changes
-- Can run DDL. Still subject to RLS on data operations.
CREATE ROLE aims_migration NOLOGIN;
COMMENT ON ROLE aims_migration IS
  'CI/CD role for schema migrations. Can ALTER/CREATE/DROP objects. Not for runtime app.';

-- Read-only role — BI tools, reporting, analytics
-- Can SELECT anywhere subject to RLS. Cannot modify.
CREATE ROLE aims_readonly NOLOGIN;
COMMENT ON ROLE aims_readonly IS
  'Read-only role for reporting/BI. Subject to RLS. No writes.';

-- Superadmin role — platform operators for support
-- Can bypass RLS by setting app.is_superadmin = 'true'
-- Use sparingly; every superadmin action is logged.
CREATE ROLE aims_superadmin NOLOGIN;
COMMENT ON ROLE aims_superadmin IS
  'Platform operator role. Can bypass RLS when app.is_superadmin flag set. All actions logged.';

-- Tenant-specific login roles (created per tenant in production for stronger isolation)
-- These inherit from aims_app but can be restricted further.

-- ============================================================================
-- 2. GRANTS — aims_app (primary API role)
-- ============================================================================

-- Schema usage
GRANT USAGE ON SCHEMA public, audit, platform TO aims_app;

-- Public schema — full CRUD on tables (subject to RLS)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO aims_app;
-- No DELETE directly — use soft delete via UPDATE deleted_at
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM aims_app;

-- Sequences for ID generation (CUID2 handled app-side but safety net)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aims_app;

-- Audit schema — insert only for audit log
GRANT SELECT ON ALL TABLES IN SCHEMA audit TO aims_app;
GRANT INSERT ON audit.audit_log TO aims_app;
GRANT INSERT ON audit.workflow_events TO aims_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit.idempotency_keys TO aims_app;
-- Explicitly prevent updates/deletes on audit log and workflow events
REVOKE UPDATE, DELETE ON audit.audit_log FROM aims_app;
REVOKE UPDATE, DELETE ON audit.workflow_events FROM aims_app;

-- Platform schema — read-only for most tables; tenant_standard_packs writable
GRANT SELECT ON ALL TABLES IN SCHEMA platform TO aims_app;
GRANT INSERT, UPDATE ON platform.tenant_standard_packs TO aims_app;
REVOKE INSERT, UPDATE, DELETE ON platform.standard_packs FROM aims_app;
REVOKE INSERT, UPDATE, DELETE ON platform.pack_crosswalks FROM aims_app;

-- Execute helper functions
GRANT EXECUTE ON FUNCTION fn_current_tenant_id() TO aims_app;
GRANT EXECUTE ON FUNCTION fn_current_user_id() TO aims_app;
GRANT EXECUTE ON FUNCTION fn_is_superadmin() TO aims_app;

-- ============================================================================
-- 3. GRANTS — aims_migration (CI/CD role)
-- ============================================================================

GRANT USAGE, CREATE ON SCHEMA public, audit, platform TO aims_migration;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, audit, platform TO aims_migration;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, audit, platform TO aims_migration;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public, audit, platform TO aims_migration;

-- ============================================================================
-- 4. GRANTS — aims_readonly (BI / analytics)
-- ============================================================================

GRANT USAGE ON SCHEMA public, audit, platform TO aims_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public, audit, platform TO aims_readonly;

-- Bypass soft-deleted records via view (future: create views that exclude deleted_at NOT NULL)

-- Ensure future tables/sequences are accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public, audit, platform
  GRANT SELECT ON TABLES TO aims_readonly;

-- ============================================================================
-- 5. GRANTS — aims_superadmin (platform operators)
-- ============================================================================

-- Can do what aims_app can do, but also bypass RLS when flag set.
GRANT aims_app TO aims_superadmin;

-- Can read all tenants regardless of RLS (via fn_is_superadmin() check)
-- Can manage standard packs
GRANT SELECT, INSERT, UPDATE ON platform.standard_packs TO aims_superadmin;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.pack_crosswalks TO aims_superadmin;

-- Superadmin login users (Platform operators) are created explicitly:
-- CREATE USER platform_operator_jane WITH LOGIN PASSWORD '...' IN ROLE aims_superadmin;

-- ============================================================================
-- 6. DEFAULT PRIVILEGES FOR FUTURE OBJECTS
-- ============================================================================

-- Ensure new tables created by migration role are accessible to app role
ALTER DEFAULT PRIVILEGES FOR ROLE aims_migration IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO aims_app;

ALTER DEFAULT PRIVILEGES FOR ROLE aims_migration IN SCHEMA audit
  GRANT SELECT, INSERT ON TABLES TO aims_app;

ALTER DEFAULT PRIVILEGES FOR ROLE aims_migration IN SCHEMA platform
  GRANT SELECT ON TABLES TO aims_app;

-- ============================================================================
-- 7. CONNECTION LIMITS (production hardening)
-- ============================================================================

ALTER ROLE aims_app CONNECTION LIMIT 200;           -- API pool
ALTER ROLE aims_readonly CONNECTION LIMIT 50;       -- BI tools
ALTER ROLE aims_migration CONNECTION LIMIT 5;       -- CI/CD rare
ALTER ROLE aims_superadmin CONNECTION LIMIT 10;     -- Rare use

-- ============================================================================
-- 8. STATEMENT TIMEOUTS (prevent runaway queries)
-- ============================================================================

ALTER ROLE aims_app SET statement_timeout = '30s';
ALTER ROLE aims_readonly SET statement_timeout = '5min';  -- Reports can be long
ALTER ROLE aims_migration SET statement_timeout = '30min'; -- Migrations can be long
ALTER ROLE aims_superadmin SET statement_timeout = '60s';

-- ============================================================================
-- 9. LOGGING
-- ============================================================================

ALTER ROLE aims_app SET log_statement = 'ddl';      -- Log only DDL (which app shouldn't do)
ALTER ROLE aims_superadmin SET log_statement = 'all'; -- Log EVERY statement by superadmins

-- ============================================================================
-- 10. APPLICATION LOGIN USERS
-- ============================================================================

-- Create actual login users that inherit from roles.
-- In production, use secrets manager / IAM-based auth where possible.

-- Example (passwords managed via AWS Secrets Manager, Azure Key Vault, etc.):
-- CREATE USER aims_api_prod WITH LOGIN PASSWORD '<<from-secrets-manager>>' IN ROLE aims_app;
-- CREATE USER aims_api_staging WITH LOGIN PASSWORD '<<from-secrets-manager>>' IN ROLE aims_app;
-- CREATE USER aims_ci_migrations WITH LOGIN PASSWORD '<<from-secrets-manager>>' IN ROLE aims_migration;
-- CREATE USER aims_bi_readonly WITH LOGIN PASSWORD '<<from-secrets-manager>>' IN ROLE aims_readonly;

-- For RDS/Azure DB, prefer IAM database authentication over password auth.
