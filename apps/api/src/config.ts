/**
 * Runtime configuration, loaded once at startup.
 *
 * Fails fast if required env vars are missing. This is where env-var
 * weirdness gets normalized so the rest of the app sees clean values.
 */

import { resolve } from "node:path";

export type Config = {
  readonly nodeEnv: "development" | "test" | "production";
  readonly port: number;
  readonly host: string;
  readonly corsOrigins: readonly string[];

  readonly jwtIssuer: string;
  readonly devKeyPath: string;
  readonly accessTokenTtlMs: number;
  readonly refreshTokenTtlMs: number;

  readonly awsRegion: string;
  readonly awsEndpointUrl: string | undefined;
  readonly kmsMasterKeyAlias: string;

  readonly refreshCookieName: string;
  readonly accessCookieName: string;
  readonly cookieSecure: boolean;
};

function required(key: string): string {
  const value = process.env[key];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function optional(key: string): string | undefined {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

export function loadConfig(): Config {
  const rawNodeEnv = process.env["NODE_ENV"] ?? "development";
  const nodeEnv: Config["nodeEnv"] =
    rawNodeEnv === "production" ? "production" : rawNodeEnv === "test" ? "test" : "development";

  const cookieSecure = nodeEnv === "production";

  return {
    nodeEnv,
    port: Number.parseInt(process.env["API_PORT"] ?? process.env["PORT"] ?? "3001", 10),
    host: process.env["HOST"] ?? "0.0.0.0",
    corsOrigins: (process.env["CORS_ORIGIN"] ?? "http://localhost:3000").split(",").map((s) => s.trim()),

    jwtIssuer: process.env["AUTH_JWT_ISSUER"] ?? "aims-api",
    devKeyPath: resolve(process.env["AUTH_DEV_KEY_PATH"] ?? ".auth-keys.json"),
    accessTokenTtlMs: Number.parseInt(process.env["AUTH_ACCESS_TOKEN_TTL_MS"] ?? String(15 * 60 * 1000), 10),
    refreshTokenTtlMs: Number.parseInt(
      process.env["AUTH_REFRESH_TOKEN_TTL_MS"] ?? String(7 * 24 * 60 * 60 * 1000),
      10,
    ),

    awsRegion: process.env["AWS_REGION"] ?? "us-east-1",
    awsEndpointUrl: optional("AWS_ENDPOINT_URL"),
    kmsMasterKeyAlias: process.env["AWS_KMS_MASTER_KEY_ALIAS"] ?? "alias/aims-dev-master",

    refreshCookieName: process.env["AUTH_REFRESH_COOKIE"] ?? "aims_refresh",
    accessCookieName: process.env["AUTH_ACCESS_COOKIE"] ?? "aims_access",
    cookieSecure,
  };
}

// Re-export the required helper for callers that need to assert env presence
// for optional features (e.g., a CLI that needs DATABASE_URL).
export { required as requireEnv };
