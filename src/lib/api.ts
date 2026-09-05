import "server-only";

/**
 * Shared response/request helpers for the public API route handlers
 * (`src/app/api/rsvp`, `src/app/api/wishes`).
 *
 * The contract these routes speak (see `src/components/invite/submitPublicForm.ts`):
 *   200 { ok: true }  |  4xx/5xx { ok: false, error: string }
 *
 * `error` is always one of the small set of generic, Malay-safe strings
 * below — NEVER an interpolated exception message, a Zod issue path, or any
 * other internal detail. Real errors are logged server-side only via
 * `console.error`.
 */

/** Small, fixed set of user-facing error strings. Never interpolate into these. */
export const API_ERRORS = {
  invalidRequest: "Permintaan tidak sah.",
  invalidInput: "Sila semak semula maklumat yang dimasukkan.",
  tooManyRequests: "Terlalu banyak percubaan. Sila cuba sebentar lagi.",
  serverError: "Maaf, berlaku ralat. Sila cuba sebentar lagi.",
  notFound: "Rekod tidak dijumpai.",
  unsupportedMediaType: "Format fail tidak disokong.",
  payloadTooLarge: "Saiz fail terlalu besar.",
} as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

function jsonResponse(status: number, body: unknown, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(NO_STORE_HEADERS);
  headers.set("Content-Type", "application/json");
  if (extraHeaders) {
    for (const [key, value] of new Headers(extraHeaders)) {
      headers.set(key, value);
    }
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/** `200 { ok: true }`, with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. */
export function jsonOk(): Response {
  return jsonResponse(200, { ok: true });
}

/**
 * `{ ok: false, error }` at the given status, with the same no-store/nosniff
 * headers. Pass `extraHeaders` for things like `Retry-After`.
 */
export function jsonError(status: number, message: string, extraHeaders?: HeadersInit): Response {
  return jsonResponse(status, { ok: false, error: message }, extraHeaders);
}

/**
 * Narrows an arbitrary JSON value down to a plain object for safe property
 * access (`JSON.parse` can return `null`, an array, a string, a number...,
 * none of which are safe to index with `.someField` without this check —
 * indexing into `null`, in particular, throws at runtime).
 */
export function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type ReadJsonBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/**
 * Reads and parses a JSON body off `request`, rejecting anything that
 * doesn't look like a well-formed, bounded JSON POST body. Returns a
 * discriminated union rather than throwing, so callers can't accidentally
 * let a parse error escape as an unhandled 500 with a leaked stack trace.
 *
 * Rejects:
 * - A missing or non-`application/json` `Content-Type`.
 * - A `Content-Length` above `maxBytes` (checked upfront, before reading).
 * - A body whose actual byte size exceeds `maxBytes` even when
 *   `Content-Length` was absent or understated (streamed and capped as it's
 *   read, so an attacker can't bypass the header check).
 * - Malformed JSON.
 */
export async function readJsonBody<T = unknown>(
  request: Request,
  maxBytes = 16 * 1024,
): Promise<ReadJsonBodyResult<T>> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, status: 400, error: API_ERRORS.invalidRequest };
  }

  const contentLengthHeader = request.headers.get("Content-Length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return { ok: false, status: 413, error: API_ERRORS.invalidRequest };
    }
  }

  if (!request.body) {
    return { ok: false, status: 400, error: API_ERRORS.invalidRequest };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, error: API_ERRORS.invalidRequest };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: API_ERRORS.invalidRequest };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);

  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: 400, error: API_ERRORS.invalidRequest };
  }
}
