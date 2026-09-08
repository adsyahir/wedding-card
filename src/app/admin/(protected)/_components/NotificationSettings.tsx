"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { csrfHeaders } from "@/lib/csrf-client";
import type { AdminDict } from "@/lib/i18n/admin-dict";
import type { NotificationsConfig } from "@/lib/wedding-config";

import { localizeApiError, localizeFieldErrors } from "./api-error";

type SaveResponse =
  | { ok: true }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

type TestResponse = { ok: true } | { ok: false; error: string; code?: string };

/**
 * "Notifikasi" panel on `/admin/settings`: on/off switch, up to two
 * recipient emails, per-event checkboxes, and a "Hantar e-mel ujian"
 * button.
 *
 * Recipients/toggles are the admin-editable half of the notifications
 * feature and are saved through the same generic
 * `POST /api/admin/settings/wedding` endpoint every other settings tab
 * uses (see `src/lib/wedding-config.ts`'s `notifications` field). The
 * Mailjet CREDENTIALS (API key/secret, sender identity) are Cloudflare
 * secrets, deployment-only, and never touched by this panel — see the
 * "secrets missing" notice below.
 */
export function NotificationSettings({
  initialConfig,
  dict,
  canTestSend,
}: {
  initialConfig: NotificationsConfig;
  dict: AdminDict;
  /** Whether this admin may send the Mailjet test email (see src/lib/admin-privileges.ts). */
  canTestSend: boolean;
}) {
  const router = useRouter();

  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [recipients, setRecipients] = useState<string[]>([
    initialConfig.recipients[0] ?? "",
    initialConfig.recipients[1] ?? "",
  ]);

  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [testPending, setTestPending] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);

  function updateRecipient(index: number, value: string) {
    setRecipients((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleSave() {
    setSavePending(true);
    setSaveError(null);
    setSaveSuccess(false);
    setFieldErrors({});
    setTestSuccess(false);

    // Empty fields are simply omitted, never sent as blank strings — the
    // server schema requires each recipient to be a non-empty, valid
    // email (see `notificationEmailSchema`).
    const cleanedRecipients = recipients.map((r) => r.trim()).filter((r) => r.length > 0);

    try {
      const response = await fetch("/api/admin/settings/wedding", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          notifications: { enabled, recipients: cleanedRecipients },
        }),
      });
      const data = (await response.json().catch(() => null)) as SaveResponse | null;
      if (!response.ok || !data?.ok) {
        setSaveError(localizeApiError(dict, data && !data.ok ? data : null));
        setFieldErrors(localizeFieldErrors(dict, (data && !data.ok && data.fieldErrors) || {}));
        return;
      }
      setSaveSuccess(true);
      router.refresh();
    } catch {
      setSaveError(dict.common_networkError);
    } finally {
      setSavePending(false);
    }
  }

  async function handleTestSend() {
    setTestPending(true);
    setTestError(null);
    setTestSuccess(false);
    try {
      const response = await fetch("/api/admin/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: "{}",
      });
      const data = (await response.json().catch(() => null)) as TestResponse | null;
      if (!response.ok || !data?.ok) {
        setTestError(localizeApiError(dict, data && !data.ok ? data : null));
        return;
      }
      setTestSuccess(true);
    } catch {
      setTestError(dict.common_networkError);
    } finally {
      setTestPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-tan/30 bg-sand/40 p-3 sm:p-4">
      <h2 className="font-serif text-xl text-brown-deep">{dict.notif_heading}</h2>

      <p className="text-xs text-brown/60">{dict.notif_intro}</p>

      <label className="flex items-center gap-2 text-sm text-brown-deep">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span>{dict.notif_enable}</span>
      </label>

      {/*
        Everything below only has meaning while notifications are on, so it
        is disabled rather than merely ignored — a filled-in recipient with
        the master switch off reads as "this is set up", when in fact
        nothing will ever be sent. The Save button stays enabled: turning
        notifications OFF is itself a change that has to be savable.
      */}
      <div
        className={`flex flex-col gap-2 ${enabled ? "" : "pointer-events-none opacity-50"}`}
        aria-disabled={!enabled}
      >
        {[0, 1].map((index) => (
          <label key={index} className="flex flex-col gap-1 text-sm text-brown-deep">
            <span className="font-medium">{dict.notif_recipientLabel.replace("{n}", String(index + 1))}</span>
            <input
              type="email"
              value={recipients[index]}
              onChange={(event) => updateRecipient(index, event.target.value)}
              placeholder={dict.notif_recipientPlaceholder}
              maxLength={254}
              disabled={!enabled}
              className="rounded-md border border-tan/40 bg-cream px-3 py-1.5 text-sm text-brown-deep"
            />
            {fieldErrors[`notifications.recipients.${index}`] && (
              <span role="alert" className="text-xs text-red-700">
                {fieldErrors[`notifications.recipients.${index}`]}
              </span>
            )}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-tan/30 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={savePending}
          className="rounded-md bg-goldenrod px-4 py-1.5 text-sm font-medium text-cream transition hover:bg-brown disabled:opacity-50"
        >
          {savePending ? dict.common_saving : dict.common_save}
        </button>
        {saveSuccess && <span className="text-xs text-green-700">{dict.common_saved}</span>}
        {saveError && (
          <span role="alert" className="text-xs text-red-700">
            {saveError}
          </span>
        )}
      </div>

      {/*
        Only the account allowed to use it sees it — see
        `src/lib/admin-privileges.ts`. The route enforces the same rule, so
        this is tidiness rather than security: offering a button that
        answers 403 is worse than not offering it.
      */}
      {canTestSend && (
      <div className="flex items-center gap-3 border-t border-tan/30 pt-4">
        <button
          type="button"
          onClick={handleTestSend}
          disabled={testPending || !enabled}
          className="rounded-md border border-tan/40 px-4 py-1.5 text-sm font-medium text-brown-deep transition hover:bg-tan/20 disabled:opacity-50"
        >
          {testPending ? dict.notif_testSending : dict.notif_testSend}
        </button>
        {testSuccess && <span className="text-xs text-green-700">{dict.notif_testSuccess}</span>}
        {testError && (
          <span role="alert" className="text-xs text-red-700">
            {testError}
          </span>
        )}
      </div>
      )}
    </section>
  );
}
