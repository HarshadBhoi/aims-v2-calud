import { describe, expect, it } from "vitest";

import { generateTotpCode, generateTotpSecret, totpAuthUri, verifyTotp } from "./totp";

describe("TOTP", () => {
  it("generates a base32 secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it("generates unique secrets across calls", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
  });

  it("produces an otpauth:// URI with issuer and account", () => {
    const uri = totpAuthUri("JBSWY3DPEHPK3PXP", "jenna@northstar.test", "AIMS");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=AIMS");
    // URL-encoded account name
    expect(uri).toMatch(/jenna%40northstar\.test/);
  });

  it("verifies a freshly generated code (round-trip)", () => {
    const secret = generateTotpSecret();
    const code = generateTotpCode(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it("rejects a wrong 6-digit code", () => {
    const secret = generateTotpSecret();
    const code = generateTotpCode(secret);
    // Bump any digit
    const wrong = code.startsWith("0") ? `1${code.slice(1)}` : `0${code.slice(1)}`;
    expect(verifyTotp(secret, wrong)).toBe(false);
  });

  it("rejects a non-6-digit token", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "12345")).toBe(false);
    expect(verifyTotp(secret, "abcdef")).toBe(false);
  });

  it("rejects a code from a different secret", () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const codeA = generateTotpCode(secretA);
    expect(verifyTotp(secretB, codeA)).toBe(false);
  });

  it("returns false (not throws) on a malformed secret", () => {
    expect(verifyTotp("!!!not-base32!!!", "123456")).toBe(false);
  });
});
