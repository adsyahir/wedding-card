#!/usr/bin/env node
// @ts-check

/**
 * Export and import the wedding settings (the `site_settings.wedding_config`
 * row) as a JSON file.
 *
 * Usage:
 *   npm run settings:export              # local D1  -> wedding-settings.json
 *   npm run settings:export -- --remote  # remote D1 -> wedding-settings.json
 *   npm run settings:import              # wedding-settings.json -> local D1
 *   npm run settings:import -- --remote  # wedding-settings.json -> remote D1
 *   npm run settings:import -- --reset   # delete the row (back to file defaults)
 *   ... -- --file other.json             # use a different file
 *
 * WHY THIS EXISTS
 *
 * Everything the admin can edit — names, date, venue, atur cara, contacts,
 * section toggles, headcount mode, script font, notification recipients —
 * lives in ONE JSON document in `site_settings` under the key
 * `wedding_config`, deep-merged over the defaults in
 * `src/config/wedding.ts`. Without this script the only way to fill it in
 * is to click through the admin UI, which means doing the whole thing
 * twice: once locally to try it out, and again against production.
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH
 *
 * - `rsvps` and `wishes` — guest data, never seeded or copied between
 *   environments. Moving real names and phone numbers around by script is
 *   how PII ends up somewhere nobody meant it to be.
 * - `admin_users` / `sessions` — use `npm run seed:admin`.
 * - `gallery_images` and `music_tracks` — those rows point at R2 objects,
 *   so copying the rows alone would leave dangling references. Re-upload
 *   through the admin panel instead.
 *
 * A NOTE ON VALIDATION
 *
 * This script does not run the Zod schema (it is plain Node; the schema is
 * TypeScript inside the app). It checks the file is a JSON object and
 * nothing more. That is safe rather than sloppy: `getWeddingConfig()`
 * validates on every read and falls back to the file defaults if the
 * document is malformed, so a bad import degrades to "the card shows the
 * defaults", never to a broken page. If the card looks unchanged after an
 * import, a validation failure is the first thing to suspect — check the
 * server logs.
 */

import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SETTINGS_KEY = "wedding_config";
const DEFAULT_FILE = "wedding-settings.json";

const args = process.argv.slice(2);
const mode = args[0];
const useRemote = args.includes("--remote");
const doReset = args.includes("--reset");

const fileFlagIndex = args.indexOf("--file");
const filePath = fileFlagIndex !== -1 ? args[fileFlagIndex + 1] : DEFAULT_FILE;

const target = useRemote ? "remote D1" : "local D1 (miniflare)";
const scopeFlag = useRemote ? "--remote" : "--local";

function fail(message) {
  console.error(`\nRalat: ${message}\n`);
  process.exit(1);
}

/** Runs a read-only query and returns the parsed rows. */
function query(sql) {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "DB", scopeFlag, "--json", "--command", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  // wrangler prints banner text before the JSON on some versions; take the
  // first thing that parses as JSON rather than assuming the whole stream is.
  const start = out.indexOf("[");
  if (start === -1) fail("could not parse wrangler output as JSON");
  return JSON.parse(out.slice(start))[0]?.results ?? [];
}

/** Runs a statement via a temp .sql file, so values never go through the shell. */
async function execute(sql) {
  const dir = await mkdtemp(path.join(tmpdir(), "wc-settings-"));
  const file = path.join(dir, "statement.sql");
  try {
    await writeFile(file, sql, "utf8");
    execFileSync("npx", ["wrangler", "d1", "execute", "DB", scopeFlag, "--file", file], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** SQLite string literal escaping: double any single quote. */
function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function exportSettings() {
  const rows = query(`SELECT value FROM site_settings WHERE key = '${SETTINGS_KEY}'`);
  if (rows.length === 0) {
    console.log(
      `\nTiada tetapan tersimpan dalam ${target}.\n` +
        `Kad sedang menggunakan nilai lalai daripada src/config/wedding.ts.\n` +
        `Ubah sesuatu dalam /admin/settings dahulu, kemudian export semula.\n`,
    );
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(rows[0].value);
  } catch {
    fail("the stored settings row is not valid JSON — refusing to overwrite the file with it");
  }

  await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  const keys = Object.keys(parsed);
  console.log(
    `\nBerjaya: tetapan daripada ${target} disimpan ke ${filePath}\n` +
      `(${keys.length} medan: ${keys.join(", ")})\n`,
  );
}

async function importSettings() {
  if (doReset) {
    await execute(`DELETE FROM site_settings WHERE key = ${sqlString(SETTINGS_KEY)};`);
    console.log(
      `\nBerjaya: tetapan dipadam daripada ${target}.\n` +
        `Kad kini menggunakan nilai lalai daripada src/config/wedding.ts.\n`,
    );
    return;
  }

  if (!existsSync(filePath)) {
    fail(
      `${filePath} tidak dijumpai.\n` +
        `Jalankan \`npm run settings:export\` dahulu, atau tunjuk fail lain dengan --file.`,
    );
  }

  let doc;
  try {
    doc = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${filePath} bukan JSON yang sah: ${error.message}`);
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    fail(`${filePath} mesti mengandungi satu objek JSON.`);
  }

  const now = Math.floor(Date.now() / 1000);
  const value = JSON.stringify(doc);

  // Upsert, so importing twice updates rather than failing on the primary key.
  await execute(
    `INSERT INTO site_settings (key, value, updated_at, updated_by)
     VALUES (${sqlString(SETTINGS_KEY)}, ${sqlString(value)}, ${now}, 'settings-script')
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by;`,
  );

  console.log(
    `\nBerjaya: ${filePath} ditulis ke ${target}.\n` +
      `(${Object.keys(doc).length} medan)\n` +
      `Muat semula kad untuk melihat perubahan. Jika ia kelihatan tidak berubah,\n` +
      `kemungkinan dokumen gagal pengesahan dan kad kembali ke nilai lalai —\n` +
      `semak log pelayan.\n`,
  );
}

if (mode === "export") {
  await exportSettings();
} else if (mode === "import") {
  await importSettings();
} else {
  console.error(
    `\nGunakan:\n` +
      `  npm run settings:export [-- --remote] [--file <fail>]\n` +
      `  npm run settings:import [-- --remote] [--file <fail>]\n` +
      `  npm run settings:import -- --reset\n`,
  );
  process.exit(1);
}
