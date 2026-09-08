#!/usr/bin/env node
// @ts-check

/**
 * Points `wedding-local.sqlite` at the SQLite file Miniflare is actually
 * using for the local D1 database.
 *
 * WHY A SYMLINK RATHER THAN CONFIGURATION: Miniflare owns the path. It
 * stores D1 at
 * `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`, where
 * the hash is derived from `database_id` in `wrangler.jsonc`. There is no
 * setting that renames it — only `--persist-to`, which moves the whole
 * directory, not the file. So the stable, memorable path has to be a link
 * to wherever the hash currently lands.
 *
 * WHY IT IS WORTH HAVING: that hash changes whenever `database_id` does,
 * silently, and a fresh empty database appears in its place. That already
 * happened once here and cost an admin login and every saved setting. A
 * named link makes the current store easy to open in `sqlite3` or a GUI,
 * and re-running this script after an id change re-points it in one step.
 *
 * Usage:
 *   npm run db:local:link      # create or refresh the link
 *
 * The link is gitignored (`wedding-local.sqlite*`), like the store itself,
 * which holds the admin password hash and guest PII.
 */

import { lstatSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { relative, resolve } from "node:path";

import { localD1Path } from "./local-d1-path.mjs";

const LINK = "wedding-local.sqlite";

const target = resolve(localD1Path());
const linkPath = resolve(LINK);

// Refuse to clobber a real database that happens to sit at this path: an
// existing non-empty regular file here is somebody's data, not a stale link.
let existing;
try {
  existing = lstatSync(linkPath);
} catch {
  existing = null;
}

if (existing && !existing.isSymbolicLink()) {
  if (existing.size > 0) {
    console.error(
      `\nRalat: ${LINK} is a real file of ${existing.size} bytes, not a link.\n` +
        `Refusing to replace it — move or delete it yourself if it is not needed.\n`,
    );
    process.exit(1);
  }
  rmSync(linkPath);
} else if (existing) {
  rmSync(linkPath);
}

// Relative target so the link keeps working if the project is moved.
symlinkSync(relative(process.cwd(), target), linkPath);

console.log(
  `\n${LINK} -> ${relative(process.cwd(), realpathSync(linkPath))}\n\n` +
    `Open it with:  sqlite3 ${LINK}\n` +
    `Re-run this after changing database_id in wrangler.jsonc.\n`,
);
