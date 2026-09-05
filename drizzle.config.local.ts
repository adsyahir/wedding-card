import { defineConfig } from "drizzle-kit";

import { localD1Path } from "./scripts/local-d1-path.mjs";

/**
 * drizzle-kit config pointed at the LOCAL D1 store.
 *
 * Local development already runs entirely on SQLite: `next dev` serves the
 * app through Miniflare, whose D1 implementation is a real SQLite file on
 * disk (see `scripts/local-d1-path.mjs`). This config points Drizzle Studio
 * straight at that same file, so `npm run db:studio` browses exactly the
 * data the running dev server reads and writes — no separate database, no
 * sync step, no drift from what the Workers runtime sees.
 *
 * The sibling `drizzle.config.ts` targets the REMOTE D1 over Cloudflare's
 * HTTP API and is what `npm run db:generate` uses.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: localD1Path(),
  },
});
