"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { AdminDict } from "@/lib/i18n/admin-dict";

/**
 * A styled confirmation dialog, replacing `window.confirm`.
 *
 * `window.confirm` was doing this job, and it was the wrong tool: it is
 * unstyled, ignores the admin's dark theme, announces itself as
 * "localhost:3000 says", and puts the destructive action on the button
 * the browser highlights by default. It is also trivially dismissed by a
 * stray Enter keypress.
 *
 * For the genuinely irreversible actions this also supports a typed
 * confirmation (`requirePhrase`). A second click is not a second decision
 * — the hand is already moving — whereas typing a word forces the person
 * to read what they are about to do.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  dict,
  requirePhrase,
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  dict: AdminDict;
  /** When set, the confirm button stays disabled until this exact word is typed. */
  requirePhrase?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const inputId = useId();

  useEffect(() => {
    if (!open) {
      setTyped("");
      return;
    }
    // Focus lands on Cancel, not Confirm: the safe option should be the one
    // a reflexive Enter or Space hits.
    cancelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const satisfied = !requirePhrase || typed.trim() === requirePhrase;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-brown-deep/50 backdrop-blur-[2px]"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm rounded-xl border border-tan/40 bg-cream p-5 shadow-xl">
        <h2 id={titleId} className="font-serif text-lg text-brown-deep">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-6 text-brown">
          {body}
        </p>

        {requirePhrase && (
          <div className="mt-4">
            <label htmlFor={inputId} className="mb-1 block text-xs text-brown/70">
              {dict.confirm_typeToProceed.replace("{phrase}", requirePhrase)}
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="w-full rounded-md border border-tan/40 bg-sand/40 px-3 py-1.5 text-sm text-brown-deep"
            />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-md border border-tan/40 px-3 py-1.5 text-sm text-brown-deep transition hover:bg-sand/60"
          >
            {dict.common_cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!satisfied}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
              destructive
                ? "bg-red-700 text-white hover:bg-red-800"
                : "bg-goldenrod text-cream hover:bg-brown"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
