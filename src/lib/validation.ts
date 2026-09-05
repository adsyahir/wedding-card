import { z } from "zod";

/**
 * Shared Zod schemas for the public RSVP and wishes forms.
 *
 * Deliberately has NO `server-only` import — these schemas are used both by
 * client components (for inline form validation) and by server route
 * handlers (as the source of truth before touching the database), so they
 * must be safe to bundle into client JavaScript.
 */

export const MAX_NAME_LEN = 80;
export const MIN_NAME_LEN = 2;

export const MAX_RSVP_MESSAGE_LEN = 300;

export const MIN_WISH_MESSAGE_LEN = 3;
export const MAX_WISH_MESSAGE_LEN = 500;

export const MIN_ADULTS = 1;
export const MAX_ADULTS = 10;
export const MIN_CHILDREN = 0;
export const MAX_CHILDREN = 10;

/**
 * Matches ASCII control characters (0x00-0x1F, 0x7F) EXCLUDING `\n` (0x0A).
 * Used to reject pasted-in null bytes, escape sequences, etc. while still
 * allowing multi-line message bodies.
 */
const CONTROL_CHARS_EXCEPT_NEWLINE = /[\x00-\x09\x0B-\x1F\x7F]/;

function hasDisallowedControlChars(value: string): boolean {
  return CONTROL_CHARS_EXCEPT_NEWLINE.test(value);
}

/**
 * Normalizes a Malaysian phone number to E.164 (`+60XXXXXXXXX`).
 *
 * Accepts:
 * - Local format with dashes/spaces: `01x-xxx xxxx`, `011-1234 5678`
 * - International with plus: `+60123456789`
 * - International without plus: `60123456789`
 *
 * Returns `null` if the input cannot be interpreted as a valid Malaysian
 * mobile number.
 */
export function normalizeMalaysianPhone(raw: string): string | null {
  let s = raw.trim().replace(/[\s()-]/g, "");

  if (s.startsWith("+60")) {
    s = `0${s.slice(3)}`;
  } else if (/^60\d+$/.test(s)) {
    s = `0${s.slice(2)}`;
  }

  // A valid Malaysian mobile number, once normalized to start with a single
  // leading 0, is "01" followed by 8-9 more digits (10-11 digits total).
  if (!/^01\d{8,9}$/.test(s)) {
    return null;
  }

  return `+60${s.slice(1)}`;
}

const honeypot = z.string().max(0, "Bot detected").optional().default("");

const nameSchema = z
  .string()
  .trim()
  .min(MIN_NAME_LEN, `Name must be at least ${MIN_NAME_LEN} characters`)
  .max(MAX_NAME_LEN, `Name must be at most ${MAX_NAME_LEN} characters`)
  .refine((v) => !hasDisallowedControlChars(v), "Name contains invalid characters");

const phoneSchema = z
  .string()
  .trim()
  .transform((val, ctx) => {
    const normalized = normalizeMalaysianPhone(val);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Invalid Malaysian phone number" });
      return z.NEVER;
    }
    return normalized;
  });

export const rsvpSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  attending: z.boolean(),
  adults: z.number().int().min(MIN_ADULTS).max(MAX_ADULTS),
  children: z.number().int().min(MIN_CHILDREN).max(MAX_CHILDREN),
  message: z
    .string()
    .trim()
    .max(MAX_RSVP_MESSAGE_LEN, `Message must be at most ${MAX_RSVP_MESSAGE_LEN} characters`)
    .refine((v) => !hasDisallowedControlChars(v), "Message contains invalid characters")
    .optional(),
  // Honeypot field: legitimate clients never fill this in. Must be empty.
  website: honeypot,
});

export type RsvpInput = z.infer<typeof rsvpSchema>;

export const wishSchema = z.object({
  name: nameSchema,
  message: z
    .string()
    .trim()
    .min(MIN_WISH_MESSAGE_LEN, `Message must be at least ${MIN_WISH_MESSAGE_LEN} characters`)
    .max(MAX_WISH_MESSAGE_LEN, `Message must be at most ${MAX_WISH_MESSAGE_LEN} characters`)
    .refine((v) => !hasDisallowedControlChars(v), "Message contains invalid characters"),
  // Honeypot field: legitimate clients never fill this in. Must be empty.
  website: honeypot,
});

export type WishInput = z.infer<typeof wishSchema>;
