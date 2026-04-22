/**
 * Unit tests for the pure AES-GCM primitives. Fast (no containers, no I/O).
 */

import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  DecryptionError,
  EnvelopeError,
  KEY_LENGTH,
  MIN_ENVELOPE_LENGTH,
  NONCE_LENGTH,
  TAG_LENGTH,
  VERSION_BYTE,
  decryptRaw,
  encryptRaw,
} from "./crypto";

function freshKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

describe("crypto primitives", () => {
  it("round-trips plaintext of various sizes", () => {
    const key = freshKey();
    for (const size of [0, 1, 15, 16, 17, 100, 1000, 10_000]) {
      const plaintext = randomBytes(size);
      const envelope = encryptRaw(key, plaintext);
      const roundtrip = decryptRaw(key, envelope);
      expect(roundtrip.equals(plaintext)).toBe(true);
    }
  });

  it("produces a self-describing envelope with version byte + nonce + tag", () => {
    const key = freshKey();
    const plaintext = Buffer.from("hello");
    const envelope = encryptRaw(key, plaintext);
    expect(envelope[0]).toBe(VERSION_BYTE);
    expect(envelope.length).toBe(1 + NONCE_LENGTH + plaintext.length + TAG_LENGTH);
  });

  it("uses a fresh nonce on each call (no reuse)", () => {
    const key = freshKey();
    const plaintext = Buffer.from("same plaintext");
    const a = encryptRaw(key, plaintext);
    const b = encryptRaw(key, plaintext);
    const nonceA = a.subarray(1, 1 + NONCE_LENGTH);
    const nonceB = b.subarray(1, 1 + NONCE_LENGTH);
    expect(nonceA.equals(nonceB)).toBe(false);
    // Ciphertexts should also differ (same plaintext, different nonce).
    expect(a.equals(b)).toBe(false);
  });

  it("rejects wrong-length DEKs", () => {
    expect(() => encryptRaw(Buffer.alloc(16), Buffer.from("x"))).toThrow(/32 bytes/);
    expect(() => decryptRaw(Buffer.alloc(16), Buffer.alloc(MIN_ENVELOPE_LENGTH))).toThrow(/32 bytes/);
  });

  it("rejects a tampered ciphertext", () => {
    const key = freshKey();
    const envelope = encryptRaw(key, Buffer.from("sensitive"));
    // Flip a byte inside the ciphertext region.
    const tampered = Buffer.from(envelope);
    const ctStart = 1 + NONCE_LENGTH;
    tampered.writeUInt8(tampered.readUInt8(ctStart) ^ 0xff, ctStart);
    expect(() => decryptRaw(key, tampered)).toThrow(DecryptionError);
  });

  it("rejects a tampered auth tag", () => {
    const key = freshKey();
    const envelope = encryptRaw(key, Buffer.from("sensitive"));
    const tampered = Buffer.from(envelope);
    const last = tampered.length - 1;
    tampered.writeUInt8(tampered.readUInt8(last) ^ 0x01, last);
    expect(() => decryptRaw(key, tampered)).toThrow(DecryptionError);
  });

  it("rejects a different DEK (key mismatch = tamper)", () => {
    const key1 = freshKey();
    const key2 = freshKey();
    const envelope = encryptRaw(key1, Buffer.from("tenant1 secret"));
    expect(() => decryptRaw(key2, envelope)).toThrow(DecryptionError);
  });

  it("rejects envelopes shorter than the minimum", () => {
    const key = freshKey();
    const tooShort = Buffer.alloc(MIN_ENVELOPE_LENGTH - 1);
    expect(() => decryptRaw(key, tooShort)).toThrow(EnvelopeError);
  });

  it("rejects envelopes with an unknown version byte", () => {
    const key = freshKey();
    const envelope = encryptRaw(key, Buffer.from("x"));
    const badVersion = Buffer.from(envelope);
    badVersion.writeUInt8(0x02, 0); // future version, not yet supported
    expect(() => decryptRaw(key, badVersion)).toThrow(EnvelopeError);
  });

  it("handles empty plaintext", () => {
    const key = freshKey();
    const envelope = encryptRaw(key, Buffer.alloc(0));
    const pt = decryptRaw(key, envelope);
    expect(pt.length).toBe(0);
  });
});
