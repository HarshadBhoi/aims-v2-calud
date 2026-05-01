/**
 * Generate the current TOTP code for a given base32 secret.
 *
 * Uses otplib with default RFC 6238 params (30s window, SHA-1, 6 digits) —
 * matches the api's verifier in `apps/api/src/auth/totp.ts`.
 */

import { authenticator } from "otplib";

export function currentTotp(secret: string): string {
  return authenticator.generate(secret);
}
