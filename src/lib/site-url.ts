/**
 * Resolves the site's own public origin, used to build absolute URLs that
 * leave the app: the admin links inside notification emails
 * (`src/lib/notify.ts`) and `metadataBase` for the OpenGraph/WhatsApp share
 * preview (`src/app/layout.tsx`).
 *
 * WHY THIS IS NOT DERIVED FROM THE INCOMING REQUEST, which would be the
 * obvious zero-config answer: `Host` is a client-supplied header. The
 * notification email is triggered by an anonymous public POST to
 * `/api/rsvp`, so anyone able to submit an RSVP could choose the hostname
 * that ends up in the family's inbox under "Lihat senarai RSVP". A link to
 * `attacker.example/admin/rsvp` in a mail the family already trusts is a
 * ready-made credential-phishing page. Cloudflare's routing makes that
 * hard to pull off in practice, but "hard because of how the edge routes"
 * is not a property worth resting a phishing defence on.
 *
 * So the origin is configuration, never input. In order:
 *
 *   1. The `SITE_URL` var, set per environment in `wrangler.jsonc` (and in
 *      `.dev.vars` locally). This is the one to set at deploy time.
 *   2. `wedding.siteUrl` from `src/config/wedding.ts`, the fallback.
 *
 * A malformed or non-http(s) `SITE_URL` is ignored rather than trusted, so
 * a typo degrades to the file default instead of producing dead links.
 */

/** Normalises an origin: valid http(s) URL, no trailing slash, or null. */
export function normalizeSiteUrl(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === "") return null;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  // Plain http is allowed only for local development; anything else must be
  // https, since these URLs are handed to mail clients and crawlers.
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) return null;

  return url.origin;
}

/**
 * Picks the origin from the configured candidates. Pure, so the precedence
 * is testable without a Workers context.
 */
export function resolveSiteUrl(envSiteUrl: string | null | undefined, fileSiteUrl: string): string {
  return normalizeSiteUrl(envSiteUrl) ?? normalizeSiteUrl(fileSiteUrl) ?? "";
}
