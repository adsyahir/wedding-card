"use client";

import { useState } from "react";

/**
 * POSTs to `/api/admin/logout` with the CSRF header the login form stashed
 * in `sessionStorage`. The server route additionally requires the request
 * be same-origin (see `requireAdminApi` in `src/lib/auth.ts`) — the header
 * alone is not sufficient, both checks must pass.
 */
export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      let csrfToken = "";
      try {
        csrfToken = sessionStorage.getItem("wc_csrf") ?? "";
      } catch {
        // sessionStorage unavailable — the request below will 403 and the
        // user is told to log in again, never a silent failure.
      }

      await fetch("/api/admin/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
      });

      try {
        sessionStorage.removeItem("wc_csrf");
      } catch {
        // Best-effort cleanup only.
      }
    } finally {
      window.location.href = "/admin/login";
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-tan/50 bg-sand/60 px-4 py-2 font-medium text-brown-deep transition hover:bg-tan/30 disabled:opacity-60"
    >
      {pending ? "Log keluar…" : "Log Keluar"}
    </button>
  );
}
