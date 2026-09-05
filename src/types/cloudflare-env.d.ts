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
}
