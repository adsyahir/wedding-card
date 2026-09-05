"use client";

import { useState } from "react";

import { csrfHeaders } from "@/lib/csrf-client";

/**
 * POSTs to `/api/admin/logout` with the CSRF header read from the
 * `__Host-wc_csrf` cookie (see `src/lib/csrf-client.ts`). The server route
 * additionally requires the request be same-origin (see `requireAdminApi`
 * in `src/lib/auth.ts`) — the header alone is not sufficient, both checks
 * must pass.
 */
export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        headers: csrfHeaders(),
      });
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
