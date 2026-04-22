/**
 * Stand-alone script that calls audit.verify_chain() and reports.
 *
 * Usage:
 *   pnpm -F @aims/prisma-client verify:audit-chain
 *
 * Exit codes:
 *   0 — chain intact
 *   1 — chain broken, details printed to stderr
 *   2 — script failed (DB connection, unexpected error)
 *
 * Prerequisites: the Prisma-specific .env file in packages/prisma-client/
 * must point at the database you want to verify. By default it targets the
 * dev Postgres via the aims_migration role.
 */

import { createAdminPrismaClient } from "../src/index";

type VerifyResult = {
  ok: boolean;
  broken_at: bigint | null;
  total_rows: bigint;
  reason: string;
};

async function main(): Promise<void> {
  const prisma = createAdminPrismaClient();

  try {
    const rows = await prisma.$queryRawUnsafe<VerifyResult[]>(
      `SELECT ok, broken_at, total_rows, reason FROM audit.verify_chain()`,
    );

    const result = rows[0];
    if (!result) {
      console.error("verify_chain() returned no rows — unexpected.");
      process.exit(2);
    }

    if (result.ok) {
      console.warn(`✓ ${result.reason}`);
      process.exit(0);
    } else {
      console.error(
        `✗ Audit chain broken at chainPosition ${String(result.broken_at)}`,
      );
      console.error(`  Rows examined: ${String(result.total_rows)}`);
      console.error(`  Reason:        ${result.reason}`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Verify script failed:", err);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
