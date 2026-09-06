"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { csrfHeaders } from "@/lib/csrf-client";
import type { AdminDict } from "@/lib/i18n/admin-dict";

import { localizeApiError } from "./api-error";

export { localizeApiError } from "./api-error";

type ApiResponse = { ok: true } | { ok: false; error: string; code?: string };

/**
 * Shared client-side helper for admin mutation buttons (approve/reject a
 * wish, soft-delete an RSVP, ...): POSTs JSON with the CSRF header attached,
 * and calls `router.refresh()` on success so the server component that
 * rendered the list re-fetches fresh data — the page itself stays a plain
 * server component; only the button is a client island.
 *
 * `dict` is the resolved admin dictionary, passed down as a plain prop from
 * a server component ancestor (never fetched here) — see
 * `src/lib/i18n/admin.ts`. Failures are localized via `localizeApiError`
 * (`./api-error.ts`), which maps the server's `code` to a dictionary
 * string, falling back to the server's own `error` text.
 */
export function useAdminAction(dict: AdminDict) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(url: string, body: unknown): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(body),
      });

      const data = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok || !data?.ok) {
        setError(localizeApiError(dict, data && !data.ok ? data : null));
        return false;
      }

      router.refresh();
      return true;
    } catch {
      setError(dict.common_networkError);
      return false;
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error };
}
