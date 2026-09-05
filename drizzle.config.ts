import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config.
 *
 * `driver: "d1-http"` lets drizzle-kit talk to a remote D1 database over
 * Cloudflare's HTTP API (used by commands like `drizzle-kit studio` /
 * `drizzle-kit push`). `drizzle-kit generate` (used by `npm run db:generate`)
 * only needs `dialect` + `schema` + `out` and does not touch a real database,
 * so the credentials below are only required for those other commands and
 * are read from the environment rather than hardcoded.
 */
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
  },
});
