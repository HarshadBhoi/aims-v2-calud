/**
 * Deterministic credentials shared between the global-setup seed and the
 * journey test. Hardcoded so a test failure can be re-driven manually
 * (paste the password into the running web UI to reproduce).
 *
 * The TOTP secret is a fixed RFC 4648 base32 value so the test can
 * generate live codes via `otplib`. Storing it in source is the right
 * trade-off for a dev-laptop e2e harness.
 */

export const E2E_TENANT_SLUG = "northstar-e2e";
export const E2E_TENANT_NAME = "NorthStar Internal Audit (e2e)";
export const E2E_USER_EMAIL = "jenna-e2e@northstar.test";
export const E2E_USER_NAME = "Jenna Patel (e2e)";
export const E2E_USER_ROLE = "Senior";
export const E2E_USER_PASSWORD = "e2e-Test-Password-123!";

/** Base32 RFC 4648 — exactly what otplib's TOTP generator expects. */
export const E2E_TOTP_SECRET = "JBSWY3DPEHPK3PXP";

export const E2E_PACK_CODE = "GAGAS";
export const E2E_PACK_VERSION = "2024.1";

/**
 * The seed pre-attaches GAGAS to one engagement so the journey test can
 * focus on W3+W4 surfaces (finding editor, MFA step-up, report composer,
 * sign ceremony, download) without re-exercising engagement-creation +
 * pack-attach plumbing on every run.
 */
export const E2E_ENGAGEMENT_NAME = "FY26 Q1 Revenue Cycle (e2e)";
export const E2E_ENGAGEMENT_AUDITEE = "BizCo Finance";
