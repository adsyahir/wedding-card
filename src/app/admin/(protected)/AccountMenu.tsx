"use client";

import { useEffect, useRef, useState } from "react";

import { csrfHeaders } from "@/lib/csrf-client";
import type { AdminDict } from "@/lib/i18n/admin-dict";

import { PasswordSettings } from "./_components/PasswordSettings";

/**
 * The account menu: who you are signed in as, and the two things you can do
 * about it — change your password, or leave.
 *
 * Changing a password was a tab in Tetapan, beside the couple's names and
 * the venue. It does not belong there: everything else on that screen edits
 * the invitation card, and this edits the person using it. Sitting next to
 * Log out is where anyone would look for it.
 *
 * The form opens in a dialog rather than navigating: it is three fields and
 * a button, and losing your place in the dashboard to reach them is a worse
 * trade than a modal.
 */
export function AccountMenu({ username, dict }: { username: string; dict: AdminDict }) {
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // `pointerdown`, not `click`: a click listener added during the click
    // that opened the menu fires on that same event and shuts it again.
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => {
    if (!passwordOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPasswordOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [passwordOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST", headers: csrfHeaders() });
    } finally {
      window.location.href = "/admin/login";
    }
  }

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-tan/50 bg-sand/60 px-3 py-2 text-sm font-medium text-brown-deep transition hover:bg-tan/30"
        >
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-goldenrod text-xs font-semibold text-cream"
          >
            {username.slice(0, 1).toUpperCase() || "?"}
          </span>
          <span className="flex-1 truncate text-left">{username || dict.account_menu}</span>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div
            role="menu"
            // Opens UPWARD: this sits at the bottom of the sidebar, where a
            // downward menu would be clipped by the viewport edge.
            className="absolute bottom-full left-0 z-30 mb-1 w-full overflow-hidden rounded-lg border border-tan/40 bg-cream shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setPasswordOpen(true);
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm text-brown-deep transition hover:bg-tan/20"
            >
              <KeyIcon />
              {dict.password_submit}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full cursor-pointer items-center gap-2 border-t border-tan/30 px-3 py-2.5 text-left text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            >
              <ExitIcon />
              {loggingOut ? dict.logout_pending : dict.logout_action}
            </button>
          </div>
        )}
      </div>

      {passwordOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dict.password_heading}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-brown-deep/50 backdrop-blur-[2px]"
            onClick={() => setPasswordOpen(false)}
            aria-hidden="true"
          />
          <div className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl border border-tan/40 bg-cream p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="font-serif text-lg text-brown-deep">{dict.password_heading}</h2>
              <button
                type="button"
                onClick={() => setPasswordOpen(false)}
                aria-label={dict.common_cancel}
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-brown-deep transition hover:bg-tan/20"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <PasswordSettings username={username} dict={dict} />
          </div>
        </div>
      )}
    </>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M14 8a4 4 0 1 1-3.9 5H7v2H5v2H2v-3l7.1-7.1A4 4 0 0 1 14 8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 16l4-4-4-4M20 12H10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
