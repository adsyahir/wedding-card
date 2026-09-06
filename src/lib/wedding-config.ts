import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { wedding, type WeddingConfig } from "@/config/wedding";
import { getDb } from "@/db";
import { siteSettings } from "@/db/schema";
import { normalizeMalaysianPhone } from "@/lib/validation";

import { SCRIPT_FONT_KEYS, type ScriptFontKey } from "./script-font";

/**
 * The admin-editable slice of the wedding card's content.
 *
 * Architecture: the WHOLE editable doc is stored as a single JSON blob in
 * one `site_settings` row (key `WEDDING_CONFIG_KEY`), and `src/config/wedding.ts`
 * remains the file-based DEFAULT/fallback. `getWeddingConfig()` reads the
 * row, validates it, and deep-merges it over the file defaults.
 *
 * THE SINGLE MOST IMPORTANT PROPERTY OF THIS MODULE: the public invite card
 * must never break because of a bad admin edit. Every function that reads
 * the stored doc is wrapped so that a missing row, unparseable JSON, or a
 * doc that fails validation all fall back to the file defaults — logged
 * server-side, never thrown into the caller.
 *
 * Deliberately NOT admin-editable (kept file-only, never touched here):
 * `siteUrl`, `presetMusicPath`, `gaMeasurementId`, `gallery` — none of
 * these were named in the requirements, and the first two are
 * infra-shaped/security-sensitive enough to keep out of a JSON blob an
 * admin edits from a phone.
 */

export const WEDDING_CONFIG_KEY = "wedding_config";

const MAX_ATUR_CARA = 30;
const MAX_CONTACTS = 30;
const MAX_ADDRESS_LINES = 10;
const MAX_INVITATION_PARAGRAPHS = 10;

/** Matches ASCII control characters (0x00-0x1F, 0x7F) EXCLUDING `\n`. */
const CONTROL_CHARS_EXCEPT_NEWLINE = /[\x00-\x09\x0B-\x1F\x7F]/;

function noControlChars(value: string): boolean {
  return !CONTROL_CHARS_EXCEPT_NEWLINE.test(value);
}

function trimmedString(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min, `Mesti sekurang-kurangnya ${min} aksara`)
    .max(max, `Mesti tidak melebihi ${max} aksara`)
    .refine(noControlChars, "Mengandungi aksara tidak sah");
}

/** ISO 8601 datetime string that `Date.parse` can actually interpret. */
const isoDateTimeSchema = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), "Tarikh/masa ISO 8601 tidak sah");

/**
 * Restricts a URL to `https:` on one of the given hosts (or a subdomain of
 * one). These render as links a guest taps — an admin pasting (or being
 * tricked into pasting) a `javascript:` URL, or any other scheme/host,
 * must be rejected outright.
 */
function httpsUrlOnHosts(allowedHosts: readonly string[]) {
  return z
    .string()
    .trim()
    .min(1)
    .superRefine((value, ctx) => {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "url_invalid" });
        return;
      }

      if (url.protocol !== "https:") {
        ctx.addIssue({ code: "custom", message: "url_must_be_https" });
        return;
      }

      const host = url.hostname.toLowerCase();
      const allowed = allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
      if (!allowed) {
        ctx.addIssue({ code: "custom", message: "url_host_not_allowed" });
      }
    });
}

const phoneSchema = z
  .string()
  .trim()
  .transform((val, ctx) => {
    const normalized = normalizeMalaysianPhone(val);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "phone_invalid" });
      return z.NEVER;
    }
    return normalized;
  });

const groomBrideSchema = z.object({
  shortName: trimmedString(1, 60),
  fullName: trimmedString(1, 150),
});

const hostsSchema = z.object({
  line: trimmedString(1, 300),
  names: trimmedString(1, 500),
});

const venueSchema = z.object({
  name: trimmedString(1, 150),
  addressLines: z.array(trimmedString(1, 150)).min(1).max(MAX_ADDRESS_LINES),
  lat: z.number().min(-90, "Latitud mesti antara -90 dan 90").max(90, "Latitud mesti antara -90 dan 90"),
  lng: z
    .number()
    .min(-180, "Longitud mesti antara -180 dan 180")
    .max(180, "Longitud mesti antara -180 dan 180"),
  googleMapsUrl: httpsUrlOnHosts(["google.com", "goo.gl", "maps.app.goo.gl"]),
  wazeUrl: httpsUrlOnHosts(["waze.com"]),
});

const aturCaraItemSchema = z.object({
  time: trimmedString(1, 40),
  label: trimmedString(1, 120),
});

const contactSchema = z.object({
  name: trimmedString(1, 80),
  role: trimmedString(1, 80),
  phone: phoneSchema,
});

const MAX_NOTIFICATION_RECIPIENTS = 2;

/**
 * A sane, deliberately not-RFC-5322-exhaustive email check: this only
 * gates what an admin can type into the recipients fields, and Mailjet
 * itself is the real authority on deliverability (an address that passes
 * this but doesn't exist just bounces silently from Mailjet's side, same
 * as any other typo). `z.string().email()` is intentionally avoided here —
 * across zod versions its regex has shifted; a small explicit pattern is
 * easier to reason about and test.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const notificationEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(254)
  .refine((v) => EMAIL_RE.test(v), "email_invalid");

/**
 * Notification recipients/toggles (`src/lib/notify.ts`,
 * `src/lib/mailjet.ts`). Deliberately separate from the Mailjet
 * credentials themselves (`MAILJET_API_KEY`/`MAILJET_API_SECRET`/
 * `MAILJET_SENDER_EMAIL`/`MAILJET_SENDER_NAME`), which are Cloudflare
 * secrets, never stored here — see the module comment above and
 * `src/lib/request.ts`'s `SecretName` union.
 *
 * `recipients` is capped at `MAX_NOTIFICATION_RECIPIENTS` (2) and a THIRD
 * entry is rejected outright (`.max()`), never silently truncated — an
 * admin who thinks they configured 3 recipients must find out immediately,
 * not discover months later that the third never got emailed.
 */
const notificationsSchema = z.object({
  enabled: z.boolean(),
  recipients: z.array(notificationEmailSchema).max(MAX_NOTIFICATION_RECIPIENTS),
});

export type NotificationsConfig = z.infer<typeof notificationsSchema>;

export const DEFAULT_NOTIFICATIONS: NotificationsConfig = {
  enabled: false,
  recipients: [],
};

export const SECTION_KEYS = [
  "undangan",
  "lokasi",
  "aturCara",
  "countdown",
  "galeri",
  "ucapan",
  "kehadiran",
] as const;

export const NAV_KEYS = ["navKalendar", "navLokasi", "navHubungi", "navRsvp"] as const;

/**
 * Fine-grained toggles nested under an already-visible section, rather than
 * a whole section on/off:
 *  - `kalendarGrid` — the static month grid inside the Kalendar sheet
 *    (`KalendarSheet`/`CalendarMonthGrid`). Defaults `true`; turning it off
 *    leaves the date line and the add-to-calendar buttons untouched.
 *  - `petaEmbed` — the embedded Google Maps iframe in Lokasi/LokasiSheet.
 *    Defaults `true` at the couple's explicit request: a map guests can see
 *    without leaving the card is worth more to them than the privacy cost.
 *    That cost is real and unchanged — loading the iframe sends every
 *    guest's IP address to Google (see `SECURITY.md`) — so this is a
 *    decision recorded, not a default that drifted. Turn it off to fall
 *    back to the address plus the Maps/Waze buttons.
 */
export const EXTRA_TOGGLE_KEYS = ["kalendarGrid", "petaEmbed"] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];
export type NavKey = (typeof NAV_KEYS)[number];
export type ExtraToggleKey = (typeof EXTRA_TOGGLE_KEYS)[number];

export type SectionsConfig = Record<SectionKey, boolean> &
  Record<NavKey, boolean> &
  Record<ExtraToggleKey, boolean>;

export const DEFAULT_SECTIONS: SectionsConfig = {
  undangan: true,
  lokasi: true,
  aturCara: true,
  countdown: true,
  galeri: true,
  ucapan: true,
  kehadiran: true,
  navKalendar: true,
  navLokasi: true,
  navHubungi: true,
  navRsvp: true,
  kalendarGrid: true,
  petaEmbed: true,
};

const sectionsSchema = z
  .object({
    undangan: z.boolean(),
    lokasi: z.boolean(),
    aturCara: z.boolean(),
    countdown: z.boolean(),
    galeri: z.boolean(),
    ucapan: z.boolean(),
    kehadiran: z.boolean(),
    navKalendar: z.boolean(),
    navLokasi: z.boolean(),
    navHubungi: z.boolean(),
    navRsvp: z.boolean(),
    kalendarGrid: z.boolean(),
    petaEmbed: z.boolean(),
  })
  .partial();

// `SCRIPT_FONT_KEYS`/`ScriptFontKey` live in `./script-font.ts` (no
// `server-only`), not here, so the admin's client-side font dropdown can
// import them without pulling in this whole (server-only) module — see
// that file's doc comment. Re-exported here so every OTHER (server-side)
// consumer can still just import them from `wedding-config.ts`.
export { SCRIPT_FONT_KEYS };
export type { ScriptFontKey };

/**
 * The document stored (validated, but PARTIAL — only fields an admin has
 * actually edited) in the `wedding_config` `site_settings` row. Every
 * top-level field is optional so any single admin-panel tab can save just
 * its own slice without needing to resend the rest.
 */
export const weddingConfigDocSchema = z.object({
  eventType: trimmedString(1, 60).optional(),
  groom: groomBrideSchema.optional(),
  bride: groomBrideSchema.optional(),
  hosts: hostsSchema.optional(),
  salam: trimmedString(1, 300).optional(),
  invitationBody: z.array(trimmedString(1, 500)).max(MAX_INVITATION_PARAGRAPHS).optional(),
  honorifics: trimmedString(1, 200).optional(),
  date: isoDateTimeSchema.optional(),
  dayNameMs: trimmedString(1, 20).optional(),
  displayDate: trimmedString(1, 60).optional(),
  endTime: isoDateTimeSchema.optional(),
  venue: venueSchema.optional(),
  aturCara: z.array(aturCaraItemSchema).max(MAX_ATUR_CARA).optional(),
  rsvpDeadline: isoDateTimeSchema.optional(),
  rsvpDeadlineDisplay: trimmedString(1, 60).optional(),
  contacts: z.array(contactSchema).max(MAX_CONTACTS).optional(),
  rsvpPaxMode: z.enum(["adultsChildren", "total", "none"]).optional(),
  hashtag: trimmedString(1, 60).optional(),
  doa: trimmedString(1, 1000).optional(),
  sections: sectionsSchema.optional(),
  notifications: notificationsSchema.optional(),
  scriptFont: z.enum(SCRIPT_FONT_KEYS).optional(),
});

export type WeddingConfigDoc = z.infer<typeof weddingConfigDocSchema>;

export type ResolvedWeddingConfig = WeddingConfig & {
  sections: SectionsConfig;
  notifications: NotificationsConfig;
};

/** Turns a Zod error into `{ fieldPath: firstMessage }`, for per-field admin UI errors. */
export /**
 * Field errors are emitted as STABLE MACHINE CODES, not prose. The admin
 * dashboard is bilingual (see src/lib/i18n), so a Malay string baked in
 * here could never be shown in English — and Zod's own default messages
 * ("Invalid input: expected string, received undefined") are raw internals
 * that are unhelpful in either language. The client maps each code to a
 * localized string via `localizeFieldError`, falling back to a generic
 * "invalid value" message for any code it does not recognise.
 */
function flattenWeddingConfigErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

function defaultResolvedConfig(): ResolvedWeddingConfig {
  return {
    ...wedding,
    sections: { ...DEFAULT_SECTIONS },
    notifications: { ...DEFAULT_NOTIFICATIONS },
  };
}

/**
 * Deep-merges a validated partial doc over a full resolved config.
 * Top-level fields replace wholesale when present (an admin form always
 * submits a whole sub-object, e.g. the full `venue`, never a fragment of
 * one) — except `sections`, which merges key-by-key so toggling one
 * section never clobbers another tab's saved toggles.
 */
export function mergeWeddingConfig(
  base: ResolvedWeddingConfig,
  partial: WeddingConfigDoc,
): ResolvedWeddingConfig {
  return {
    ...base,
    ...(partial.eventType !== undefined && { eventType: partial.eventType }),
    ...(partial.groom !== undefined && { groom: partial.groom }),
    ...(partial.bride !== undefined && { bride: partial.bride }),
    ...(partial.hosts !== undefined && { hosts: partial.hosts }),
    ...(partial.salam !== undefined && { salam: partial.salam }),
    ...(partial.invitationBody !== undefined && { invitationBody: partial.invitationBody }),
    ...(partial.honorifics !== undefined && { honorifics: partial.honorifics }),
    ...(partial.date !== undefined && { date: partial.date }),
    ...(partial.dayNameMs !== undefined && { dayNameMs: partial.dayNameMs }),
    ...(partial.displayDate !== undefined && { displayDate: partial.displayDate }),
    ...(partial.endTime !== undefined && { endTime: partial.endTime }),
    ...(partial.venue !== undefined && { venue: partial.venue }),
    ...(partial.aturCara !== undefined && { aturCara: partial.aturCara }),
    ...(partial.rsvpDeadline !== undefined && { rsvpDeadline: partial.rsvpDeadline }),
    ...(partial.rsvpDeadlineDisplay !== undefined && {
      rsvpDeadlineDisplay: partial.rsvpDeadlineDisplay,
    }),
    ...(partial.contacts !== undefined && { contacts: partial.contacts }),
    ...(partial.hashtag !== undefined && { hashtag: partial.hashtag }),
    ...(partial.doa !== undefined && { doa: partial.doa }),
    // Pre-existing gap found while adding `scriptFont` here: `rsvpPaxMode`
    // was validated by the schema but never actually merged into the
    // resolved config, so an admin's saved pax-mode choice never took
    // effect on the public card. Fixed alongside this change.
    ...(partial.rsvpPaxMode !== undefined && { rsvpPaxMode: partial.rsvpPaxMode }),
    ...(partial.scriptFont !== undefined && { scriptFont: partial.scriptFont }),
    sections: { ...base.sections, ...partial.sections },
    ...(partial.notifications !== undefined && { notifications: partial.notifications }),
  };
}

/**
 * Merges two PARTIAL docs (used when persisting: the newly-submitted slice
 * merges over whatever was already stored, so saving the "Lokasi" tab never
 * discards a previously-saved "Hubungi" edit). Same field-replaces-wholesale
 * rule as `mergeWeddingConfig`, `sections` merged key-by-key.
 */
export function mergeWeddingConfigDocs(
  existing: WeddingConfigDoc,
  incoming: WeddingConfigDoc,
): WeddingConfigDoc {
  const merged: WeddingConfigDoc = { ...existing, ...incoming };
  if (existing.sections || incoming.sections) {
    merged.sections = { ...existing.sections, ...incoming.sections };
  }
  return merged;
}

/**
 * Pure resolution step: parses+validates a raw stored JSON string (or
 * `null`/`undefined` when no row exists) and merges it over `fileDefaults`.
 * Split out from `getWeddingConfig` so it's unit-testable without touching
 * D1/Cloudflare bindings — see `src/lib/wedding-config.test.ts`.
 *
 * NEVER throws: malformed JSON or a doc that fails validation both log
 * server-side and fall back to `fileDefaults` unchanged.
 */
export function resolveWeddingConfigFromRaw(
  raw: string | null | undefined,
  fileDefaults: ResolvedWeddingConfig = defaultResolvedConfig(),
): ResolvedWeddingConfig {
  if (!raw) return fileDefaults;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    console.error("resolveWeddingConfigFromRaw: stored wedding_config is not valid JSON", error);
    return fileDefaults;
  }

  const parsed = weddingConfigDocSchema.safeParse(json);
  if (!parsed.success) {
    console.error(
      "resolveWeddingConfigFromRaw: stored wedding_config failed validation",
      parsed.error.flatten(),
    );
    return fileDefaults;
  }

  return mergeWeddingConfig(fileDefaults, parsed.data);
}

/**
 * Resolves the wedding config guests actually see: the file defaults
 * (`src/config/wedding.ts`) with any admin-saved override merged on top.
 *
 * MUST NEVER THROW and must never make the public card unrenderable — every
 * failure mode (no D1 binding, D1 unreachable, missing row, malformed JSON,
 * a doc that fails schema validation) degrades to the file defaults.
 */
export async function getWeddingConfig(): Promise<ResolvedWeddingConfig> {
  const fileDefaults = defaultResolvedConfig();
  try {
    const db = getDb();
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, WEDDING_CONFIG_KEY))
      .limit(1);

    return resolveWeddingConfigFromRaw(row?.value, fileDefaults);
  } catch (error) {
    // No D1 binding is available during `next build`'s static generation
    // pass (e.g. prerendering /_not-found). That is expected, and the file
    // defaults are exactly the right answer — so log it as a one-line
    // notice rather than dumping a stack trace that looks like a crash in
    // the build output. A build log full of scary-but-fine stack traces
    // trains everyone to stop reading build logs.
    if (isMissingBindingError(error)) {
      console.info(
        "getWeddingConfig: no D1 binding (build-time render); using file defaults",
      );
    } else {
      console.error("getWeddingConfig failed, falling back to file defaults", error);
    }
    return fileDefaults;
  }
}

/**
 * True when the failure is "there is no Cloudflare binding here", which is
 * the normal situation during build-time static generation, as opposed to a
 * genuine runtime database fault that deserves a full stack trace.
 */
function isMissingBindingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("getCloudflareContext") ||
    message.includes("Cannot read properties of undefined") ||
    message.includes("no binding") ||
    message.includes("DB is not defined") ||
    message.includes("open-next")
  );
}

export type SaveWeddingConfigResult =
  | { ok: true }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Validates `input` (an arbitrary, caller-supplied JSON value — e.g. a
 * parsed request body) and, on success, merges it over whatever partial doc
 * is already stored and persists the result.
 *
 * Validation failures are reported as `{ ok: false, fieldErrors }` rather
 * than thrown, so the API route can render per-field Malay error messages.
 * A DB failure while reading/writing is logged and reported the same way
 * with an empty `fieldErrors` (the route falls back to a generic error
 * message) — it never throws into the caller.
 */
export async function saveWeddingConfig(
  input: unknown,
  adminUserId: string,
): Promise<SaveWeddingConfigResult> {
  const parsed = weddingConfigDocSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenWeddingConfigErrors(parsed.error) };
  }

  try {
    const db = getDb();
    const [existingRow] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, WEDDING_CONFIG_KEY))
      .limit(1);

    let existingDoc: WeddingConfigDoc = {};
    if (existingRow?.value) {
      try {
        const existingParsed = weddingConfigDocSchema.safeParse(JSON.parse(existingRow.value));
        if (existingParsed.success) existingDoc = existingParsed.data;
      } catch (error) {
        console.error("saveWeddingConfig: existing row is not valid JSON, discarding it", error);
      }
    }

    const merged = mergeWeddingConfigDocs(existingDoc, parsed.data);
    const now = new Date();

    await db
      .insert(siteSettings)
      .values({
        key: WEDDING_CONFIG_KEY,
        value: JSON.stringify(merged),
        updatedAt: now,
        updatedBy: adminUserId,
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: JSON.stringify(merged), updatedAt: now, updatedBy: adminUserId },
      });

    return { ok: true };
  } catch (error) {
    console.error("saveWeddingConfig: DB write failed", error);
    return { ok: false, fieldErrors: {} };
  }
}

/**
 * "Kembalikan ke asal" — deletes the `wedding_config` row entirely, so the
 * public card (and the settings page) fall back to the file defaults. Never
 * throws; returns whether the delete actually ran.
 */
export async function resetWeddingConfig(): Promise<boolean> {
  try {
    const db = getDb();
    await db.delete(siteSettings).where(eq(siteSettings.key, WEDDING_CONFIG_KEY));
    return true;
  } catch (error) {
    console.error("resetWeddingConfig failed", error);
    return false;
  }
}

/** The raw stored partial doc, for pre-filling the admin settings form. `{}` on any failure. */
export async function getStoredWeddingConfigDoc(): Promise<WeddingConfigDoc> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, WEDDING_CONFIG_KEY))
      .limit(1);

    if (!row?.value) return {};

    const parsed = weddingConfigDocSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : {};
  } catch (error) {
    console.error("getStoredWeddingConfigDoc failed, falling back to empty doc", error);
    return {};
  }
}
