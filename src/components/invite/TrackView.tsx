"use client";

import { useEffect, useRef } from "react";

import { trackView } from "@/lib/track";

/**
 * Fires exactly one `{ type: "view" }` analytics beacon when the invite
 * mounts, then renders nothing.
 *
 * The `firedRef` guard is required because of React 18/19 Strict Mode:
 * in development, Strict Mode intentionally mounts every component twice
 * (mount -> unmount -> mount) to surface effect cleanup bugs. Without the
 * ref, a dev-mode page load would double-count every view. The ref
 * survives that unmount/remount cycle (refs aren't reset by Strict Mode's
 * replay, only state is), so the second mount sees `firedRef.current ===
 * true` and skips sending a second beacon.
 */
export function TrackView() {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    trackView(window.location.pathname, document.referrer);
  }, []);

  return null;
}
