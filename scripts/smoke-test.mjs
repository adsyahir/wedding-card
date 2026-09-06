#!/usr/bin/env node
// @ts-check

/**
 * Local smoke test for a RUNNING `npm run dev` (or `wrangler dev`/preview)
 * server. Exercises the public and admin surfaces over plain HTTP with
 * Node's built-in `fetch` — no dependencies, nothing installed.
 *
 * Usage:
 *   npm run dev            # in one terminal
 *   npm run smoke           # in another, once it's up
 *   SMOKE_BASE_URL=http://localhost:8788 npm run smoke   # against `wrangler dev`/preview
 *
 * This is meant to be read when something fails, not just run — every
 * failure message says what probably went wrong and where to look.
 */

import { execFileSync } from "node:child_process";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

/** @type {{ name: string; status: "pass" | "fail" | "warn"; detail?: string }[]} */
const results = [];

function record(name, status, detail) {
  results.push({ name, status, detail });
  const icon = status === "pass" ? "✓" : status === "warn" ? "!" : "✗";
  const line = `  ${icon} ${name}`;
  console.log(status === "fail" ? line : line);
  if (detail) console.log(`      ${detail.split("\n").join("\n      ")}`);
}

function randomDigits(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/** A fresh, plausible-looking Malaysian mobile number for this run only. */
function testPhone() {
  return `01${randomDigits(8)}`; // normalizes to +601XXXXXXXX
}

const RUN_MARKER = `smoketest-${Date.now()}-${randomDigits(4)}`;

async function main() {
  console.log(`Smoke testing ${BASE_URL}\n`);

  await checkServerUp();
  await checkPublicPageOk();
  await checkSecurityHeaders();
  const phone = testPhone();
  await checkRsvpAccepted(phone);
  await checkRsvpDedupe(phone);
  await checkUcapanPendingNotPublic();
  await checkTrackView();
  await checkTrackBogusEvent();
  await checkAdminPageRedirects();
  await checkAdminApiUnauthorized();

  cleanupTestData(phone);

  printSummary();
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

async function checkServerUp() {
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
    record("Dev server is reachable", "pass");
  } catch (error) {
    record(
      "Dev server is reachable",
      "fail",
      `Could not reach ${BASE_URL}: ${error?.message ?? error}\n` +
        `Is \`npm run dev\` (or wrangler dev/preview) actually running? ` +
        `Set SMOKE_BASE_URL if it's on a different port.`,
    );
    printSummary();
    process.exit(1);
  }
}

async function checkPublicPageOk() {
  try {
    const res = await fetch(BASE_URL + "/");
    if (res.status === 200) {
      record("Public invite page returns 200", "pass");
    } else {
      record(
        "Public invite page returns 200",
        "fail",
        `Got ${res.status}. Check the server logs for an error thrown while rendering src/app/page.tsx.`,
      );
    }
  } catch (error) {
    record("Public invite page returns 200", "fail", String(error?.message ?? error));
  }
}

async function checkSecurityHeaders() {
  try {
    const res = await fetch(BASE_URL + "/");
    const required = [
      "content-security-policy",
      "x-content-type-options",
      "referrer-policy",
      "x-frame-options",
      "permissions-policy",
    ];
    const missing = required.filter((h) => !res.headers.get(h));
    if (missing.length === 0) {
      record("Security headers present on the public page", "pass");
    } else {
      record(
        "Security headers present on the public page",
        "fail",
        `Missing: ${missing.join(", ")}. Check src/middleware.ts#applySecurityHeaders and its matcher config.`,
      );
    }
  } catch (error) {
    record("Security headers present on the public page", "fail", String(error?.message ?? error));
  }
}

async function checkRsvpAccepted(phone) {
  try {
    const res = await postJson("/api/rsvp", {
      name: `${RUN_MARKER}-guest`,
      phone,
      attending: true,
      adults: 2,
      children: 0,
      message: "Tahniah!",
      website: "",
      elapsedMs: 3000,
    });
    const body = await safeJson(res);
    if (res.status === 200 && body?.ok === true) {
      record("Valid RSVP is accepted", "pass");
    } else {
      record(
        "Valid RSVP is accepted",
        "fail",
        `Got ${res.status} ${JSON.stringify(body)}. Check src/app/api/rsvp/route.ts and src/lib/validation.ts#rsvpSchema.`,
      );
    }
  } catch (error) {
    record("Valid RSVP is accepted", "fail", String(error?.message ?? error));
  }
}

async function checkRsvpDedupe(phone) {
  try {
    // Same phone, different headcount — should UPDATE the existing row, not
    // insert a second one. See the comment in src/app/api/rsvp/route.ts for
    // why the dedupe key is the phone number alone.
    const res = await postJson("/api/rsvp", {
      name: `${RUN_MARKER}-guest-updated`,
      phone,
      attending: true,
      adults: 3,
      children: 1,
      website: "",
      elapsedMs: 3000,
    });
    const body = await safeJson(res);
    if (res.status !== 200 || body?.ok !== true) {
      record(
        "Duplicate RSVP (same phone) is accepted",
        "fail",
        `Got ${res.status} ${JSON.stringify(body)}.`,
      );
      return;
    }

    const count = countLocalRows("rsvps", `phone = '+60${phone.slice(1)}' AND deleted_at IS NULL`);
    if (count === null) {
      record(
        "Duplicate RSVP updates rather than inserting",
        "warn",
        "Could not query the local D1 database directly (is `wrangler` on PATH, and is this the local dev DB?). " +
          "The HTTP round-trip succeeded, but row-count dedupe could not be verified automatically — " +
          "check the `rsvps` table for this phone number manually if you want certainty.",
      );
    } else if (count === 1) {
      record("Duplicate RSVP updates rather than inserting", "pass");
    } else {
      record(
        "Duplicate RSVP updates rather than inserting",
        "fail",
        `Expected exactly 1 row for this phone number, found ${count}. Check the dedupe logic in src/app/api/rsvp/route.ts.`,
      );
    }
  } catch (error) {
    record("Duplicate RSVP updates rather than inserting", "fail", String(error?.message ?? error));
  }
}

async function checkUcapanPendingNotPublic() {
  const marker = `${RUN_MARKER}-ucapan-should-not-be-public`;
  try {
    const res = await postJson("/api/wishes", {
      name: `${RUN_MARKER}-wisher`,
      message: marker,
      website: "",
      elapsedMs: 3000,
    });
    const body = await safeJson(res);
    if (res.status !== 200 || body?.ok !== true) {
      record(
        "Ucapan submission is accepted",
        "fail",
        `Got ${res.status} ${JSON.stringify(body)}. Check src/app/api/wishes/route.ts.`,
      );
      return;
    }
    record("Ucapan submission is accepted", "pass");

    const html = await (await fetch(BASE_URL + "/")).text();
    if (html.includes(marker)) {
      record(
        "Pending ucapan does NOT appear on the public page",
        "fail",
        "The freshly-submitted (pending) message showed up on the public invite page. " +
          "Check that getApprovedWishes() (src/db/queries/public.ts) filters status = 'approved', " +
          "and that /api/wishes always inserts with status: 'pending'.",
      );
    } else {
      record("Pending ucapan does NOT appear on the public page", "pass");
    }
  } catch (error) {
    record("Ucapan submission / moderation gate", "fail", String(error?.message ?? error));
  }
}

async function checkTrackView() {
  try {
    const res = await postJson("/api/track", { type: "view", path: "/", referrer: "" });
    if (res.status === 204) {
      record("Analytics beacon accepts a page view", "pass");
    } else {
      record(
        "Analytics beacon accepts a page view",
        "fail",
        `Got ${res.status}, expected 204. Check src/app/api/track/route.ts.`,
      );
    }
  } catch (error) {
    record("Analytics beacon accepts a page view", "fail", String(error?.message ?? error));
  }
}

async function checkTrackBogusEvent() {
  try {
    // By design, /api/track ALWAYS returns 204 regardless of whether the
    // event was actually written (see the route's own docstring) — a bogus
    // event name must not be distinguishable from a valid one by response
    // shape, and must never 400/500. This check confirms that contract
    // holds, not that the response looks different.
    const res = await postJson("/api/track", { type: "event", name: "definitely_not_a_real_event" });
    if (res.status === 204) {
      record("Bogus event name is silently dropped (still 204, never 500)", "pass");
    } else {
      record(
        "Bogus event name is silently dropped (still 204, never 500)",
        "fail",
        `Got ${res.status}, expected 204. Check the trackBodySchema/analyticsEventNameSchema validation in src/app/api/track/route.ts.`,
      );
    }
  } catch (error) {
    record("Bogus event name is silently dropped (still 204, never 500)", "fail", String(error?.message ?? error));
  }
}

async function checkAdminPageRedirects() {
  try {
    const res = await fetch(BASE_URL + "/admin", { redirect: "manual" });
    const isRedirect = res.status >= 300 && res.status < 400;
    const location = res.headers.get("location") ?? "";
    if (isRedirect && location.includes("/admin/login")) {
      record("Unauthenticated /admin redirects to /admin/login", "pass");
    } else {
      record(
        "Unauthenticated /admin redirects to /admin/login",
        "fail",
        `Got status ${res.status}, location "${location}". Check src/middleware.ts and ` +
          `src/app/admin/(protected)/layout.tsx#requireAdmin.`,
      );
    }
  } catch (error) {
    record("Unauthenticated /admin redirects to /admin/login", "fail", String(error?.message ?? error));
  }
}

async function checkAdminApiUnauthorized() {
  try {
    const res = await fetch(BASE_URL + "/api/admin/rsvp/export");
    if (res.status === 401) {
      record("Unauthenticated admin API call returns 401", "pass");
    } else {
      record(
        "Unauthenticated admin API call returns 401",
        "fail",
        `Got ${res.status}, expected 401. Check requireAdminApi() in src/lib/auth.ts.`,
      );
    }
  } catch (error) {
    record("Unauthenticated admin API call returns 401", "fail", String(error?.message ?? error));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function postJson(path, body) {
  return fetch(BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Best-effort row count against the LOCAL D1 (miniflare) sqlite store via
 * `wrangler d1 execute --local`. Returns `null` (never throws) if wrangler
 * isn't available or the query fails for any reason — callers treat that as
 * "couldn't verify," not as a test failure, since this app's local dev DB
 * and this script's invoking shell might not always agree on being able to
 * reach the same wrangler state.
 */
function countLocalRows(table, whereClause) {
  try {
    const out = execFileSync(
      "npx",
      [
        "wrangler",
        "d1",
        "execute",
        "DB",
        "--local",
        "--json",
        "--command",
        `SELECT COUNT(*) as c FROM ${table} WHERE ${whereClause};`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const parsed = JSON.parse(out);
    const row = parsed?.[0]?.results?.[0];
    return typeof row?.c === "number" ? row.c : null;
  } catch {
    return null;
  }
}

/** Deletes this run's own test rows from the local DB. Best-effort, never throws. */
function cleanupTestData(phone) {
  try {
    execFileSync(
      "npx",
      [
        "wrangler",
        "d1",
        "execute",
        "DB",
        "--local",
        "--command",
        `DELETE FROM rsvps WHERE phone = '+60${phone.slice(1)}'; ` +
          `DELETE FROM wishes WHERE name = '${RUN_MARKER}-wisher';`,
      ],
      { stdio: "ignore" },
    );
  } catch {
    // Best-effort only — leaving a stray smoke-test row behind in local dev
    // data is harmless and not worth failing the run over.
  }
}

function printSummary() {
  const passed = results.filter((r) => r.status === "pass").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;

  console.log(`\n${passed} passed, ${warned} warned, ${failed} failed (of ${results.length})\n`);

  if (failed > 0) {
    console.log("Failed checks:");
    for (const r of results.filter((x) => x.status === "fail")) {
      console.log(`  - ${r.name}`);
    }
    console.log();
  }
}

main()
  .then(() => {
    const failed = results.some((r) => r.status === "fail");
    process.exit(failed ? 1 : 0);
  })
  .catch((error) => {
    console.error("\nSmoke test crashed unexpectedly:", error);
    process.exit(1);
  });
