/**
 * AES-256-GCM primitives used by Application-Layer Encryption (ADR-0001).
 *
 * Pure: no external dependencies, no side effects. Everything the
 * higher-level module does — DEK fetching, KMS unwrapping, caching — is
 * orchestration on top of these four functions.
 *
 * Envelope format:
 *   byte  0        version (0x01)
 *   bytes 1..12    nonce (96 bits, GCM recommended)
 *   bytes 13..N    ciphertext
 *   bytes N+1..    auth tag (16 bytes)
 *
 * Tamper detection: GCM's auth tag covers the ciphertext + AAD. Any byte
 * flipped in transit or at rest causes decryption to throw.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
export const KEY_LENGTH = 32; // 256 bits
export const NONCE_LENGTH = 12; // 96 bits (GCM recommended)
export const TAG_LENGTH = 16; // 128 bits
export const VERSION_BYTE = 0x01;
export const MIN_ENVELOPE_LENGTH = 1 + NONCE_LENGTH + TAG_LENGTH; // no payload

export class EnvelopeError extends Error {
  constructor(reason: string) {
    super(`Invalid encryption envelope: ${reason}`);
    this.name = "EnvelopeError";
  }
}

export class DecryptionError extends Error {
  constructor(cause: unknown) {
    super(
      "Decryption failed (likely tampered ciphertext, wrong DEK, or corrupted envelope). " +
        `Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = "DecryptionError";
  }
}

/**
 * Encrypts `plaintext` with the given 32-byte DEK. Returns a self-describing
 * envelope (version + nonce + ciphertext + tag). The nonce is fresh random
 * bytes per call — NEVER reused with the same key.
 */
export function encryptRaw(dek: Buffer, plaintext: Buffer): Buffer {
  if (dek.length !== KEY_LENGTH) {
    throw new Error(`DEK must be ${KEY_LENGTH.toString()} bytes; got ${dek.length.toString()}`);
  }

  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, dek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([Buffer.from([VERSION_BYTE]), nonce, ciphertext, tag]);
}

/**
 * Decrypts an envelope produced by `encryptRaw`. Throws on any tampering,
 * wrong DEK, bad version byte, or short envelope.
 */
export function decryptRaw(dek: Buffer, envelope: Buffer): Buffer {
  if (dek.length !== KEY_LENGTH) {
    throw new Error(`DEK must be ${KEY_LENGTH.toString()} bytes; got ${dek.length.toString()}`);
  }
  if (envelope.length < MIN_ENVELOPE_LENGTH) {
    throw new EnvelopeError(
      `envelope is ${envelope.length.toString()} bytes but minimum is ${MIN_ENVELOPE_LENGTH.toString()}`,
    );
  }

  const version = envelope[0];
  if (version !== VERSION_BYTE) {
    throw new EnvelopeError(`unsupported version byte 0x${version?.toString(16) ?? "??"}`);
  }

  const nonce = envelope.subarray(1, 1 + NONCE_LENGTH);
  const tag = envelope.subarray(envelope.length - TAG_LENGTH);
  const ciphertext = envelope.subarray(1 + NONCE_LENGTH, envelope.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, dek, nonce);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (error) {
    throw new DecryptionError(error);
  }
}
