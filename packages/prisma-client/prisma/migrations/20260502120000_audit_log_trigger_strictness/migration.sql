-- Slice B (per VERTICAL-SLICE-B-PLAN §3.3, ADR-0011 phase 5): the resolver
-- writes to engagement_strictness on every pack.attach / detach /
-- swapPrimary. Each write should land in the hash-chained audit log so the
-- "why is this engagement's retention 7 years?" query has a queryable
-- answer beyond the current row.
--
-- The trigger function in 20260424000000 already handles the row-shape
-- generically (any tracked table with `id` + `tenantId` columns); we just
-- need to attach it to engagement_strictness too.

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "public"."engagement_strictness"
  FOR EACH ROW EXECUTE FUNCTION audit.trigger_audit_log();
