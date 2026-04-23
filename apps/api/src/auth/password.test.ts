import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces an argon2id-encoded hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("produces a different hash for the same password (fresh salt)", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });

  it("rejects an empty password against a real hash", async () => {
    const hash = await hashPassword("something");
    expect(await verifyPassword(hash, "")).toBe(false);
  });

  it("returns false (not throws) on a malformed hash", async () => {
    expect(await verifyPassword("not-a-real-hash", "anything")).toBe(false);
  });

  it("returns false on an empty hash", async () => {
    expect(await verifyPassword("", "password")).toBe(false);
  });
});
