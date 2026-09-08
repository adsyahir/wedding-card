"use client";

import { useState } from "react";

import type { AdminDict } from "@/lib/i18n/admin-dict";
import { localizeApiError } from "@/app/admin/(protected)/_components/api-error";

/**
 * Client component: a plain controlled form that POSTs to
 * `/api/admin/login` and shows one generic error message on failure.
 *
 * On success, the server has already set the `__Host-wc_csrf` cookie (see
 * `src/lib/session.ts` / `src/lib/csrf-client.ts`) — that cookie, not
 * anything stashed here, is what later admin mutations read the CSRF token
 * from. Using a cookie instead of `sessionStorage` is what makes the token
 * available in any tab, not just the one that was open at login.
 */
export function LoginForm({ dict }: { dict: AdminDict }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember }),
      });

      const data = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error: string; code?: string }
        | null;

      if (response.ok && data?.ok) {
        window.location.href = "/admin";
        return;
      }

      setError(localizeApiError(dict, data && !data.ok ? data : null));
    } catch {
      setError(dict.common_networkError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm text-brown-deep">
          {dict.login_usernameLabel}
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          maxLength={64}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-tan/50 bg-cream px-3 py-2 text-brown-deep outline-none focus-visible:border-goldenrod"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-brown-deep">
          {dict.login_passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-tan/50 bg-cream px-3 py-2 text-brown-deep outline-none focus-visible:border-goldenrod"
        />
      </div>

      {/*
        Opt-in, never pre-ticked. It buys a 30-day session instead of a
        12-hour one, which is a real trade — worth making deliberately on a
        family phone, not by default on a shared machine. Logging out still
        revokes it server-side, so it can always be undone.
      */}
      <label
        htmlFor="remember"
        className="flex cursor-pointer items-center gap-2 text-sm text-brown-deep select-none"
      >
        <input
          id="remember"
          name="remember"
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-goldenrod"
        />
        {dict.login_remember}
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-700 -mt-1">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-lg bg-goldenrod px-4 py-2 font-medium text-cream transition hover:bg-brown disabled:opacity-60"
      >
        {submitting ? dict.login_submitting : dict.login_submit}
      </button>
    </form>
  );
}
