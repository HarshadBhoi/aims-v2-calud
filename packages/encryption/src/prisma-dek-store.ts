/**
 * Prisma-backed DekStore implementation.
 *
 * Reads and writes `TenantKey` rows via the standard @prisma/client.
 * The TenantKey model is defined in packages/prisma-client/prisma/schema.prisma
 * and lives in the public schema with tenantId as primary key.
 */

import type { DekStore, StoredDek } from "./types";

/**
 * Structural type matching the subset of @prisma/client that we need.
 * Using a structural type (instead of importing PrismaClient) keeps this
 * package decoupled from the specific Prisma generated type layout and
 * avoids a hard dep on @aims/prisma-client.
 */
export type PrismaLike = {
  tenantKey: {
    findUnique(args: { where: { tenantId: string } }): Promise<{
      tenantId: string;
      wrappedDek: Uint8Array | Buffer;
      kmsKeyArn: string;
      dekVersion: number;
    } | null>;

    upsert(args: {
      where: { tenantId: string };
      create: {
        tenantId: string;
        wrappedDek: Uint8Array | Buffer;
        kmsKeyArn: string;
        dekVersion: number;
      };
      update: {
        wrappedDek: Uint8Array | Buffer;
        kmsKeyArn: string;
        dekVersion: number;
        rotatedAt: Date;
      };
    }): Promise<unknown>;
  };
};

export function createPrismaDekStore(prisma: PrismaLike): DekStore {
  return {
    async get(tenantId: string): Promise<StoredDek | null> {
      const row = await prisma.tenantKey.findUnique({ where: { tenantId } });
      if (!row) return null;
      return {
        wrapped: Buffer.from(row.wrappedDek),
        kmsKeyArn: row.kmsKeyArn,
        dekVersion: row.dekVersion,
      };
    },

    async put(
      tenantId: string,
      wrapped: Buffer,
      kmsKeyArn: string,
      dekVersion = 1,
    ): Promise<void> {
      await prisma.tenantKey.upsert({
        where: { tenantId },
        create: { tenantId, wrappedDek: wrapped, kmsKeyArn, dekVersion },
        update: {
          wrappedDek: wrapped,
          kmsKeyArn,
          dekVersion,
          rotatedAt: new Date(),
        },
      });
    },
  };
}
