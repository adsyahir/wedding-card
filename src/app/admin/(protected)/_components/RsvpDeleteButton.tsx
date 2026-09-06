"use client";

import { useState } from "react";

import type { AdminDict } from "@/lib/i18n/admin-dict";

import { ConfirmDialog } from "./ConfirmDialog";
import { TrashIcon } from "./TrashIcon";
import { useAdminAction } from "./useAdminAction";

/**
 * Soft-deletes one RSVP row, behind a confirmation modal — never a
 * single-click delete for guest PII.
 *
 * This used to be a "Padam" text link that swapped itself for an inline
 * "Sahkan padam? / Batal" pair. Two problems with that: the confirmation
 * appeared in a table cell a few pixels from where the cursor already was,
 * which is barely a second decision at all, and it named nothing — in a
 * table of near-identical rows you could confirm against the wrong one
 * without ever seeing which. The modal names the guest.
 */
export function RsvpDeleteButton({
  id,
  name,
  dict,
}: {
  id: string;
  name: string;
  dict: AdminDict;
}) {
  const { run, pending, error } = useAdminAction(dict);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConfirm() {
    setConfirmOpen(false);
    await run("/api/admin/rsvp/delete", { id });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
        aria-label={`${dict.rsvp_deleteAction} — ${name}`}
        title={dict.rsvp_deleteAction}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
      >
        <TrashIcon />
        <span className="sr-only sm:not-sr-only">{dict.rsvp_deleteAction}</span>
      </button>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={dict.rsvp_deleteTitle}
        body={dict.rsvp_confirmDelete.replace("{name}", name)}
        confirmLabel={dict.common_delete}
        dict={dict}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
