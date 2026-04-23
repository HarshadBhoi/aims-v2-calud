/**
 * Dev CLI: set a user's password.
 *
 * Usage:
 *   pnpm -F @aims/api set-password <tenant-slug> <email> <password>
 *
 * Example:
 *   pnpm -F @aims/api set-password northstar jenna@northstar.test "dev_password_1234!"
 *
 * Caveats:
 *   - Password is a positional arg, which means it shows up in your shell
 *     history and process list. Fine for dev; do NOT use against a real
 *     environment. A future task can add stdin-read or interactive prompts.
 *   - Uses DATABASE_URL from packages/prisma-client/.env (same as other
 *     Prisma CLI commands) via the admin client.
 *
 * Exit codes (set via process.exitCode; Node exits after I/O drains):
 *   0 — success
 *   1 — setPassword returned a typed error (tenant/user/validation)
 *   2 — bad usage or unexpected failure
 */

import { createAdminPrismaClient } from "@aims/prisma-client";

import { SetPasswordError, setPassword } from "../auth/set-password";

async function main(): Promise<void> {
  const [tenantSlug, email, plaintextPassword] = process.argv.slice(2);

  if (!tenantSlug || !email || !plaintextPassword) {
    console.error("Usage: set-password <tenant-slug> <email> <password>");
    process.exitCode = 2;
    return;
  }

  const prisma = createAdminPrismaClient();

  try {
    const result = await setPassword(
      { tenantSlug, email, plaintextPassword },
      { prisma },
    );
    console.warn(`✓ Password set for user ${result.userId} in tenant ${result.tenantId}`);
  } catch (err) {
    if (err instanceof SetPasswordError) {
      console.error(`✗ ${err.code}: ${err.message}`);
      process.exitCode = 1;
    } else {
      console.error("✗ Unexpected error:", err);
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

await main();
