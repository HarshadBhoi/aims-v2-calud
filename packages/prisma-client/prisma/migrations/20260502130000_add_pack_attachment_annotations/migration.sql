-- Slice B W3.6-7 (per VERTICAL-SLICE-B-PLAN §1.2): per-engagement annotations
-- that overlay the pack's default rules. Nullable; existing slice-A rows
-- backfill to NULL automatically (no overlays). The resolver consumes this
-- column when computing strictness.

ALTER TABLE "public"."pack_attachments" ADD COLUMN "annotations" JSONB;
