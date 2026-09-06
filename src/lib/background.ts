import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Schedules `task` to run via Cloudflare's `ctx.waitUntil()` — the response
 * already in flight is not held up waiting for it, but the Worker isn't
 * torn down until `task` settles either (unlike a bare fire-and-forget
 * call, which Workers can kill mid-flight once the response is sent).
 *
 * Used for the RSVP/ucapan email notifications (`src/lib/notify.ts`):
 * `notifyNewRsvp`/`notifyNewUcapan` already catch every error internally
 * and never reject, so this never needs to handle a rejection from `task`
 * itself — the only failure mode here is `getCloudflareContext()` itself
 * throwing (no Workers context available, e.g. a non-Workers test runner),
 * which is caught and logged so a notification call can never crash the
 * request that triggered it.
 */
export function runInBackground(task: Promise<void>): void {
  try {
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(task);
  } catch (error) {
    console.error("runInBackground: no waitUntil context available, skipping", error);
  }
}
