// open-next.config.ts
// Configuration for @opennextjs/cloudflare — see https://opennext.js.org/cloudflare
//
// Deviation from the tool's "getting started" default: we intentionally do NOT wire
// up the R2-backed incremental cache override here. That default requires a second,
// dedicated R2 bucket purely for ISR/data-cache entries, which is out of scope for
// Phase 0/1 (we only provision the `ASSETS_BUCKET` R2 bucket for uploaded media).
// Omitting `incrementalCache` falls back to the tool's in-memory ("dummy") cache,
// which is sufficient for a mostly-static invitation site. Revisit if a later phase
// needs real cross-request ISR persistence.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
