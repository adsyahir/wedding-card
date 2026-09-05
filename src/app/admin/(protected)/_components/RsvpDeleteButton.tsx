"use client";

import { useState } from "react";

import { useAdminAction } from "./useAdminAction";

/**
 * Soft-deletes one RSVP row, behind an explicit confirmation step (never a
 * single-click delete for guest PII) — clicking "Padam" reveals a
 * "Sahkan?" / "Batal" pair rather than acting immediately.
 */
export function RsvpDeleteButton({ id }: { id: string }) {
  const { run, pending, error } = useAdminAction();
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    const ok = await run("/api/admin/rsvp/delete", { id });
    if (ok) setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="font-semibold text-red-700 underline disabled:opacity-50"
          >
            Sahkan padam?
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="text-brown/60 underline disabled:opacity-50"
          >
            Batal
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs text-brown/60 underline hover:text-red-700"
    >
      Padam
    </button>
  );
}
