"use client";

import { RsvpForm } from "./RsvpForm";

/**
 * The RSVP bottom sheet: attendance first, then the form.
 *
 * The form also offers an OPTIONAL public ucapan at the end, on both the
 * Hadir and Tidak Hadir paths. That is not a duplicate of the standalone
 * ucapan form in `UcapanWall.tsx` — it is the same wish captured at the
 * moment the guest is already typing, which is when most of them will
 * actually write one. Either route lands as `pending` and needs the same
 * admin approval.
 */
export function RsvpSheet({
  onRsvpSuccess,
  allowUcapan = true,
}: {
  onRsvpSuccess?: (result: { attending: boolean; adults: number; children: number }) => void;
  allowUcapan?: boolean;
}) {
  return <RsvpForm onSuccess={onRsvpSuccess} allowUcapan={allowUcapan} />;
}
