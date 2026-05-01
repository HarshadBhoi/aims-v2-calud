/**
 * Slice A end-to-end journey.
 *
 * Drives the full vertical slice through the live web UI:
 *   sign in → engagement detail (seeded) → finding (draft, fill 4 elements,
 *   submit) → approve via the Approvals queue with MFA step-up →
 *   create report → fill editorial sections → submit for signoff → sign
 *   with typed attestation + MFA step-up → wait for the worker to render
 *   the PDF → click Download PDF → verify the presigned URL is real.
 *
 * Stack assumptions (see playwright.config.ts):
 *   - `pnpm infra:up` running (Postgres + LocalStack + Redis)
 *   - `pnpm --filter @aims/api dev`     (port 3001)
 *   - `pnpm --filter @aims/web dev`     (port 3000)
 *   - `pnpm --filter @aims/worker dev`  (SQS poller + outbox publisher)
 *   - migrations applied; global-setup seeds the rest
 */

import { expect, test, type Page } from "@playwright/test";

import {
  E2E_ENGAGEMENT_NAME,
  E2E_TENANT_SLUG,
  E2E_TOTP_SECRET,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
} from "./fixtures/credentials";
import { currentTotp } from "./helpers/totp";

const FILLED = "x".repeat(60); // satisfies the GAGAS minLength=50 gate
const ATTESTATION = "I approve";

test.describe.configure({ mode: "serial" });

test("slice A — engagement → finding → report → sign → download", async ({
  page,
  context,
}) => {
  // ─── 1. Sign in ─────────────────────────────────────────────────────────
  await page.goto("/sign-in");
  await page.getByLabel("Tenant").fill(E2E_TENANT_SLUG);
  await page.getByLabel("Email").fill(E2E_USER_EMAIL);
  await page.getByLabel("Password").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("**/dashboard");
  await expect(page.getByText(/Welcome back/i)).toBeVisible();

  // ─── 2. Open the seeded engagement ─────────────────────────────────────
  await expect(page.getByText(E2E_ENGAGEMENT_NAME)).toBeVisible();
  // Click the engagement card. It's rendered as plain list text on the home
  // page; we navigate via the API by listing engagements and following the
  // first one's link from its detail. Simpler: click the engagement name.
  await page.goto("/dashboard/engagements/new").catch(() => {
    /* fallthrough — using new page only if needed */
  });
  // Actually, the home page lists engagements but doesn't link them. Go via
  // a fresh "+ New engagement" → cancel pattern is brittle; instead drive
  // through the engagement-list query: the seeded engagement is the only
  // one, so we extract its id from the API and navigate.
  const engagementId = await getSeededEngagementId(page);
  await page.goto(`/dashboard/engagements/${engagementId}`);

  await expect(
    page.getByRole("heading", { name: E2E_ENGAGEMENT_NAME }),
  ).toBeVisible();

  // ─── 3. Create finding ──────────────────────────────────────────────────
  await page.getByRole("link", { name: "+ New finding" }).click();
  await page.waitForURL("**/findings/new");
  await page.getByLabel("Title").fill("Procurement records gap");
  await page.getByRole("button", { name: "Create finding" }).click();

  // Lands in editor at /findings/[findingId]
  await page.waitForURL(/\/findings\/c[a-z0-9]+$/);
  await expect(
    page.getByRole("heading", { name: "Procurement records gap" }),
  ).toBeVisible();

  // ─── 4. Fill the four elements ──────────────────────────────────────────
  for (const code of ["CRITERIA", "CONDITION", "CAUSE", "EFFECT"]) {
    await page.locator(`#element-${code}`).fill(FILLED);
  }

  // Trigger an immediate save (don't wait the 10s autosave window).
  await page.getByRole("button", { name: "Save now" }).click();
  await expect(page.getByText(/Saved at/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("4 / 4")).toBeVisible();

  // ─── 5. Submit for review ──────────────────────────────────────────────
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("IN_REVIEW")).toBeVisible({ timeout: 10_000 });

  // ─── 6. Approve via the queue with MFA step-up ─────────────────────────
  await page.getByRole("link", { name: "Approvals" }).click();
  await page.waitForURL("**/approvals");
  await expect(page.getByText("Procurement records gap")).toBeVisible();
  await page.getByRole("link", { name: /Procurement records gap/ }).click();

  await page.waitForURL(/\/approvals\/c[a-z0-9]+$/);
  await page.getByRole("button", { name: "Approve" }).click();

  // First click triggers PRECONDITION_FAILED → step-up modal opens.
  await expect(page.getByText(/Verify your identity/i)).toBeVisible();
  await page.getByLabel(/TOTP code/i).fill(currentTotp(E2E_TOTP_SECRET));
  await page.getByRole("button", { name: "Verify" }).click();

  // After verify the user is back on the queue (we redirect to /approvals on
  // decide success). Click the decision button again — it now succeeds.
  await page.waitForURL("**/approvals", { timeout: 10_000 });
  // Queue is now empty.
  await expect(
    page.getByText(/No findings pending review/i),
  ).toBeVisible();

  // Confirm the finding moved to APPROVED on the engagement detail.
  await page.goto(`/dashboard/engagements/${engagementId}`);
  await expect(
    page.locator("li").filter({ hasText: "Procurement records gap" }),
  ).toContainText("APPROVED");

  // ─── 7. Create report + fill editorial ─────────────────────────────────
  await page.getByRole("link", { name: "+ New report" }).click();
  await page.waitForURL("**/reports/new");
  await page.getByLabel("Title").fill("FY26 Audit Report (e2e)");
  await page.getByRole("button", { name: "Generate report" }).click();

  await page.waitForURL(/\/reports\/c[a-z0-9]+$/);

  // Confirm data sections auto-populated from the approved finding.
  await expect(
    page.locator("pre").filter({ hasText: "Procurement records gap" }),
  ).toBeVisible();

  // Fill all three editorial sections.
  for (const key of ["executive_summary", "recommendations", "closing"]) {
    await page.locator(`#section-${key}`).fill(`E2E narrative for ${key}.`);
  }
  await page.getByRole("button", { name: "Save now" }).click();
  await expect(page.getByText(/Saved at/)).toBeVisible({ timeout: 15_000 });

  // ─── 8. Submit for signoff ──────────────────────────────────────────────
  await page.getByRole("button", { name: "Submit for signoff" }).click();
  await expect(page.getByText("IN_REVIEW")).toBeVisible({ timeout: 10_000 });

  // ─── 9. Sign with typed attestation + MFA step-up ──────────────────────
  await page.getByRole("button", { name: "Sign & publish" }).click();
  await page.getByLabel(/Attestation phrase/i).fill(ATTESTATION);
  await page.getByRole("button", { name: /Sign & publish|Verify & sign/ }).click();

  // First click → step-up needed → TOTP field appears.
  await page.getByLabel(/TOTP code/i).fill(currentTotp(E2E_TOTP_SECRET));
  await page.getByRole("button", { name: /Verify & sign/ }).click();

  // After replay, status becomes PUBLISHED.
  await expect(page.getByText("PUBLISHED")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Report published/i)).toBeVisible();

  // ─── 10. Wait for worker to render the PDF ─────────────────────────────
  // The worker polls SQS at ~10s intervals (or whatever the consumer's
  // long-poll wait is). Poll the page; the alert text flips from "PDF render
  // queued" → "PDF rendered" once `pdfS3Key` is set.
  await expect(page.getByText(/PDF rendered/i)).toBeVisible({
    timeout: 60_000,
  });

  // ─── 11. Download PDF (presigned URL) ──────────────────────────────────
  // Clicking opens the presigned URL in a new tab. Capture the popup and
  // assert the URL targets the reports bucket and carries an AWS signature.
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const popup = await popupPromise;
  const url = popup.url();
  expect(url).toContain("aims-dev-reports");
  expect(url).toMatch(/X-Amz-Signature=/);
  await popup.close();
});

/**
 * The home page doesn't link engagements (slice A). Drive through tRPC
 * directly, reusing the page's session cookie via Playwright's request
 * fixture. The seeded engagement is the only one in the tenant so taking
 * the first item is safe.
 */
async function getSeededEngagementId(page: Page): Promise<string> {
  const apiBase = process.env["AIMS_E2E_API_URL"] ?? "http://localhost:3001";
  const response = await page.request.get(
    `${apiBase}/trpc/engagement.list?batch=1&input=${encodeURIComponent(
      JSON.stringify({ "0": { json: { limit: 5 } } }),
    )}`,
  );
  if (!response.ok()) {
    throw new Error(
      `engagement.list failed: ${response.status().toString()} ${response.statusText()}`,
    );
  }
  const body = (await response.json()) as {
    result: { data: { json: { items: { id: string }[] } } };
  }[];
  const id = body[0]?.result.data.json.items[0]?.id;
  if (!id) throw new Error("no seeded engagement found");
  return id;
}
