import type { AnalyticsEventName } from "./analytics-events";

/**
 * Sends a JSON payload to `/api/track` without ever blocking or throwing
 * into the caller — analytics must never break an interaction it's merely
 * observing. Prefers `navigator.sendBeacon` (fire-and-forget, survives page
 * unload, which matters for e.g. a Waze/Maps link click that navigates
 * away immediately); falls back to `fetch(..., { keepalive: true })` when
 * `sendBeacon` isn't available.
 */
function sendTrackBeacon(payload: string): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon("/api/track", blob);
      if (sent) return;
    }

    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget — a dropped beacon is never surfaced to the guest.
    });
  } catch {
    // Never throw — analytics must not break the invitation.
  }
}

/**
 * Fire-and-forget client helper for tracking one of the closed set of
 * `AnalyticsEventName`s (see `src/lib/analytics-events.ts`). Never awaited
 * by UI code, never throws, and never blocks the interaction it's attached
 * to.
 */
export function trackEvent(name: AnalyticsEventName): void {
  try {
    sendTrackBeacon(JSON.stringify({ type: "event", name }));
  } catch {
    // Never throw — analytics must not break the invitation.
  }
}

/**
 * Fire-and-forget client helper for the one-per-mount page view beacon.
 * Used by `src/components/invite/TrackView.tsx`.
 */
export function trackView(path: string, referrer: string): void {
  try {
    sendTrackBeacon(JSON.stringify({ type: "view", path, referrer: referrer || undefined }));
  } catch {
    // Never throw — analytics must not break the invitation.
  }
}
