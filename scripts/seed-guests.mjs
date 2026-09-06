#!/usr/bin/env node
// @ts-check

/**
 * Seed and truncate GUEST data (rsvps + wishes) for local testing.
 *
 * Usage:
 *   npm run seed:guests                    # 12 RSVPs + wishes into local D1
 *   npm run seed:guests -- --count 40
 *   npm run guests:truncate                # wipe rsvps + wishes, local
 *   npm run guests:truncate -- --remote    # wipe them on the DEPLOYED database
 *
 * TWO DELIBERATE ASYMMETRIES, because these commands are not equally safe:
 *
 * 1. SEEDING IS LOCAL ONLY. `--remote` is refused outright. There is no
 *    situation where inventing "Nurul Huda, 3 pax" in the real wedding's
 *    database is the right move — it would be counted by the caterer.
 *
 * 2. TRUNCATING REMOTE REQUIRES TYPING A CONFIRMATION. Clearing test data
 *    off a deployed site before going live is legitimate, but the same
 *    command an hour later destroys real RSVPs from real relatives with no
 *    undo. A flag is too easy to reach for from shell history; a typed word
 *    is not.
 *
 * Neither command touches settings, admin accounts, the gallery or music —
 * use `npm run settings:import -- --reset` and `npm run seed:admin` for
 * those.
 */

import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";

const args = process.argv.slice(2);
const mode = args[0] === "truncate" ? "truncate" : "seed";
const useRemote = args.includes("--remote");

const countIndex = args.indexOf("--count");
const count = countIndex !== -1 ? Number(args[countIndex + 1]) : 12;

const scopeFlag = useRemote ? "--remote" : "--local";
const target = useRemote ? "REMOTE (deployed) D1" : "local D1 (miniflare)";

function fail(message) {
  console.error(`\nRalat: ${message}\n`);
  process.exit(1);
}

async function execute(sql) {
  const dir = await mkdtemp(path.join(tmpdir(), "wc-guests-"));
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

/** SQLite string literal: double any single quote. */
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a.trim()))));
}

// --------------------------------------------------------------------------

const NAMES = [
  "Ahmad Zulkifli bin Hassan", "Nurul Huda binti Rahim", "Muhammad Faiz bin Osman",
  "Siti Aisyah binti Kamal", "Mohd Hafiz bin Ismail", "Farah Nadia binti Zainal",
  "Amirul Hakim bin Yusof", "Nur Syafiqah binti Adnan", "Khairul Anwar bin Salleh",
  "Aina Sofea binti Roslan", "Muhammad Danial bin Aziz", "Wan Nabilah binti Wan Ali",
  "Zulhilmi bin Abdul Karim", "Nur Alia binti Shukri", "Iskandar bin Mahmud",
  "Hazwani binti Jamaluddin", "Syed Firdaus bin Syed Omar", "Puteri Balqis binti Idris",
  "Mohd Ridzuan bin Bakar", "Liyana binti Zulkarnain",
];

const WISHES = [
  "Selamat pengantin baru. Semoga bahagia hingga ke syurga.",
  "Tahniah! Semoga dipermudahkan segala urusan dan kekal bahagia.",
  "Barakallahu lakuma wa baraka alaikuma wa jamaa bainakuma fi khair.",
  "Semoga perkahwinan ini dirahmati Allah, sakinah mawaddah warahmah.",
  "Congratulations! Wishing you both a lifetime of love and laughter.",
  "Selamat mendirikan rumah tangga. Sabar dan bertolak ansur selalu.",
  "Maaf tidak dapat hadir, tetapi doa saya sentiasa bersama kalian.",
  "Semoga menjadi keluarga yang bahagia dan penuh keberkatan.",
  "Tahniah buat kedua mempelai. Semoga kekal ke anak cucu.",
  "Alhamdulillah, akhirnya! Selamat pengantin baru berdua.",
];

async function seed() {
  if (useRemote) {
    fail(
      "seeding is local only.\n" +
        "Inventing guests in the real wedding's database would put fake names and\n" +
        "fake headcounts in front of the caterer. Drop --remote.",
    );
  }
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    fail("--count mesti nombor antara 1 dan 200.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const rsvpRows = [];
  const wishRows = [];

  for (let i = 0; i < count; i++) {
    const name = NAMES[i % NAMES.length];
    // Roughly one in five cannot attend, which is about what a real list looks
    // like and exercises the Tidak Hadir paths.
    const attending = i % 5 !== 0;
    const adults = attending ? 1 + (i % 4) : 1;
    const children = attending ? i % 3 : 0;
    // Spread over the past fortnight so the analytics charts and the
    // date-sorted table have something to show.
    const createdAt = nowSec - i * 3600 * 9;
    const phone = `+601${(2 + (i % 8))}${String(10000000 + i * 137).slice(0, 7)}`;

    rsvpRows.push(
      `(${q(randomUUID())}, ${q(name)}, ${q(phone)}, ${attending ? 1 : 0}, ${adults}, ${children}, NULL, ${createdAt}, ${q("seed-" + i)}, NULL)`,
    );

    // About two thirds leave a wish; a third of those still awaiting review,
    // so the moderation queue is not empty when you open it.
    if (i % 3 !== 2) {
      const status = i % 4 === 0 ? "pending" : "approved";
      wishRows.push(
        `(${q(randomUUID())}, ${q(name)}, ${q(WISHES[i % WISHES.length])}, ${q(status)}, ${createdAt}, NULL, NULL, ${q("seed-" + i)})`,
      );
    }
  }

  await execute(
    `INSERT INTO rsvps (id, name, phone, attending, adults, children, message, created_at, visitor_hash, deleted_at) VALUES\n${rsvpRows.join(",\n")};\n` +
      `INSERT INTO wishes (id, name, message, status, created_at, moderated_at, moderated_by, visitor_hash) VALUES\n${wishRows.join(",\n")};`,
  );

  const pending = wishRows.filter((r) => r.includes("'pending'")).length;
  console.log(
    `\nBerjaya: ${count} RSVP dan ${wishRows.length} ucapan ditambah ke ${target}.\n` +
      `(${pending} ucapan menunggu semakan, ${wishRows.length - pending} diluluskan)\n` +
      `Padam semula dengan: npm run guests:truncate\n`,
  );
}

async function truncate() {
  if (useRemote) {
    console.log(
      `\n*** Ini akan MEMADAM SEMUA RSVP dan ucapan pada ${target}. ***\n` +
        `Jika kad sudah diedarkan, ini memadam jemputan sebenar daripada tetamu sebenar.\n` +
        `Tiada cara untuk membatalkannya.\n`,
    );
    const answer = await ask('Taip PADAM untuk teruskan: ');
    if (answer !== "PADAM") {
      console.log("\nDibatalkan. Tiada apa-apa dipadam.\n");
      process.exit(0);
    }
  }

  await execute("DELETE FROM rsvps;\nDELETE FROM wishes;");
  console.log(`\nBerjaya: semua RSVP dan ucapan dipadam daripada ${target}.\n`);
}

if (mode === "truncate") {
  await truncate();
} else {
  await seed();
}
