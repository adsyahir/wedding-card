"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { csrfHeaders } from "@/lib/csrf-client";

type ApiResponse = { ok: true } | { ok: false; error: string };

/**
 * Shared client-side helper for admin mutation buttons (approve/reject a
 * wish, soft-delete an RSVP, ...): POSTs JSON with the CSRF header attached,
 * and calls `router.refresh()` on success so the server component that
 * rendered the list re-fetches fresh data — the page itself stays a plain
 * server component; only the button is a client island.
 */
export function useAdminAction() {
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
        setError((data && !data.ok && data.error) || "Ralat tidak dijangka. Sila cuba lagi.");
        return false;
      }

      router.refresh();
      return true;
    } catch {
      setError("Ralat rangkaian. Sila cuba lagi.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error };
}
