import { z } from "zod";

/**
 * The closed set of custom event names the analytics beacon accepts.
 *
 * Deliberately has NO `server-only` import — shared by client components
 * (`src/lib/track.ts`, and everything that calls `trackEvent`) and the
 * server route handler (`src/app/api/track/route.ts`), which validates
 * every inbound `{ type: "event", name }` beacon against
 * `analyticsEventNameSchema` below.
 *
 * This list is CLOSED on purpose: `/api/track` is an unauthenticated public
 * write endpoint, and an arbitrary caller-supplied string must never reach
 * the `events.name` column — that's how a public endpoint becomes a
 * free-text dumping ground (or a vector for someone to probe/pollute the
 * admin analytics dashboard with made-up event names). Add a new event name
 * here — and nowhere else — when a new interaction needs tracking.
 */
export const ANALYTICS_EVENT_NAMES = [
  "envelope_open",
  "music_play",
  "maps_click",
  "waze_click",
  "calendar_add",
  "rsvp_open",
  "rsvp_submit",
  "ucapan_submit",
  "gallery_open",
  "contact_click",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const analyticsEventNameSchema = z.enum(ANALYTICS_EVENT_NAMES);
