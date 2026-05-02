-- CreateTable
CREATE TABLE "public"."engagement_strictness" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "retentionYears" INTEGER NOT NULL,
    "coolingOffMonths" INTEGER NOT NULL,
    "cpeHours" INTEGER,
    "documentationRequirements" JSONB NOT NULL,
    "requiredCanonicalCodes" TEXT[],
    "drivenBy" JSONB NOT NULL,
    "_version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "engagement_strictness_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "engagement_strictness_engagementId_key" ON "public"."engagement_strictness"("engagementId");

-- CreateIndex
CREATE INDEX "engagement_strictness_tenantId_idx" ON "public"."engagement_strictness"("tenantId");

-- AddForeignKey
ALTER TABLE "public"."engagement_strictness" ADD CONSTRAINT "engagement_strictness_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "public"."engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── RLS (defence-in-depth per ADR-0002 + ADR-0011) ────────────────────────
-- Enable + force RLS, add tenant_isolation policy mirroring the pattern
-- established by 20260423000000_rls_policies/migration.sql.

ALTER TABLE "public"."engagement_strictness" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."engagement_strictness" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "public"."engagement_strictness"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

-- ─── Grants for aims_app / aims_readonly (guarded for test containers) ────
-- The default-privileges grant added in 20260423000000 covers the new table
-- automatically when the migration runs as aims_migration. This block is
-- belt-and-suspenders for any environment where default privileges weren't
-- in effect at creation time.

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'aims_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."engagement_strictness" TO aims_app';
  END IF;

  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'aims_readonly') THEN
    EXECUTE 'GRANT SELECT ON "public"."engagement_strictness" TO aims_readonly';
  END IF;
END $$;
