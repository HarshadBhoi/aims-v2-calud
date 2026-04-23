/**
 * Dev-only Ed25519 keypair management for access-token JWTs.
 *
 * Persists a JWK-serialized keypair to a gitignored file so that restarts
 * don't invalidate outstanding tokens during dev. First invocation
 * generates a fresh keypair.
 *
 * Prod uses KMS-managed asymmetric keys (signer = KMS Sign API, verifier =
 * local public key). Swap-in point: createSessionModule accepts CryptoKey
 * instances — any source works as long as the interface matches.
 */

/* eslint-disable security/detect-non-literal-fs-filename --
 * Dev key storage path is supplied by the caller (typically from an env
 * var). Not a user-controlled input in any sensitive way.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { type JWK, type KeyLike, exportJWK, generateKeyPair, importJWK } from "jose";

const KEY_ALG = "EdDSA";
const KEY_CRV = "Ed25519";

export type DevKeyPair = {
  readonly privateKey: KeyLike;
  readonly publicKey: KeyLike;
};

export async function loadOrGenerateDevKeys(path: string): Promise<DevKeyPair> {
  if (await fileExists(path)) {
    return loadFromFile(path);
  }
  const pair = await generateAndPersist(path);
  return pair;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadFromFile(path: string): Promise<DevKeyPair> {
  const raw = await readFile(path, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!isKeyFile(parsed)) {
    throw new Error(`Dev key file at ${path} is malformed. Delete it to regenerate.`);
  }
  const privateKey = await importJWK(parsed.privateJwk, KEY_ALG);
  const publicKey = await importJWK(parsed.publicJwk, KEY_ALG);
  // importJWK can return KeyLike | Uint8Array; for EdDSA JWK input it's always
  // KeyLike, so assert explicitly.
  return { privateKey: assertKeyLike(privateKey), publicKey: assertKeyLike(publicKey) };
}

async function generateAndPersist(path: string): Promise<DevKeyPair> {
  const pair = await generateKeyPair(KEY_ALG, { crv: KEY_CRV, extractable: true });

  const [privateJwk, publicJwk] = await Promise.all([
    exportJWK(pair.privateKey),
    exportJWK(pair.publicKey),
  ]);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify({ privateJwk, publicJwk, alg: KEY_ALG, crv: KEY_CRV }, null, 2),
    "utf8",
  );

  return pair;
}

type KeyFile = {
  readonly privateJwk: JWK;
  readonly publicJwk: JWK;
};

function isKeyFile(value: unknown): value is KeyFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "privateJwk" in value &&
    "publicJwk" in value &&
    isJwk((value as { privateJwk: unknown }).privateJwk) &&
    isJwk((value as { publicJwk: unknown }).publicJwk)
  );
}

function isJwk(value: unknown): value is JWK {
  return (
    typeof value === "object" && value !== null && "kty" in value && typeof value.kty === "string"
  );
}

function assertKeyLike(value: KeyLike | Uint8Array): KeyLike {
  if (value instanceof Uint8Array) {
    throw new Error("Expected asymmetric key but got symmetric Uint8Array.");
  }
  return value;
}
