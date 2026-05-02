-- Slice B (per VERTICAL-SLICE-B-PLAN §3.1 + ADR-0010): every Report attests
-- to a specific pack. Slice A reports backfill from the engagement's primary
-- pack attachment. Multi-report-per-engagement (W2 day 6-7) relies on this
-- column existing first.

-- Step 1: add the columns nullable so existing rows can be backfilled before
-- we tighten to NOT NULL + FK.
ALTER TABLE "public"."reports"
  ADD COLUMN "attestsToPackCode" TEXT,
  ADD COLUMN "attestsToPackVersion" TEXT;

-- Step 2: backfill — every existing report inherits its engagement's primary
-- pack attachment. Slice A's invariant (one pack per engagement) means
-- exactly one match per report; the partial unique index added in
-- 20260502021037 guarantees the primary is unambiguous.
UPDATE "public"."reports" r
SET
  "attestsToPackCode" = pa."packCode",
  "attestsToPackVersion" = pa."packVersion"
FROM "public"."pack_attachments" pa
WHERE pa."engagementId" = r."engagementId"
  AND pa."isPrimary" = true;

-- Step 3: verify backfill — fail loudly if any reports remain with no
-- attestsTo pack (would happen if an engagement somehow had no primary).
DO $$
DECLARE
  unbound_count INT;
BEGIN
  SELECT COUNT(*) INTO unbound_count
  FROM "public"."reports"
  WHERE "attestsToPackCode" IS NULL OR "attestsToPackVersion" IS NULL;
  IF unbound_count > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % report(s) have no primary pack on their engagement.', unbound_count;
  END IF;
END $$;

-- Step 4: tighten to NOT NULL + add the FK.
ALTER TABLE "public"."reports"
  ALTER COLUMN "attestsToPackCode" SET NOT NULL,
  ALTER COLUMN "attestsToPackVersion" SET NOT NULL;

ALTER TABLE "public"."reports"
  ADD CONSTRAINT "reports_attestsToPackCode_attestsToPackVersion_fkey"
  FOREIGN KEY ("attestsToPackCode", "attestsToPackVersion")
  REFERENCES "platform"."standard_packs"("code", "version")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
