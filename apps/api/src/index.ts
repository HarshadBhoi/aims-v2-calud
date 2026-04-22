/**
 * AIMS v2 — Fastify API bootstrap.
 *
 * Per ADR-0003, Fastify is the hot path. NestJS is workers only (apps/worker).
 *
 * SLICE A SCAFFOLD: This is a minimal health-check service that proves the
 * workspace resolves. Real plumbing arrives across Tasks 2.4–3.6:
 *   - Task 2.4: tRPC on Fastify, context carries tenantId + userId + sessionId
 *   - Task 2.5: engagement procedures
 *   - Task 2.6: pack procedures
 *   - Task 3.2: finding procedures
 *   - Task 3.5: MFA step-up middleware
 *   - Task 4.1: report procedures
 *
 * See VERTICAL-SLICE-PLAN.md §4 Week 2–4.
 */

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import Fastify from "fastify";

const PORT = Number.parseInt(process.env["PORT"] ?? "3001", 10);
const HOST = process.env["HOST"] ?? "0.0.0.0";

const app = Fastify({
  logger: {
    level: process.env["LOG_LEVEL"] ?? "info",
    transport:
      process.env["NODE_ENV"] === "development"
        ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
        : undefined,
  },
});

await app.register(helmet, { global: true });
await app.register(cors, {
  origin: process.env["CORS_ORIGIN"]?.split(",") ?? ["http://localhost:3000"],
  credentials: true,
});
await app.register(sensible);

app.get("/health", () => ({
  status: "ok",
  service: "@aims/api",
  version: "0.0.1",
  timestamp: new Date().toISOString(),
}));

app.get("/", () => ({
  name: "AIMS v2 API",
  docs: "See /product/api-catalog.md for the full surface (not yet implemented).",
}));

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`AIMS API listening on http://${HOST}:${PORT.toString()}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
