#!/usr/bin/env node
// @ts-check

/**
 * Seed and truncate the GALLERY (R2 objects + `gallery_images` rows).
 *
 * Usage:
 *   npm run seed:gallery                  # load seed/gallery/*.jpg into local R2 + D1
 *   npm run gallery:truncate              # remove every gallery image, local
 *   npm run gallery:truncate -- --remote  # remove them from the DEPLOYED site
 *
 * SAME TWO ASYMMETRIES AS `seed-guests.mjs`, for the same reasons:
 *
 * 1. SEEDING IS LOCAL ONLY. `--remote` is refused. Stock photographs of
 *    somebody else's wedding have no business on the real invitation, and
 *    they would go live the moment they were written.
 *
 * 2. TRUNCATING REMOTE REQUIRES TYPING A CONFIRMATION. Clearing test images
 *    off a deployed site is legitimate; the same command later deletes the
 *    couple's actual photographs, and the R2 objects do not come back.
 *
 * The gallery lives in two places at once — bytes in R2, metadata in D1 —
 * so both paths here delete R2 objects BEFORE the rows that name them. The
 * other order loses the keys and leaves the bucket full of objects nothing
 * references and nothing can find.
 */

import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";

const args = process.argv.slice(2);
const mode = args[0] === "truncate" ? "truncate" : "seed";
const useRemote = args.includes("--remote");

const scopeFlag = useRemote ? "--remote" : "--local";
const target = useRemote ? "REMOTE (deployed)" : "local (miniflare)";

const SEED_DIR = "seed/gallery";
const BUCKET = "wedding-card-assets";

/** Alt text matters: it is read aloud, and it is what shows if an image fails to load. */
const ALT_TEXT = {
  "1.jpg": "Kad jemputan perkahwinan dengan cincin dan bunga",
  "2.jpg": "Dewan majlis yang dihias dengan bunga dan meja tetamu",
  "3.jpg": "Pasangan memegang dua cincin perkahwinan",
};

function fail(message) {
  console.error(`\nRalat: ${message}\n`);
  process.exit(1);
}

function wrangler(cmdArgs) {
  return execFileSync("npx", ["wrangler", ...cmdArgs], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

async function execSql(sql) {
  const dir = await mkdtemp(path.join(tmpdir(), "wc-gallery-"));
  const file = path.join(dir, "statement.sql");
  try {
    await writeFile(file, sql, "utf8");
    wrangler(["d1", "execute", "DB", scopeFlag, "--file", file]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** SQLite string literal: double any single quote. */
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a.trim()))));
}

/** Every r2_key currently referenced by a row, so the objects can go too. */
function existingKeys() {
  const out = wrangler([
    "d1",
    "execute",
    "DB",
    scopeFlag,
    "--command",
    "SELECT r2_key FROM gallery_images;",
    "--json",
  ]);
  try {
    const parsed = JSON.parse(out);
    return (parsed[0]?.results ?? []).map((r) => r.r2_key).filter(Boolean);
  } catch {
    return [];
  }
}

// --------------------------------------------------------------------------

async function seed() {
  if (useRemote) {
    fail(
      "seeding is local only.\n" +
        "These are stock photographs. Writing them to the deployed site would put\n" +
        "somebody else's wedding on the real invitation. Drop --remote.",
    );
  }

  let files;
  try {
    files = (await readdir(SEED_DIR)).filter((f) => /\.jpe?g$/i.test(f)).sort();
  } catch {
    fail(`${SEED_DIR}/ not found. It should contain the sample .jpg files.`);
  }
  if (files.length === 0) fail(`No .jpg files in ${SEED_DIR}/.`);

  const startOrder = Number(
    JSON.parse(
      wrangler([
        "d1",
        "execute",
        "DB",
        scopeFlag,
        "--command",
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM gallery_images;",
        "--json",
      ]),
    )[0]?.results?.[0]?.next ?? 0,
  );

  const rows = [];
  const nowSec = Math.floor(Date.now() / 1000);

  for (const [index, filename] of files.entries()) {
    const filePath = path.join(SEED_DIR, filename);
    const sizeBytes = statSync(filePath).size;
    // Server-generated key, exactly as the upload route does: the client
    // filename never becomes an object key.
    const r2Key = `gallery/${randomUUID()}`;

    wrangler([
      "r2",
      "object",
      "put",
      `${BUCKET}/${r2Key}`,
      "--file",
      filePath,
      "--content-type",
      "image/jpeg",
      scopeFlag,
    ]);

    rows.push(
      `(${q(randomUUID())}, ${q(r2Key)}, ${q(filename)}, ${q("image/jpeg")}, ${sizeBytes}, ` +
        `${q(ALT_TEXT[filename] ?? filename)}, ${startOrder + index}, ${nowSec})`,
    );
    console.log(`  + ${filename} (${Math.round(sizeBytes / 1024)}KB) -> ${r2Key}`);
  }

  await execSql(
    "INSERT INTO gallery_images (id, r2_key, filename, mime, size_bytes, alt, sort_order, uploaded_at) VALUES\n" +
      rows.join(",\n") +
      ";",
  );

  console.log(
    `\nBerjaya: ${rows.length} gambar ditambah ke galeri ${target}.\n` +
      `Padam semula dengan: npm run gallery:truncate\n`,
  );
}

async function truncate() {
  if (useRemote) {
    console.log(
      `\n*** Ini akan MEMADAM SEMUA gambar galeri pada ${target}. ***\n` +
        `Jika gambar sebenar telah dimuat naik, ia akan hilang dari R2 dan tidak boleh dipulihkan.\n`,
    );
    const answer = await ask("Taip PADAM untuk teruskan: ");
    if (answer !== "PADAM") {
      console.log("\nDibatalkan. Tiada apa-apa dipadam.\n");
      process.exit(0);
    }
  }

  // Objects first: after the rows are gone there is nothing left that knows
  // which keys to delete.
  const keys = existingKeys();
  for (const key of keys) {
    try {
      wrangler(["r2", "object", "delete", `${BUCKET}/${key}`, scopeFlag]);
    } catch {
      console.warn(`  ! could not delete R2 object ${key} (continuing)`);
    }
  }

  await execSql("DELETE FROM gallery_images;");
  console.log(
    `\nBerjaya: ${keys.length} gambar dipadam daripada galeri ${target}.\n`,
  );
}

if (mode === "truncate") {
  await truncate();
} else {
  await seed();
}
