#!/usr/bin/env node
// @ts-check

/**
 * Interactive script to create (or, with --force, overwrite) an admin user
 * row in the `admin_users` D1 table.
 *
 * Usage:
 *   npm run seed:admin              # writes to the local D1 (miniflare) DB
 *   npm run seed:admin -- --remote  # writes to the real, deployed D1 DB
 *   npm run seed:admin -- --force   # overwrite an existing username
 *
 * SECURITY:
 * - The password is only ever read interactively from stdin, with terminal
 *   echo disabled while typing. It is NEVER accepted as a CLI argument or
 *   an environment variable — either would land in shell history and/or
 *   the OS process table, readable by any other process/user on the
 *   machine that can list processes.
 * - The password itself is never printed, logged, or written to disk.
 *   Only the derived PBKDF2 hash/salt/iteration-count are persisted (and
 *   those only inside the temporary `.sql` file passed to `wrangler d1
 *   execute`, deleted immediately after).
 * - The hash is derived with parameters IDENTICAL to
 *   `src/lib/password.ts` (`hashPassword`) — 600,000 PBKDF2-HMAC-SHA256
 *   iterations, 32-byte derived key, 16-byte random salt, hex-encoded —
 *   using Node 22's built-in Web Crypto (`globalThis.crypto.subtle`), the
 *   same API surface that code uses on Cloudflare Workers. If you change
 *   the parameters in one place, change them in both.
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 32;
const MIN_PASSWORD_LENGTH = 12;

const args = process.argv.slice(2);
const useRemote = args.includes("--remote");
const force = args.includes("--force");

async function main() {
  const prompter = createPrompter();

  try {
    const username = await prompter.ask("Nama pengguna (username): ");
    if (!isValidUsername(username)) {
      fail(
        "Username mesti 1-64 aksara, huruf/nombor/underscore/dot/dash sahaja (tiada ruang/petikan).",
      );
    }

    const existing = await usernameExists(username);
    if (existing && !force) {
      fail(`Username "${username}" sudah wujud. Guna --force untuk menimpa.`);
    }

    const password = await prompter.askPassword("Kata laluan (tidak akan dipaparkan): ");
    const confirm = await prompter.askPassword("Sahkan kata laluan: ");

    if (password !== confirm) {
      fail("Kata laluan tidak sepadan.");
    }

    const weaknessReason = weakPasswordReason(password, username);
    if (weaknessReason) {
      fail(`Kata laluan lemah: ${weaknessReason}`);
    }

    const { hash, salt } = await hashPassword(password);
    // Password value is not needed beyond this point — let it go out of
    // scope; nothing above ever wrote it anywhere.

    const id = randomUUID();
    const nowSeconds = Math.floor(Date.now() / 1000);

    const sql = buildInsertSql({
      id,
      username,
      hash,
      salt,
      iterations: PBKDF2_ITERATIONS,
      nowSeconds,
      replace: existing && force,
    });

    await runSqlFile(sql);

    console.log(`\nBerjaya: admin "${username}" telah ${existing ? "dikemaskini" : "dicipta"}.`);
    console.log(`(Sasaran: ${useRemote ? "REMOTE D1" : "local D1 (miniflare)"})`);
  } finally {
    prompter.close();
  }
}

// ---------------------------------------------------------------------------
// Password hashing (must mirror src/lib/password.ts exactly)
// ---------------------------------------------------------------------------

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password) {
  const saltBytes = new Uint8Array(SALT_BYTES);
  globalThis.crypto.getRandomValues(saltBytes);

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    DERIVED_KEY_BYTES * 8,
  );

  return { hash: toHex(new Uint8Array(derivedBits)), salt: toHex(saltBytes) };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidUsername(username) {
  return typeof username === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(username);
}

const COMMON_WEAK_PASSWORDS = new Set([
  "password123",
  "password1234",
  "123456789012",
  "qwertyuiop123",
  "letmein12345",
  "administrator",
  "changeme12345",
]);

function weakPasswordReason(password, username) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `mesti sekurang-kurangnya ${MIN_PASSWORD_LENGTH} aksara.`;
  }
  if (password.trim().length === 0) {
    return "tidak boleh hanya ruang kosong.";
  }
  if (password.toLowerCase() === username.toLowerCase()) {
    return "tidak boleh sama dengan nama pengguna.";
  }
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return "terlalu biasa/mudah diteka.";
  }
  const uniqueChars = new Set(password).size;
  if (uniqueChars < 4) {
    return "terlalu sedikit variasi aksara (cth. bukan huruf berulang).";
  }
  if (/^(.)\1+$/.test(password)) {
    return "tidak boleh aksara yang sama diulang sahaja.";
  }
  const sequences = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl"];
  const lower = password.toLowerCase();
  if (sequences.some((seq) => seq.includes(lower) && lower.length >= 8)) {
    return "tidak boleh jujukan mudah (cth. 'abcdefgh', '12345678').";
  }
  return null;
}

// ---------------------------------------------------------------------------
// D1 access via `wrangler d1 execute`
// ---------------------------------------------------------------------------

function targetFlag() {
  return useRemote ? "--remote" : "--local";
}

/** Escapes a value already validated by `isValidUsername` for a SQL string literal (belt-and-braces). */
function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

async function usernameExists(username) {
  const out = execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "DB",
      targetFlag(),
      "--json",
      "--command",
      `SELECT username FROM admin_users WHERE username = '${sqlEscape(username)}' LIMIT 1;`,
    ],
    { encoding: "utf8" },
  );

  try {
    const parsed = JSON.parse(out);
    const rows = parsed?.[0]?.results ?? [];
    return rows.length > 0;
  } catch {
    // If wrangler's output can't be parsed (unexpected format/version
    // change), fail closed: assume it might exist rather than risk a
    // silent overwrite. The operator can pass --force to proceed anyway.
    return true;
  }
}

function buildInsertSql({ id, username, hash, salt, iterations, nowSeconds, replace }) {
  const verb = replace ? "INSERT OR REPLACE" : "INSERT";
  return `${verb} INTO admin_users (id, username, password_hash, salt, iterations, created_at, failed_attempts)
VALUES ('${id}', '${sqlEscape(username)}', '${hash}', '${salt}', ${iterations}, ${nowSeconds}, 0);
`;
}

async function runSqlFile(sql) {
  const dir = await mkdtemp(path.join(tmpdir(), "wc-seed-admin-"));
  const file = path.join(dir, "seed.sql");
  try {
    await writeFile(file, sql, { mode: 0o600 });
    execFileSync("npx", ["wrangler", "d1", "execute", "DB", targetFlag(), "--file", file], {
      stdio: "inherit",
    });
  } finally {
    // Always clean up, even if the SQL contains only non-sensitive hashes —
    // no reason to leave a stray temp file with DB-write SQL lying around.
    await rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

/**
 * Builds a `{ ask, askPassword, close }` prompter, using one of two
 * completely separate strategies depending on whether stdin is a real
 * terminal:
 *
 * - **Real terminal** (`process.stdin.isTTY`): backed by a `readline`
 *   Interface. `askPassword` uses the standard technique for masking a
 *   `readline` prompt — `readline` is left to do its normal job of reading
 *   and buffering the line, and a second listener is added alongside it
 *   purely to immediately redraw over whatever `readline` just echoed, on
 *   every keystroke, before it's visible. `readline`'s own input listener
 *   (registered when the Interface was created) and this redraw listener
 *   both react to the same 'data' event, in registration order, so the
 *   echo always happens first and the redraw always overwrites it.
 *
 * - **Piped/non-interactive stdin** (e.g. an automated smoke test, or CI):
 *   reads the ENTIRE input up front with a blocking `readFileSync(0)` and
 *   answers every subsequent prompt from a pre-split queue of lines. This
 *   deliberately avoids driving multiple sequential `readline.question()`
 *   calls against buffered bulk input: `readline` can silently DROP a
 *   line if more than one complete line is already available before the
 *   matching `question()` call for it is made — exactly what happens here
 *   with 3 prompts (username, password, confirm) piped in as one write.
 *   There is no terminal echo to suppress for a non-interactive stream, so
 *   `askPassword` here is identical to `ask`.
 */
function createPrompter() {
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const ask = (promptText) =>
      new Promise((resolve) => rl.question(promptText, (answer) => resolve(answer.trim())));

    const askPassword = (promptText) =>
      new Promise((resolve) => {
        const muteEcho = () => {
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(promptText);
          readline.clearLine(process.stdout, 1);
        };

        process.stdin.on("data", muteEcho);
        rl.question(promptText, (answer) => {
          process.stdin.removeListener("data", muteEcho);
          process.stdout.write("\n");
          resolve(answer);
        });
      });

    return { ask, askPassword, close: () => rl.close() };
  }

  // fd 0 is stdin; blocks until EOF, which is exactly what a piped
  // `printf ... | node seed-admin.mjs` (or any redirected-file stdin)
  // provides once the writer closes its end.
  const inputText = readFileSync(0, "utf8");
  const remainingLines = inputText.split(/\r?\n/);
  if (remainingLines[remainingLines.length - 1] === "") {
    remainingLines.pop(); // drop the empty tail from a final trailing newline
  }

  const nextLine = () => {
    const line = remainingLines.shift();
    return line === undefined ? "" : line;
  };

  const ask = async (promptText) => {
    const line = nextLine().trim();
    process.stdout.write(promptText + line + "\n");
    return line;
  };

  const askPassword = async (promptText) => {
    const line = nextLine();
    process.stdout.write(promptText + "(daripada input berjujukan)\n");
    return line;
  };

  return { ask, askPassword, close: () => {} };
}

function fail(message) {
  console.error(`\nRalat: ${message}`);
  process.exit(1);
}

main().catch((error) => {
  console.error("\nGagal:", error?.message ?? error);
  process.exit(1);
});
