"use client";

import { useState } from "react";

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
export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ username, password }),
      });

      const data = (await response.json().catch(() => null)) as
        | { ok: true; csrfToken: string }
        | { ok: false; error: string }
        | null;

      if (response.ok && data?.ok) {
        window.location.href = "/admin";
        return;
      }

      setError(data && !data.ok ? data.error : "Ralat tidak dijangka. Sila cuba lagi.");
    } catch {
      setError("Ralat rangkaian. Sila cuba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm text-brown-deep">
          Nama Pengguna
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
          Kata Laluan
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
        {submitting ? "Log Masuk…" : "Log Masuk"}
      </button>
    </form>
  );
}
