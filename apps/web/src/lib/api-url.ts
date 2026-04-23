/**
 * Resolves the tRPC endpoint URL from env with a dev-safe default.
 */

export function getApiUrl(): string {
  const url = process.env["NEXT_PUBLIC_API_URL"];
  if (url && url.length > 0) return url;
  return "http://localhost:3001/trpc";
}
