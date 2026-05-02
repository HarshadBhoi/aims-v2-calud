/**
 * Session revocation end-to-end (slice plan W5-6 / ADR-0005).
 *
 * Proves the load-bearing claim: a revoked session rejects further
 * requests **even when the JWT is still unexpired**. The api checks the
 * session row in `context.ts:resolveSession` on every request, so a
 * `revokedAt` stamp from any source — admin kill, another tab's
 * sign-out, the Redis blocklist propagating to a sibling instance —
 * shuts the holder out within the next request.
 *
 * Test path:
 *   1. Sign in via UI; cookie carries a valid 15-min JWT
 *   2. Verify the dashboard renders ⇒ auth.me succeeded
 *   3. Reach into the dev DB and stamp `Session.revokedAt = now()`
 *      (simulates admin kill OR another-tab sign-out, without going
 *      through the UI)
 *   4. Reload — auth.me re-runs against the (still-valid) JWT and is
 *      rejected because the session row is revoked
 *   5. Assert the layout redirected the user to `/sign-in`
 */

import { createAdminPrismaClient } from "@aims/prisma-client";
import { expect, test } from "@playwright/test";

import {
  E2E_TENANT_SLUG,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
} from "./fixtures/credentials";

test("session revocation kicks the user back to sign-in", async ({ page }) => {
  // ─── 1. Sign in ─────────────────────────────────────────────────────────
  await page.goto("/sign-in");
  await page.getByLabel("Tenant").fill(E2E_TENANT_SLUG);
  await page.getByLabel("Email").fill(E2E_USER_EMAIL);
  await page.getByLabel("Password").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");

  // ─── 2. Sanity — dashboard rendered (auth.me succeeded) ────────────────
  await expect(page.getByText(/Welcome back/i)).toBeVisible();

  // ─── 3. Revoke the active session in the DB ────────────────────────────
  // Migration role required — `aims_app` can't bypass RLS for cross-tenant
  // session lookup. Mirrors global-setup.ts.
  const adminUrl = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  const prisma = createAdminPrismaClient({ datasourceUrl: adminUrl });
  try {
    const user = await prisma.user.findFirstOrThrow({
      where: { email: E2E_USER_EMAIL },
      include: {
        tenant: { select: { slug: true } },
      },
    });
    if (user.tenant.slug !== E2E_TENANT_SLUG) {
      throw new Error(
        `unexpected tenant for ${E2E_USER_EMAIL}: ${user.tenant.slug}`,
      );
    }
    const updated = await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    expect(updated.count).toBeGreaterThan(0);
  } finally {
    await prisma.$disconnect();
  }

  // ─── 4. Reload — JWT is still unexpired but the session is revoked ────
  // The dashboard layout's `meQuery` re-runs on mount; on UNAUTHORIZED
  // it pushes the user to `/sign-in` via the `useEffect` in layout.tsx.
  await page.reload();

  // ─── 5. Assert redirect to sign-in ─────────────────────────────────────
  await page.waitForURL("**/sign-in", { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: /Sign in to AIMS/i }),
  ).toBeVisible();
});
