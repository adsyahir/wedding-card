import "server-only";

import type { rsvps, wishes } from "@/db/schema";
import { sendMailjetEmail } from "@/lib/mailjet";
import { checkRateLimit } from "@/lib/rate-limit";
import { getWeddingConfig, type NotificationsConfig } from "@/lib/wedding-config";

/**
 * Fire-and-forget email notifications to the couple/family when a guest
 * submits an RSVP or an ucapan (well-wish), via Mailjet
 * (`src/lib/mailjet.ts`).
 *
 * THE ONE RULE THIS MODULE MUST NEVER BREAK: a guest's RSVP/ucapan write
 * has ALREADY SUCCEEDED by the time either function here is called (see the
 * call sites in `src/app/api/rsvp/route.ts` / `src/app/api/wishes/route.ts`
 * — always AFTER the DB write, dispatched via `ctx.waitUntil()` so the
 * response returns to the guest first). Nothing in this module may throw;
 * every failure (missing config, missing secrets, throttled, Mailjet
 * down) is caught and logged, never surfaced, and can never retroactively
 * fail a request that has already returned 200 to the guest.
 */

type RsvpRow = typeof rsvps.$inferSelect;
type WishRow = typeof wishes.$inferSelect;

/** Caps notification emails at 20/hour, globally, across RSVP + ucapan combined. */
const NOTIFY_RATE_LIMIT = 20;
const NOTIFY_RATE_WINDOW_SECONDS = 60 * 60; // 1 hour
const NOTIFY_RATE_LIMIT_KEY = "notify:global";

/**
 * Escapes the five HTML-significant characters. Guest-supplied text (name,
 * message, phone) is interpolated straight into the notification's HTML
 * part — this is the only thing standing between that and a stored/reflected
 * HTML-injection issue in whatever mail client renders the notification, so
 * every guest-supplied field MUST be passed through this before going into
 * `htmlPart`. The plain-text part needs no escaping (see `buildRsvpEmail`/
 * `buildUcapanEmail`).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Pure predicate: given the resolved notifications config and which event
 * just happened, should an email actually be attempted? Factored out of
 * `notifyNewRsvp`/`notifyNewUcapan` so it's testable with a plain object —
 * no D1, no network, no Cloudflare bindings (see `src/lib/notify.test.ts`).
 *
 * Does NOT account for the rate-limit throttle or missing Mailjet secrets —
 * those are checked separately (a network/DB call each), after this cheap,
 * synchronous gate has already said "yes, in principle, send this".
 */
export function shouldSendNotification(
  config: NotificationsConfig,
  event: "rsvp" | "ucapan",
): boolean {
  if (!config.enabled) return false;
  if (config.recipients.length === 0) return false;
  if (event === "rsvp" && !config.onRsvp) return false;
  if (event === "ucapan" && !config.onUcapan) return false;
  return true;
}

function siteOrigin(): Promise<string> {
  return getWeddingConfig().then((config) => config.siteUrl);
}

async function buildRsvpEmail(
  rsvp: RsvpRow,
  wish: AttachedWish | null,
): Promise<{ subject: string; textPart: string; htmlPart: string }> {
  const origin = await siteOrigin();
  const adminUrl = `${origin}/admin/rsvp`;
  const ucapanUrl = `${origin}/admin/ucapan`;
  const attendanceLabel = rsvp.attending ? "Hadir" : "Tidak hadir";
  const message = rsvp.message ?? "-";

  // Flagged in the subject so the family can see at a glance that this one
  // also needs moderating, without opening it.
  const subject = wish ? `RSVP + ucapan baharu: ${rsvp.name}` : `RSVP baharu: ${rsvp.name}`;

  const textPart = [
    "RSVP baharu diterima.",
    "",
    `Nama: ${rsvp.name}`,
    `Kehadiran: ${attendanceLabel}`,
    `Dewasa: ${rsvp.adults}`,
    `Kanak-kanak: ${rsvp.children}`,
    `Telefon: ${rsvp.phone}`,
    `Mesej peribadi: ${message}`,
    ...(wish
      ? [
          "",
          "Ucapan untuk dipaparkan (MENUNGGU KELULUSAN):",
          wish.message,
          "",
          `Luluskan ucapan: ${ucapanUrl}`,
        ]
      : []),
    "",
    `Lihat senarai RSVP: ${adminUrl}`,
  ].join("\n");

  const htmlPart = `
    <h2>RSVP baharu diterima</h2>
    <table>
      <tr><td><strong>Nama</strong></td><td>${escapeHtml(rsvp.name)}</td></tr>
      <tr><td><strong>Kehadiran</strong></td><td>${escapeHtml(attendanceLabel)}</td></tr>
      <tr><td><strong>Dewasa</strong></td><td>${rsvp.adults}</td></tr>
      <tr><td><strong>Kanak-kanak</strong></td><td>${rsvp.children}</td></tr>
      <tr><td><strong>Telefon</strong></td><td>${escapeHtml(rsvp.phone)}</td></tr>
      <tr><td><strong>Mesej peribadi</strong></td><td>${escapeHtml(message)}</td></tr>
    </table>
    ${
      wish
        ? `<h3>Ucapan untuk dipaparkan &mdash; menunggu kelulusan</h3>
    <blockquote>${escapeHtml(wish.message)}</blockquote>
    <p><a href="${escapeHtml(ucapanUrl)}">Luluskan ucapan</a></p>`
        : ""
    }
    <p><a href="${escapeHtml(adminUrl)}">Lihat senarai RSVP</a></p>
  `.trim();

  return { subject, textPart, htmlPart };
}

async function buildUcapanEmail(
  wish: WishRow,
): Promise<{ subject: string; textPart: string; htmlPart: string }> {
  const origin = await siteOrigin();
  const adminUrl = `${origin}/admin/ucapan`;

  const subject = `Ucapan baharu daripada ${wish.name}`;

  const textPart = [
    "Ucapan baharu diterima (masih menunggu kelulusan — belum tersiar).",
    "",
    `Nama: ${wish.name}`,
    `Mesej: ${wish.message}`,
    "",
    `Semak & luluskan: ${adminUrl}`,
  ].join("\n");

  const htmlPart = `
    <h2>Ucapan baharu diterima</h2>
    <p><em>Ucapan ini masih berstatus "pending" — belum tersiar di kad jemputan
    sehingga anda meluluskannya.</em></p>
    <table>
      <tr><td><strong>Nama</strong></td><td>${escapeHtml(wish.name)}</td></tr>
      <tr><td><strong>Mesej</strong></td><td>${escapeHtml(wish.message)}</td></tr>
    </table>
    <p><a href="${escapeHtml(adminUrl)}">Semak &amp; luluskan ucapan</a></p>
  `.trim();

  return { subject, textPart, htmlPart };
}

/**
 * Checks the 20/hour global throttle. Returns `true` if sending is allowed.
 * When throttled, logs and the caller skips the send entirely — the
 * RSVP/ucapan row this was called for is ALREADY written and stays written
 * either way; only the email itself is skipped.
 */
async function underThrottle(): Promise<boolean> {
  const result = await checkRateLimit(
    NOTIFY_RATE_LIMIT_KEY,
    NOTIFY_RATE_LIMIT,
    NOTIFY_RATE_WINDOW_SECONDS,
  );
  if (!result.allowed) {
    console.warn(
      "notify: throttled — more than 20 notification emails in the last hour, skipping send",
    );
  }
  return result.allowed;
}

/**
 * Notifies the configured recipients of a new RSVP. Fire-and-forget: call
 * this wrapped in `ctx.waitUntil()` AFTER the RSVP row has already been
 * written successfully. Never throws — every failure path is caught,
 * logged, and swallowed.
 */
export type AttachedWish = { name: string; message: string };

/**
 * `wish` is the optional public ucapan a guest may submit inside the RSVP
 * form. It is folded into the SAME email rather than sent as a second one:
 * one guest action should produce one notification, and the two pieces
 * belong together in the family's inbox.
 */
export async function notifyNewRsvp(rsvp: RsvpRow, wish?: AttachedWish | null): Promise<void> {
  try {
    const config = await getWeddingConfig();
    if (!shouldSendNotification(config.notifications, "rsvp")) return;

    if (!(await underThrottle())) return;

    const { subject, textPart, htmlPart } = await buildRsvpEmail(rsvp, wish ?? null);
    const result = await sendMailjetEmail({
      to: config.notifications.recipients,
      subject,
      textPart,
      htmlPart,
    });

    if (!result.ok) {
      console.error(`notifyNewRsvp: send failed (${result.reason})`, result.detail);
    }
  } catch (error) {
    console.error("notifyNewRsvp: unexpected error, swallowed", error);
  }
}

/**
 * Notifies the configured recipients of a new ucapan (well-wish). Fire-and-
 * forget, same contract as `notifyNewRsvp`.
 *
 * NOTE: this is a MODERATION PROMPT, not a "your wish is live" notice — the
 * wish row is inserted as `status: "pending"` and is not yet visible on the
 * public wall (see `src/app/api/wishes/route.ts`); the email exists so the
 * admin knows there's something in the queue to review.
 */
export async function notifyNewUcapan(wish: WishRow): Promise<void> {
  try {
    const config = await getWeddingConfig();
    if (!shouldSendNotification(config.notifications, "ucapan")) return;

    if (!(await underThrottle())) return;

    const { subject, textPart, htmlPart } = await buildUcapanEmail(wish);
    const result = await sendMailjetEmail({
      to: config.notifications.recipients,
      subject,
      textPart,
      htmlPart,
    });

    if (!result.ok) {
      console.error(`notifyNewUcapan: send failed (${result.reason})`, result.detail);
    }
  } catch (error) {
    console.error("notifyNewUcapan: unexpected error, swallowed", error);
  }
}
