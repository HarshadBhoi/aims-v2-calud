/**
 * Sets (or changes) a user's password.
 *
 * Dev tool wiring: the seed script (Task 1.8) creates users with
 * passwordHash = NULL. This function fills that in using our argon2id
 * hasher, producing a login-capable user.
 *
 * Operates via the AdminPrismaClient — we're administering the password,
 * no per-request tenant context is active. Tenant is resolved from the
 * supplied slug.
 */

import { type AdminPrismaClient } from "@aims/prisma-client";

import { hashPassword } from "./password";

export type SetPasswordInput = {
  readonly tenantSlug: string;
  readonly email: string;
  readonly plaintextPassword: string;
};

export type SetPasswordDeps = {
  readonly prisma: AdminPrismaClient;
};

export class SetPasswordError extends Error {
  readonly code:
    | "TENANT_NOT_FOUND"
    | "USER_NOT_FOUND"
    | "PASSWORD_TOO_SHORT"
    | "PASSWORD_TOO_LONG";

  constructor(code: SetPasswordError["code"], message?: string) {
    super(message ?? code);
    this.name = "SetPasswordError";
    this.code = code;
  }
}

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;

export async function setPassword(
  input: SetPasswordInput,
  deps: SetPasswordDeps,
): Promise<{ userId: string; tenantId: string }> {
  if (input.plaintextPassword.length < MIN_PASSWORD_LENGTH) {
    throw new SetPasswordError(
      "PASSWORD_TOO_SHORT",
      `Password must be at least ${MIN_PASSWORD_LENGTH.toString()} characters.`,
    );
  }
  if (input.plaintextPassword.length > MAX_PASSWORD_LENGTH) {
    throw new SetPasswordError(
      "PASSWORD_TOO_LONG",
      `Password must be no more than ${MAX_PASSWORD_LENGTH.toString()} characters.`,
    );
  }

  const tenant = await deps.prisma.tenant.findUnique({
    where: { slug: input.tenantSlug },
  });
  if (!tenant) {
    throw new SetPasswordError(
      "TENANT_NOT_FOUND",
      `No tenant with slug "${input.tenantSlug}".`,
    );
  }

  const user = await deps.prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
  });
  if (!user) {
    throw new SetPasswordError(
      "USER_NOT_FOUND",
      `No user with email "${input.email}" in tenant "${input.tenantSlug}".`,
    );
  }

  const passwordHash = await hashPassword(input.plaintextPassword);

  await deps.prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
  });

  return { userId: user.id, tenantId: tenant.id };
}
