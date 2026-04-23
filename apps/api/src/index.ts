/**
 * AIMS v2 — Fastify + tRPC API bootstrap.
 *
 * Per ADR-0003, Fastify is the hot path; NestJS lives in apps/worker.
 *
 * On startup:
 *   1. Load config from env
 *   2. Build the Services container (Prisma, KMS, encryption, session, keys)
 *   3. Register Fastify plugins (helmet, cors, cookie)
 *   4. Mount the tRPC router at /trpc
 *   5. Add a /health route
 *   6. Listen
 *
 * SIGINT / SIGTERM flush pending work and dispose services before exit.
 */

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import { loadConfig } from "./config";
import { createContext } from "./context";
import { appRouter } from "./routers/root";
import { createServices, disposeServices, type Services } from "./services";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const services = await createServices(config);

  const app = Fastify({
    logger: { level: process.env["LOG_LEVEL"] ?? "info" },
    maxParamLength: 5000, // tRPC inputs via querystring can be long
  });

  await app.register(helmet, { global: true });
  await app.register(cors, { origin: [...config.corsOrigins], credentials: true });
  await app.register(cookie);
  await app.register(sensible);

  app.get("/health", () => ({
    status: "ok",
    service: "@aims/api",
    version: "0.0.1",
    timestamp: new Date().toISOString(),
  }));

  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: ({ req, res }: { req: FastifyRequest; res: FastifyReply }) =>
        createContext(services, req, res),
    },
  });

  app.addHook("onClose", async () => {
    await disposeServices(services);
  });

  installSignalHandlers(app, services);

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`AIMS API listening on http://${config.host}:${config.port.toString()}`);
  } catch (error) {
    app.log.error(error);
    throw error;
  }
}

function installSignalHandlers(app: FastifyInstance, services: Services): void {
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down…`);
    try {
      await app.close();
      await disposeServices(services);
      process.exitCode = 0;
    } catch (err) {
      app.log.error({ err }, "Shutdown failed");
      process.exitCode = 1;
    }
  };
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

await bootstrap();
