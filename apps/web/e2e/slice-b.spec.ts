/**
 * Slice B end-to-end journey — multi-pack rendering thesis exercised.
 *
 * Drives the full multi-pack vertical slice through the live web UI:
 *   sign in → seeded engagement (GAGAS attached) → API-attach IIA-GIAS as
 *   secondary methodology → strictness panel reflects union (5 canonical
 *   codes) → author one finding (filling all 5 element slots once) →
 *   submit + MFA-approve → compose two reports against different attestsTo
 *   packs (GAGAS + IIA) → sign each → wait for both PDFs → assert
 *   contentHashes diverge (the architectural-thesis check) → download both
 *   presigned URLs → assert distinct S3 keys.
 *
 * The architectural assertion: the same canonical-keyed finding produces
 * two structurally distinct reports (different findings_summary text,
 * different contentHashes, different PDFs) when attestsTo differs. No
 * `if (pack.code === ...)` branch in the renderer made the divergence
 * happen — pack content + semanticElementMappings did.
 *
 * Stack assumptions match slice-a.spec.ts. global-setup.ts seeds both
 * GAGAS and IIA-GIAS as StandardPacks so the API attach below succeeds.
 */

import { expect, test, type Page } from "@playwright/test";

import {
  E2E_TENANT_SLUG,
  E2E_TOTP_SECRET,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
} from "./fixtures/credentials";
import { currentTotp } from "./helpers/totp";

const FILLED = "x".repeat(60); // satisfies the GAGAS minLength=50 gate
const ATTESTATION = "I approve";

test.describe.configure({ mode: "serial" });

test("slice B — multi-pack engagement → one finding → two reports → distinct PDFs", async ({
  page,
}) => {
  // ─── 1. Sign in ─────────────────────────────────────────────────────────
  await page.goto("/sign-in");
  await page.getByLabel("Tenant").fill(E2E_TENANT_SLUG);
  await page.getByLabel("Email").fill(E2E_USER_EMAIL);
  await page.getByLabel("Password").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");

  // ─── 2. Create a fresh multi-pack engagement ──────────────────────────
  // Slice B can't reuse the slice-A seeded engagement: slice-A leaves a
  // GAGAS-attesting PUBLISHED report there, and the W3.1 unique constraint
  // (engagementId + attestsTo) blocks our second GAGAS-attesting report.
  // Create a new engagement via tRPC and attach BOTH packs to it.
  const leadUserId = await getSeededUserId(page);
  const engagement = await trpcMutate<{ id: string }>(page, "engagement.create", {
    name: "Slice B multi-pack engagement",
    auditeeName: "MultiPackCo",
    fiscalPeriod: "FY27",
    periodStart: new Date("2027-01-01").toISOString(),
    periodEnd: new Date("2027-12-31").toISOString(),
    leadUserId,
  });
  const engagementId = engagement.id;
  await trpcMutate(page, "pack.attach", {
    engagementId,
    packCode: "GAGAS",
    packVersion: "2024.1",
  });
  await trpcMutate(page, "pack.attach", {
    engagementId,
    packCode: "IIA-GIAS",
    packVersion: "2024.1",
  });

  await page.goto(`/dashboard/engagements/${engagementId}`);

  // Strictness panel should show both packs as badges + the union of
  // required canonical codes (5 — IIA adds RECOMMENDATION).
  await expect(page.getByText(/GAGAS:2024\.1.*primary/)).toBeVisible();
  await expect(page.getByText(/IIA-GIAS:2024\.1/).first()).toBeVisible();
  await expect(
    page.getByText(/CAUSE.*CONDITION.*CRITERIA.*EFFECT.*RECOMMENDATION/),
  ).toBeVisible();

  // ─── 3. Author finding — five required canonical codes ────────────────
  await page.getByRole("link", { name: "+ New finding" }).click();
  await page.waitForURL("**/findings/new");
  await page.getByLabel("Title").fill("Multi-pack finding for slice B");
  await page.getByRole("button", { name: "Create finding" }).click();

  await page.waitForURL(/\/findings\/c[a-z0-9]+$/);
  // Editor fields are keyed by canonical codes (resolver translation,
  // W3.2-3). All five required for completion under the GAGAS+IIA union.
  for (const code of ["CRITERIA", "CONDITION", "CAUSE", "EFFECT", "RECOMMENDATION"]) {
    await page.locator(`#element-${code}`).fill(FILLED);
  }
  await page.getByRole("button", { name: "Save now" }).click();
  await expect(page.getByText(/Saved at/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("5 / 5")).toBeVisible();

  // ─── 4. Submit + MFA-approve ───────────────────────────────────────────
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(
    page.locator("p").filter({ hasText: /· IN_REVIEW$/ }),
  ).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Approvals" }).click();
  await page.waitForURL("**/approvals");
  await page.getByRole("link", { name: /Multi-pack finding/ }).click();
  await page.waitForURL(/\/approvals\/c[a-z0-9]+$/);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/Verify your identity/i)).toBeVisible();
  await page.getByLabel(/TOTP code/i).fill(currentTotp(E2E_TOTP_SECRET));
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL("**/approvals", { timeout: 10_000 });

  // ─── 5. First report — attests to GAGAS (default primary) ─────────────
  await page.goto(`/dashboard/engagements/${engagementId}`);
  await page.getByRole("link", { name: "+ New report" }).click();
  await page.waitForURL("**/reports/new");
  await page.getByLabel("Title").fill("FY27 GAGAS report (e2e)");
  // attestsTo dropdown defaults to primary (GAGAS:2024.1). No selection
  // needed — just submit.
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(/\/reports\/c[a-z0-9]+$/);
  const gagasReportId = extractReportId(page.url());

  // GAGAS section text uses GAGAS labels — Cause / Effect, no close-mapping
  // footer, [SIGNIFICANT] classification (not [MEDIUM]).
  await expect(page.locator("pre").filter({ hasText: "Cause:" })).toBeVisible();
  await expect(
    page.locator("pre").filter({ hasText: "[SIGNIFICANT]" }),
  ).toBeVisible();

  for (const key of ["executive_summary", "recommendations", "closing"]) {
    await page.locator(`#section-${key}`).fill(`E2E narrative for ${key}.`);
  }
  await expect(
    page.getByRole("button", { name: "Submit for signoff" }),
  ).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "Submit for signoff" }).click();
  await expect(page.getByText("IN_REVIEW")).toBeVisible({ timeout: 10_000 });

  await signReport(page);

  await expect(
    page.locator("p").filter({ hasText: /· PUBLISHED/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/PDF rendered\./).first()).toBeVisible({
    timeout: 60_000,
  });

  // ─── 6. Second report — attests to IIA via "compose another report" ───
  await page.goto(`/dashboard/engagements/${engagementId}`);
  // The compose-another panel surfaces remaining packs; clicking the IIA
  // link pre-selects it via ?attestsTo=IIA-GIAS:2024.1 query param.
  await page.getByRole("link", { name: "+ IIA-GIAS:2024.1" }).click();
  await page.waitForURL("**/reports/new**");
  await page.getByLabel("Title").fill("FY27 IIA report (e2e)");
  // Verify the dropdown is pre-selected to IIA.
  await expect(page.getByLabel(/Attests to/)).toHaveValue("IIA-GIAS:2024.1");
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(/\/reports\/c[a-z0-9]+$/);
  const iiaReportId = extractReportId(page.url());

  // IIA section text uses IIA labels — Root Cause / Consequence + close-
  // mapping footer on RECOMMENDATION + [MEDIUM] classification.
  await expect(
    page.locator("pre").filter({ hasText: "Root Cause:" }),
  ).toBeVisible();
  await expect(
    page.locator("pre").filter({ hasText: "Consequence:" }),
  ).toBeVisible();
  await expect(
    page.locator("pre").filter({ hasText: "[MEDIUM]" }),
  ).toBeVisible();
  await expect(
    page.locator("pre").filter({
      hasText: /\(rendered under GAGAS:2024\.1 mapping\)/,
    }),
  ).toBeVisible();

  for (const key of ["executive_summary", "recommendations", "closing"]) {
    await page.locator(`#section-${key}`).fill(`E2E narrative for IIA ${key}.`);
  }
  await expect(
    page.getByRole("button", { name: "Submit for signoff" }),
  ).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "Submit for signoff" }).click();
  await expect(page.getByText("IN_REVIEW")).toBeVisible({ timeout: 10_000 });

  await signReport(page);

  await expect(
    page.locator("p").filter({ hasText: /· PUBLISHED/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/PDF rendered\./).first()).toBeVisible({
    timeout: 60_000,
  });

  // ─── 7. Architectural-thesis assertion: contentHashes diverge ─────────
  // Both reports came from the same approved finding (same canonical-keyed
  // element values). Their attestsTo packs differ → their findings_summary
  // section text differs → their contentHashes diverge → distinct PDFs.
  const gagasReport = await trpcQuery<{
    contentHash: string | null;
    pdfS3Key: string | null;
  }>(page, "report.get", { id: gagasReportId });
  const iiaReport = await trpcQuery<{
    contentHash: string | null;
    pdfS3Key: string | null;
  }>(page, "report.get", { id: iiaReportId });

  expect(gagasReport.contentHash).not.toBeNull();
  expect(iiaReport.contentHash).not.toBeNull();
  expect(gagasReport.contentHash).not.toBe(iiaReport.contentHash);
  expect(gagasReport.pdfS3Key).not.toBe(iiaReport.pdfS3Key);

  // ─── 8. Download both PDFs — verify presigned URLs are distinct + real ─
  const gagasUrl = await trpcQuery<{ url: string }>(
    page,
    "report.downloadPdf",
    { id: gagasReportId },
  );
  const iiaUrl = await trpcQuery<{ url: string }>(
    page,
    "report.downloadPdf",
    { id: iiaReportId },
  );
  expect(gagasUrl.url).toContain("aims-dev-reports");
  expect(iiaUrl.url).toContain("aims-dev-reports");
  expect(gagasUrl.url).toMatch(/X-Amz-Signature=/);
  expect(iiaUrl.url).toMatch(/X-Amz-Signature=/);
  // Each presigned URL embeds its own S3 key — they MUST differ since the
  // reports have distinct S3 keys.
  const gagasKey = new URL(gagasUrl.url).pathname;
  const iiaKey = new URL(iiaUrl.url).pathname;
  expect(gagasKey).not.toBe(iiaKey);
});

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Drives the typed-attestation + (possibly) MFA step-up sign flow inside
 * the modal that opens from the Sign & publish action-bar button.
 * Mirrors the slice-a.spec.ts logic.
 */
async function signReport(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign & publish" }).click();
  const signModal = page
    .locator(".rounded-lg")
    .filter({ has: page.getByRole("heading", { name: "Sign & publish" }) });
  await signModal.getByLabel(/Attestation phrase/i).fill(ATTESTATION);
  await signModal.getByRole("button", { name: "Sign & publish" }).click();
  const totpField = signModal.getByLabel(/TOTP code/i);
  if (await totpField.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await totpField.fill(currentTotp(E2E_TOTP_SECRET));
    await signModal.getByRole("button", { name: /Verify & sign/ }).click();
  }
}

function extractReportId(url: string): string {
  const match = /\/reports\/(c[a-z0-9]+)/.exec(url);
  if (!match?.[1]) {
    throw new Error(`could not extract report id from URL: ${url}`);
  }
  return match[1];
}

async function getSeededUserId(page: Page): Promise<string> {
  // auth.me takes no input; using engagement.list (slice-A seeded engagement
  // exists, with our authenticated user as lead) avoids the "no-input
  // tRPC procedure" wire-format edge case.
  const apiBase = process.env["AIMS_E2E_API_URL"] ?? "http://localhost:3001";
  const response = await page.request.get(
    `${apiBase}/trpc/engagement.list?batch=1&input=${encodeURIComponent(
      JSON.stringify({ "0": { json: { limit: 1 } } }),
    )}`,
  );
  if (!response.ok()) {
    throw new Error(`engagement.list failed: ${response.status().toString()}`);
  }
  const body = (await response.json()) as {
    result: { data: { json: { items: { leadUserId: string }[] } } };
  }[];
  const leadUserId = body[0]?.result.data.json.items[0]?.leadUserId;
  if (!leadUserId) throw new Error("could not derive seeded user id");
  return leadUserId;
}

/**
 * tRPC v11 batch-mutation helper. Posts to /trpc/<procedure>?batch=1 with
 * the wire format Playwright's request fixture can drive against the
 * authenticated session cookie. Returns the json result for the first
 * (and only) op in the batch.
 */
async function trpcMutate<T = unknown>(
  page: Page,
  procedure: string,
  input: Record<string, unknown>,
): Promise<T> {
  const apiBase = process.env["AIMS_E2E_API_URL"] ?? "http://localhost:3001";
  const response = await page.request.post(
    `${apiBase}/trpc/${procedure}?batch=1`,
    {
      data: { "0": { json: input } },
    },
  );
  if (!response.ok()) {
    throw new Error(
      `trpc ${procedure} failed: ${response.status().toString()} ${response.statusText()} — ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { result: { data: { json: T } } }[];
  if (!body[0]) throw new Error(`trpc ${procedure} returned empty body`);
  return body[0].result.data.json;
}

async function trpcQuery<T>(
  page: Page,
  procedure: string,
  input: Record<string, unknown>,
): Promise<T> {
  const apiBase = process.env["AIMS_E2E_API_URL"] ?? "http://localhost:3001";
  const response = await page.request.get(
    `${apiBase}/trpc/${procedure}?batch=1&input=${encodeURIComponent(
      JSON.stringify({ "0": { json: input } }),
    )}`,
  );
  if (!response.ok()) {
    throw new Error(
      `trpc ${procedure} query failed: ${response.status().toString()} ${response.statusText()} — ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { result: { data: { json: T } } }[];
  if (!body[0]) throw new Error(`trpc ${procedure} returned empty body`);
  return body[0].result.data.json;
}
