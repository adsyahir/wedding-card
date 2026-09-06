"use client";

import { useState } from "react";

import { TrashIcon } from "./TrashIcon";
import { ConfirmDialog } from "./ConfirmDialog";
import type { AdminDict } from "@/lib/i18n/admin-dict";

import { useAdminAction } from "./useAdminAction";

type WishStatus = "pending" | "approved" | "rejected";

const buttonBase =
  "rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-50";

/**
 * Inline moderation controls for one wish.
 *
 * MODERATION IS REVERSIBLE IN BOTH DIRECTIONS. A rejected wish can still
 * be approved later, and an approved one can be pulled back off the wall.
 * Only Padam is final — it hard-deletes the row (unlike RSVPs, which are
 * soft-deleted, a wish that is not "approved" is already invisible
 * publicly, so there is nothing a soft delete would buy).
 *
 * The buttons used to be one-way: reject a wish and Padam was the only
 * thing left. That made a misread name or a moment's impatience
 * unrecoverable, and it pushed whoever was moderating towards deleting
 * things they were merely unsure about. The API already allowed either
 * transition at any time — this was only ever a gap in the UI.
 */
export function WishActions({
  id,
  status,
  dict,
}: {
  id: string;
  status: WishStatus;
  dict: AdminDict;
}) {
  const { run, pending, error } = useAdminAction(dict);

  async function moderate(next: "approved" | "rejected") {
    await run("/api/admin/wishes/moderate", { id, status: next });
  }

  const [confirmOpen, setConfirmOpen] = useState(false);

  async function remove() {
    await run("/api/admin/wishes/delete", { id });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "approved" && (
        <button
          type="button"
          onClick={() => moderate("approved")}
          disabled={pending}
          className={`${buttonBase} cursor-pointer bg-goldenrod text-cream hover:bg-brown`}
        >
          {dict.wishActions_approve}
        </button>
      )}

      {status !== "rejected" && (
        <button
          type="button"
          onClick={() => moderate("rejected")}
          disabled={pending}
          className={`${buttonBase} cursor-pointer border border-tan/50 bg-cream text-brown-deep hover:bg-tan/20`}
        >
          {dict.wishActions_reject}
        </button>
      )}

      {/* Padam is offered only once the wish has been moderated — from the
          pending queue the two safe verdicts should be the whole choice,
          so nobody clears the queue by deleting through it. */}
      {status !== "pending" && (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={pending}
          className={`${buttonBase} inline-flex cursor-pointer items-center gap-1 border border-red-200 text-red-700 hover:bg-red-50`}
        >
          <TrashIcon />
          {dict.wishActions_delete}
        </button>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={dict.confirm_deleteTitle}
        body={dict.wishActions_confirmDelete}
        confirmLabel={dict.common_delete}
        dict={dict}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void remove();
        }}
      />
    </div>
  );
}
