"use client";

import { RsvpForm } from "./RsvpForm";

/**
 * The RSVP bottom sheet. Single-purpose (kehadiran only) — the ucapan form
 * lives inline in the Ucapan section on the page itself
 * (`src/components/invite/UcapanWall.tsx`), not here. It used to be a
 * second tab in this sheet; see git history if that ever needs revisiting.
 */
export function RsvpSheet({
  onRsvpSuccess,
}: {
  onRsvpSuccess?: (result: { attending: boolean; adults: number; children: number }) => void;
}) {
  return <RsvpForm onSuccess={onRsvpSuccess} />;
}
