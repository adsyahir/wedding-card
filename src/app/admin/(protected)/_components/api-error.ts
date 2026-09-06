import type { AdminDict } from "@/lib/i18n/admin-dict";

/**
 * Maps a server `code` (see `ADMIN_ERROR_CODES` in `src/lib/api.ts`, and the
 * handful of route-specific ad-hoc codes like `"gallery_full"`) to the
 * matching localized dictionary key. Every admin mutation route now
 * returns one of these alongside its (Malay) `error` string — this is what
 * lets an English-reading admin see an English toast instead of the
 * server's Malay message.
 *
 * Deliberately its own module (no `"use client"`, no framework imports):
 * `useAdminAction.ts` needs `next/navigation`'s `useRouter`, which doesn't
 * play well with plain Vitest (no React renderer configured) — keeping
 * this pure function separate lets it be unit-tested directly, and lets
 * non-hook consumers (`WeddingConfigSettings`, `GallerySettings`,
 * `MusicSettings`, `LoginForm`, all of which manage their own fetch calls
 * outside `useAdminAction`) import it without pulling in `next/navigation`.
 */
const CODE_TO_DICT_KEY: Record<string, keyof AdminDict> = {
  not_found: "errors_notFound",
  invalid_input: "errors_invalidInput",
  invalid_request: "errors_invalidRequest",
  server_error: "errors_serverError",
  unsupported_media_type: "errors_unsupportedMediaType",
  payload_too_large: "errors_payloadTooLarge",
  too_many_requests: "errors_tooManyRequests",
  gallery_full: "errors_galleryFull",
  invalid_reorder: "errors_invalidReorder",
  active_track_conflict: "errors_activeTrackConflict",
  invalid_credentials: "errors_invalidCredentials",
  unauthorized: "errors_unauthorized",
  forbidden: "errors_forbidden",
};

/**
 * Resolves a failed API response to a localized message: known `code` →
 * the matching dictionary string; unknown/missing `code` → the server's
 * own `error` string verbatim (never blank); no data at all → the generic
 * "unexpected error" string.
 */
export function localizeApiError(
  dict: AdminDict,
  data: { error: string; code?: string } | null,
): string {
  if (data?.code) {
    const key = CODE_TO_DICT_KEY[data.code];
    if (key) return dict[key];
  }
  return (data && data.error) || dict.common_unexpectedError;
}

/**
 * Per-field validation codes emitted by the wedding-config schema (see
 * `src/lib/wedding-config.ts`). Zod's own default messages are raw
 * internals ("Invalid input: expected string, received undefined") that
 * help nobody in either language, so anything not in this table collapses
 * to a single generic "invalid value" string.
 */
const FIELD_CODE_TO_DICT_KEY: Record<string, keyof AdminDict> = {
  url_invalid: "fieldErr_urlInvalid",
  url_must_be_https: "fieldErr_urlMustBeHttps",
  url_host_not_allowed: "fieldErr_urlHostNotAllowed",
  phone_invalid: "fieldErr_phoneInvalid",
};

/** Localizes one field-level validation code. */
export function localizeFieldError(dict: AdminDict, code: string | undefined): string | undefined {
  if (!code) return undefined;
  const key = FIELD_CODE_TO_DICT_KEY[code];
  return key ? dict[key] : dict.fieldErr_generic;
}

/** Localizes a whole `fieldErrors` record in one pass. */
export function localizeFieldErrors(
  dict: AdminDict,
  fieldErrors: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, code] of Object.entries(fieldErrors)) {
    const localized = localizeFieldError(dict, code);
    if (localized) out[field] = localized;
  }
  return out;
}
