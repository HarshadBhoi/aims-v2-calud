/**
 * Time-based One-Time Password (RFC 6238) via otplib.
 *
 * Used for MFA step-up per ADR-0005. Secret is generated server-side, shown
 * to the user once during enrollment (QR code from totpAuthUri), then stored
 * ALE-encrypted in our MfaSecret table (plaintext never at rest).
 *
 * Config: 6-digit code, 30-second step, ±1 step window (60-second clock
 * skew tolerance — matches Google Authenticator's defaults).
 */

import { authenticator } from "otplib";

// Configure once — otplib's authenticator is a singleton.
authenticator.options = {
  window: 1,
  step: 30,
  digits: 6,
};

/**
 * Generates a fresh base32-encoded TOTP secret (~160 bits).
 * Show the user once during MFA enrollment, then encrypt + store via ALE.
 */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Returns the otpauth:// URI for a given secret, typically rendered as a
 * QR code during enrollment. Example output:
 *   otpauth://totp/AIMS:jenna%40northstar.test?secret=JBSW...&issuer=AIMS
 */
export function totpAuthUri(secret: string, accountName: string, issuer: string): string {
  return authenticator.keyuri(accountName, issuer, secret);
}

/**
 * Verifies a 6-digit TOTP code against a secret. Returns false on any
 * failure (wrong code, malformed secret, etc.) — same rationale as
 * verifyPassword.
 */
export function verifyTotp(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Generates the current TOTP code for a given secret.
 *
 * Test helper — production code should never need this (clients compute it
 * locally from their authenticator app).
 */
export function generateTotpCode(secret: string): string {
  return authenticator.generate(secret);
}
