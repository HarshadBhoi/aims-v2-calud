-- AIMS v2 — Postgres bootstrap
--
-- Runs once when the Postgres container initializes its data directory.
-- Adapted from database/policies/roles.sql (canonical).
--
-- Creates:
--   extensions required by the slice a schema (uuid generation, trigram search, citext)
--   four roles per ADR-0002 two-layer tenant isolation:
--     aims_app         runtime role — RLS active, lowest privilege
--     aims_migration   DDL + migrations — can create tables, bypass RLS for setup
--     aims_readonly    analytics + support-mode reads (future)
--     aims_superadmin  break-glass only — bypasses RLS, never used by the app
--
-- Passwords come from docker-compose env vars (substituted by the shell when
-- psql invokes this file via docker-entrypoint).

-- ─── Extensions ──────────────────────────────────────────────────────────────
-- uuid-ossp: legacy (PG 13+ has gen_random_uuid() built-in, but keep in case
--            migrations use uuid_generate_v4()).
-- pg_trgm:  trigram index for finding/engagement search.
-- citext:   case-insensitive emails.
-- pgcrypto: NOT installed here — rejected per ADR-0001 for field encryption.
--           (application-layer encryption via @aims/encryption instead.)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- ─── Roles ──────────────────────────────────────────────────────────────────
-- \set reads environment variables via the postgres docker-entrypoint mechanism.

\set aims_app_password `echo "$AIMS_APP_PASSWORD"`
\set aims_migration_password `echo "$AIMS_MIGRATION_PASSWORD"`
\set aims_readonly_password `echo "$AIMS_READONLY_PASSWORD"`

-- init.sql runs only when the Postgres data directory is empty (first-time
-- container init via docker-entrypoint). No idempotence needed; keep these
-- CREATE ROLE statements at top level so psql client-side :'var' substitution
-- applies (substitution does NOT happen inside dollar-quoted DO blocks).

-- aims_app: application runtime. Lowest privilege. RLS applies.
CREATE ROLE aims_app WITH LOGIN NOINHERIT PASSWORD :'aims_app_password';

-- aims_migration: schema migrations and seed. BYPASSRLS for setup work.
-- CREATEDB: needed so Prisma's `migrate dev` can create a transient shadow
-- database for drift detection (dev only; prod uses `migrate deploy` which
-- doesn't need this privilege).
CREATE ROLE aims_migration WITH LOGIN NOINHERIT BYPASSRLS CREATEDB PASSWORD :'aims_migration_password';

-- aims_readonly: analytics and support-mode reads. No writes.
CREATE ROLE aims_readonly WITH LOGIN NOINHERIT PASSWORD :'aims_readonly_password';

-- Grants applied per-table by migrations once tables exist (Task 1.3+).
-- For now, grant connection to the dev database to all three roles.
GRANT CONNECT ON DATABASE aims_dev TO aims_app, aims_migration, aims_readonly;

-- aims_migration needs schema-creation privileges to run Prisma migrations:
--   CREATE ON DATABASE → can create new schemas (audit, platform).
--   CREATE + USAGE ON public → can put types/tables in the default schema.
-- Postgres 15+ no longer grants CREATE on public to PUBLIC by default,
-- so this has to be explicit.
GRANT CREATE ON DATABASE aims_dev TO aims_migration;
GRANT CREATE, USAGE ON SCHEMA public TO aims_migration;

-- The superadmin role is the one docker-compose logs in as (POSTGRES_USER).
-- It already has full privileges by default.
