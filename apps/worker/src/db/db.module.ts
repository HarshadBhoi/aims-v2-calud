/**
 * DB module — provides a long-lived AdminPrismaClient for worker-tier code.
 *
 * Worker uses the admin client (no tenant extension) because outbox / audit
 * log work is cross-tenant by design. Per ADR-0002, RLS still applies via
 * the role grants in `database/policies/roles.sql`; the admin role is
 * granted RLS bypass.
 */

import { createAdminPrismaClient, type AdminPrismaClient } from "@aims/prisma-client";
import { Module, type OnModuleDestroy } from "@nestjs/common";

import { loadConfig } from "../config";

export const ADMIN_PRISMA = "ADMIN_PRISMA";

class PrismaLifecycle implements OnModuleDestroy {
  constructor(private readonly client: AdminPrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

@Module({
  providers: [
    {
      provide: ADMIN_PRISMA,
      useFactory: () => {
        // Load config inline (matches AwsModule's WORKER_CONFIG factory) —
        // a separate ConfigModule would be cleaner long-term but adds
        // overhead the slice doesn't need yet.
        const config = loadConfig();
        return createAdminPrismaClient(
          config.databaseAdminUrl
            ? { datasources: { db: { url: config.databaseAdminUrl } } }
            : undefined,
        );
      },
    },
    {
      provide: PrismaLifecycle,
      inject: [ADMIN_PRISMA],
      useFactory: (client: AdminPrismaClient) => new PrismaLifecycle(client),
    },
  ],
  exports: [ADMIN_PRISMA],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker
export class DbModule {}
