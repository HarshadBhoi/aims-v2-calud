/**
 * Password hashing via Argon2id.
 *
 * @node-rs/argon2 is Rust-backed with prebuilt binaries — no node-gyp compile
 * step, reliable on Apple Silicon. The pure `argon2` npm package can be
 * finicky on ARM Macs.
 *
 * Params tuned for dev clarity (~100ms hash time):
 *   memoryCost 64 MiB | timeCost 3 | parallelism 1
 *
 * These meet OWASP's 2024 minimums. Prod can tune upward at the cost of
 * login latency. See auth/ARCHITECTURE.md for the prod targets.
 */

import { hash, verify } from "@node-rs/argon2";

// Note: @node-rs/argon2 defaults to Argon2id (the recommended variant). We
// can't import the Algorithm enum explicitly under `verbatimModuleSyntax`
// (ambient const enum restriction), and we don't need to — the defaults
// are what we want.
const HASH_PARAMS = {
  memoryCost: 64 * 1024, // 64 MiB
  timeCost: 3,
  parallelism: 1,
} as const;

/** Hashes a password. Returns an argon2-encoded string (includes salt + params). */
export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, HASH_PARAMS);
}

/**
 * Verifies a password against a previously-hashed string.
 *
 * Returns `false` on any failure — including malformed hashes, wrong
 * passwords, or library errors. We intentionally swallow the error and
 * return false so callers can't distinguish "wrong password" from "corrupt
 * hash" in their responses (avoids a timing/log-message leak).
 */
export async function verifyPassword(encodedHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(encodedHash, plaintext);
  } catch {
    return false;
  }
}
