/**
 * Extends the generated `CloudflareEnv` (`cloudflare-env.d.ts`, regenerated
 * by `npm run cf-typegen`) with secrets/vars that are NOT Cloudflare
 * bindings (D1/R2/Fetcher) and therefore never appear in that generated
 * file. Declared here as a plain ambient global `interface` so TypeScript
 * merges it with the generated one — this file is safe from being clobbered
 * by a future `cf-typegen` run.
 *
 * Set the real value with `wrangler secret put ANALYTICS_SALT` in
 * production; for local dev, see `.dev.vars` (gitignored) / `.dev.vars.example`.
 */
interface CloudflareEnv {
  /** HMAC secret used by `visitorHash()` (src/lib/crypto.ts). */
  ANALYTICS_SALT: string;
  /**
   * Mailjet API key/secret pair (see `src/lib/mailjet.ts`) and the
   * validated sender identity Mailjet requires on every `From:`. All four
   * are deployment secrets, never admin-editable and never stored in the
   * database — see the "Recipients ... stored differently" note in
   * `src/lib/wedding-config.ts` and the README's Mailjet setup section.
   */
  MAILJET_API_KEY: string;
  MAILJET_API_SECRET: string;
  MAILJET_SENDER_EMAIL: string;
  MAILJET_SENDER_NAME: string;
}
