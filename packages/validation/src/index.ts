/**
 * @aims/validation — Shared Zod schemas + inferred types.
 *
 * Every wire-format input and output is defined here. apps/api uses these
 * for procedure input validation + response typing; apps/web uses them for
 * form validation + tRPC type inference.
 */

export * from "./common";
export * from "./engagement";
export * from "./pack";
