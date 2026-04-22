-- CreateTable
CREATE TABLE "public"."tenant_keys" (
    "tenantId" TEXT NOT NULL,
    "kmsKeyArn" TEXT NOT NULL,
    "wrappedDek" BYTEA NOT NULL,
    "dekVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "tenant_keys_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey
ALTER TABLE "public"."tenant_keys" ADD CONSTRAINT "tenant_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
