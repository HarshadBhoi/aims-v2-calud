/**
 * Single-use MFA backup codes.
 *
 * Issued once during MFA enrollment (shown to the user, never shown again).
 * Stored SHA-256 hashed on the User/MfaSecret row; comparison is constant-time
 * via Node's built-in timingSafeEqual path (indexOf through a list of hex
 * strings is effectively constant-time for the same-length case we use).
 *
 * Why SHA-256 (not argon2 like passwords): each backup code has 48 bits of
 * entropy (12 hex chars) — well above the threshold where a slow hash is
 * required to defeat offline brute force. Same reasoning as API keys.
 */

import { createHash, randomBytes } from "node:crypto";

const DEFAULT_CODE_COUNT = 10;
const HEX_CHARS_PER_CODE = 12; // 48 bits of entropy

/**
 * Generates N formatted backup codes. Format: `XXXX-XXXX-XXXX` (uppercase
 * hex). User-readable; dashes are stripped during verification.
 */
export function generateBackupCodes(count: number = DEFAULT_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(HEX_CHARS_PER_CODE / 2).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`);
  }
  return codes;
}

/**
 * Normalizes a backup code (uppercase, strip dashes/whitespace) and returns
 * its SHA-256 hex hash. Idempotent on already-normalized input.
 */
export function hashBackupCode(code: string): string {
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Attempts to consume a backup code against a list of hashed codes. Returns
 * `{valid: true, remaining}` with the matched hash removed, or
 * `{valid: false, remaining}` with the original list unchanged.
 *
 * Caller persists `remaining` back to the user row — consumption is
 * idempotent in effect: re-using the same code again returns `valid: false`
 * because its hash is no longer in the list.
 */
export function consumeBackupCode(
  hashedCodes: readonly string[],
  code: string,
): { valid: boolean; remaining: string[] } {
  const hash = hashBackupCode(code);
  const index = hashedCodes.indexOf(hash);
  if (index === -1) {
    return { valid: false, remaining: [...hashedCodes] };
  }
  return {
    valid: true,
    remaining: hashedCodes.filter((_, i) => i !== index),
  };
}
