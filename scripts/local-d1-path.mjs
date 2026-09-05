/**
 * Resolves the path to the SQLite file that backs the LOCAL D1 database.
 *
 * `next dev` and `wrangler ... --local` both run D1 through Miniflare, and
 * Miniflare's D1 is a plain SQLite file on disk under `.wrangler/state`.
 * The filename is a hash derived from the database id, so it is not stable
 * across a `database_id` change — we pick the most recently modified
 * non-metadata `.sqlite` file, which is always the store currently in use.
 *
 * Run directly (`node scripts/local-d1-path.mjs`) to print the path, e.g.
 * to open it in a SQLite GUI.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const D1_DIR = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";

export function localD1Path() {
  let entries;
  try {
    entries = readdirSync(D1_DIR);
  } catch {
    throw new Error(
      `No local D1 store found at ${D1_DIR}.\n` +
        `Run \`npm run db:migrate:local\` first to create it.`,
    );
  }

  const candidates = entries
    .filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite")
    .map((f) => {
      const path = join(D1_DIR, f);
      return { path, mtime: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (candidates.length === 0) {
    throw new Error(
      `No local D1 database file in ${D1_DIR}.\n` +
        `Run \`npm run db:migrate:local\` first to create it.`,
    );
  }

  return candidates[0].path;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(localD1Path());
}
