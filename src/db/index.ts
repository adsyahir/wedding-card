import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

/**
 * Returns a Drizzle ORM client bound to the app's D1 database.
 *
 * Must only be called from server-side code (route handlers, server
 * components, server actions) — never from client components — which is
 * enforced by the `server-only` import above.
 */
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

export type Database = ReturnType<typeof getDb>;
export * from "./schema";
