"use client";

import { useState } from "react";

import { csrfHeaders } from "@/lib/csrf-client";
import type { AdminDict } from "@/lib/i18n/admin-dict";
import { MIN_PASSWORD_LENGTH, passwordWeakness } from "@/lib/password-policy";

import { localizeApiError } from "./api-error";

const inputClass =
  "w-full rounded-lg border border-tan/50 bg-cream px-3 py-2 text-sm text-brown-deep outline-none focus-visible:border-goldenrod";

/**
 * Change-your-own-password panel.
 *
 * The current password is asked for even though you are already signed in.
 * A session proves someone is at the keyboard; it does not prove they are
 * the account owner, and without that check an unlocked laptop becomes a
 * permanent takeover rather than a temporary one. The server enforces it —
 * this form only collects it.
 *
 * Strength is checked as you type using the same module the API uses, so
 * the rule and the message can never drift apart. The server re-runs every
 * rule regardless; this is a convenience, not the gate.
 */
export function PasswordSettings({ username, dict }: { username: string; dict: AdminDict }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const weakness = next.length > 0 ? passwordWeakness(next, username) : null;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 && next.length > 0 && confirm.length > 0 && !weakness && !mismatch;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || pending) return;

    setPending(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error: string; code?: string }
        | null;

      if (!response.ok || !data?.ok) {
        setError(localizeApiError(dict, data && !data.ok ? data : null));
        return;
      }

      // Cleared on success so the new password is not left sitting in three
      // form fields on a screen someone may walk away from.
      setCurrent("");
      setNext("");
      setConfirm("");
      setSuccess(true);
    } catch {
      setError(dict.common_networkError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <p className="text-xs leading-5 text-brown/70">{dict.password_intro}</p>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-brown/80 uppercase">
          {dict.password_current}
        </span>
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-brown/80 uppercase">
          {dict.password_new}
        </span>
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={inputClass}
        />
        {weakness ? (
          <span className="text-xs text-red-700">{dict[`password_weak_${weakness}`]}</span>
        ) : (
          <span className="text-xs text-brown/60">
            {dict.password_hint.replace("{min}", String(MIN_PASSWORD_LENGTH))}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-brown/80 uppercase">
          {dict.password_confirm}
        </span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
        {mismatch && <span className="text-xs text-red-700">{dict.password_mismatch}</span>}
      </label>

      <div className="flex items-center gap-3 border-t border-tan/30 pt-4">
        <button
          type="submit"
          disabled={!canSubmit || pending}
          className="cursor-pointer rounded-md bg-goldenrod px-4 py-1.5 text-sm font-medium text-cream transition hover:bg-brown disabled:opacity-50"
        >
          {pending ? dict.common_saving : dict.password_submit}
        </button>
        {success && <span className="text-xs text-green-700">{dict.password_changed}</span>}
        {error && (
          <span role="alert" className="text-xs text-red-700">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
