-- AlterTable: add the column with default=false. Backfill below.
ALTER TABLE "public"."pack_attachments" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: slice-A invariant was one pack per engagement, so the lone
-- attachment is the primary by definition. UPDATE every row whose engagement
-- has exactly one attachment to isPrimary=true. Engagements with no
-- attachments produce no rows; the slice-A seed has every engagement attached
-- to exactly one pack, so 100% of existing rows flip to true.
UPDATE "public"."pack_attachments" pa
SET "isPrimary" = true
WHERE pa."engagementId" IN (
  SELECT "engagementId"
  FROM "public"."pack_attachments"
  GROUP BY "engagementId"
  HAVING COUNT(*) = 1
);

-- Verification: every engagement with attachments now has at least one
-- primary. Fail the migration if not (catches edge cases where the seed
-- diverged from the slice-A invariant).
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM (
    SELECT "engagementId"
    FROM "public"."pack_attachments"
    GROUP BY "engagementId"
    HAVING COUNT(*) FILTER (WHERE "isPrimary" = true) = 0
  ) sub;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Migration backfill failed: % engagement(s) have attachments but no primary. Investigate slice-A seed before re-running.', orphan_count;
  END IF;
END $$;

-- CreateIndex (Prisma-generated): non-unique helper index for resolver lookups.
CREATE INDEX "pack_attachments_engagementId_isPrimary_idx" ON "public"."pack_attachments"("engagementId", "isPrimary");

-- Hand-added: partial UNIQUE index enforcing "exactly one primary per
-- engagement" at the DB layer. The Prisma extension also enforces this in
-- the resolver-write path, but the constraint is data-integrity-critical
-- (canonical-code write-path mapping per ADR-0010 picks the primary), so
-- it earns DB-layer enforcement.
CREATE UNIQUE INDEX "pack_attachments_engagementId_primary_unique"
  ON "public"."pack_attachments"("engagementId")
  WHERE "isPrimary" = true;
