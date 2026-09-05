"use client";

import { useAdminAction } from "./useAdminAction";

type WishStatus = "pending" | "approved" | "rejected";

const buttonBase =
  "rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-50";

/**
 * Inline moderation controls for one wish. Pending wishes get
 * Luluskan/Tolak; approved/rejected wishes get Padam (hard delete of the
 * row — the wish is already off the public wall either way once it's not
 * "approved", so there's no soft-delete story here the way there is for
 * RSVPs).
 */
export function WishActions({ id, status }: { id: string; status: WishStatus }) {
  const { run, pending, error } = useAdminAction();

  async function moderate(next: "approved" | "rejected") {
    await run("/api/admin/wishes/moderate", { id, status: next });
  }

  async function remove() {
    if (!window.confirm("Padam ucapan ini? Tindakan ini tidak boleh dibatalkan.")) return;
    await run("/api/admin/wishes/delete", { id });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "pending" ? (
        <>
          <button
            type="button"
            onClick={() => moderate("approved")}
            disabled={pending}
            className={`${buttonBase} bg-goldenrod text-cream hover:bg-brown`}
          >
            Luluskan
          </button>
          <button
            type="button"
            onClick={() => moderate("rejected")}
            disabled={pending}
            className={`${buttonBase} border border-tan/50 bg-cream text-brown-deep hover:bg-tan/20`}
          >
            Tolak
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className={`${buttonBase} border border-red-200 text-red-700 hover:bg-red-50`}
        >
          Padam
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
