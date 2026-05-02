-- Slice B (per VERTICAL-SLICE-B-PLAN §3.1, W3 day 1): one report per
-- (engagement, attestsTo pack version). Two GAGAS-2024.1 reports on the
-- same engagement is rejected; one GAGAS + one IIA is fine. Multi-report-
-- per-engagement is now formally supported AND duplicate-protected.
--
-- Pre-flight check: dev DB confirmed zero duplicates on this composite key
-- before adding the constraint (psql group-by check, 0 rows). Tests
-- always run against fresh containers so they generate no duplicates either.

CREATE UNIQUE INDEX "reports_engagementId_attestsToPackCode_attestsToPackVersion_key"
  ON "public"."reports"("engagementId", "attestsToPackCode", "attestsToPackVersion");
