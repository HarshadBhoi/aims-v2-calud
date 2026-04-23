import { describe, expect, it } from "vitest";

import { consumeBackupCode, generateBackupCodes, hashBackupCode } from "./backup-codes";

describe("backup codes", () => {
  it("generates the requested number of codes", () => {
    expect(generateBackupCodes(10)).toHaveLength(10);
    expect(generateBackupCodes(3)).toHaveLength(3);
  });

  it("defaults to 10 codes", () => {
    expect(generateBackupCodes()).toHaveLength(10);
  });

  it("formats codes as XXXX-XXXX-XXXX (uppercase hex)", () => {
    for (const code of generateBackupCodes(5)) {
      expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    }
  });

  it("generates unique codes (probabilistically)", () => {
    const codes = generateBackupCodes(50);
    expect(new Set(codes).size).toBe(50);
  });

  it("hashes deterministically", () => {
    const a = hashBackupCode("1234-ABCD-5678");
    const b = hashBackupCode("1234-ABCD-5678");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
  });

  it("normalizes case and dashes before hashing", () => {
    const a = hashBackupCode("1234-abcd-5678");
    const b = hashBackupCode("1234ABCD5678");
    const c = hashBackupCode("  1234-ABCD-5678  ");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  describe("consume", () => {
    it("matches a valid code and removes its hash", () => {
      const codes = generateBackupCodes(3);
      const [firstCode] = codes;
      if (!firstCode) throw new Error("no code generated");
      const hashes = codes.map(hashBackupCode);

      const result = consumeBackupCode(hashes, firstCode);
      expect(result.valid).toBe(true);
      expect(result.remaining).toHaveLength(2);
      expect(result.remaining).not.toContain(hashBackupCode(firstCode));
    });

    it("rejects an invalid code and leaves the list unchanged", () => {
      const codes = generateBackupCodes(3);
      const hashes = codes.map(hashBackupCode);

      const result = consumeBackupCode(hashes, "0000-0000-0000");
      expect(result.valid).toBe(false);
      expect(result.remaining).toEqual(hashes);
    });

    it("accepts case- and dash-variant submissions for a valid code", () => {
      const [code] = generateBackupCodes(1);
      if (!code) throw new Error("no code generated");
      const hashes = [hashBackupCode(code)];
      const submission = code.replace(/-/g, "").toLowerCase();

      const result = consumeBackupCode(hashes, submission);
      expect(result.valid).toBe(true);
      expect(result.remaining).toHaveLength(0);
    });

    it("re-using a consumed code fails", () => {
      const [code] = generateBackupCodes(1);
      if (!code) throw new Error("no code generated");
      const hashes = [hashBackupCode(code)];

      const first = consumeBackupCode(hashes, code);
      expect(first.valid).toBe(true);

      const second = consumeBackupCode(first.remaining, code);
      expect(second.valid).toBe(false);
    });
  });
});
