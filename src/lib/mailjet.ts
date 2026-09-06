import "server-only";

import { getSecret } from "@/lib/request";

/**
 * Thin, dependency-free client for Mailjet's `/v3.1/send` API.
 *
 * Deliberately NOT the official `node-mailjet` SDK: it assumes a Node
 * runtime (streams, `http`/`https` modules) that doesn't exist on Cloudflare
 * Workers. A plain `fetch` with HTTP Basic auth is all `/v3.1/send` actually
 * needs, and it works unchanged on Workers.
 *
 * This module never throws: every failure mode (missing secrets, a network
 * error, a non-2xx response from Mailjet) is reported through the
 * discriminated `MailjetSendResult` return value, never an exception, so a
 * caller (see `src/lib/notify.ts`) can never accidentally let a broken email
 * provider propagate into a guest-facing request.
 */

const MAILJET_SEND_URL = "https://api.mailjet.com/v3.1/send";
const REQUEST_TIMEOUT_MS = 10_000;

export type MailjetSendInput = {
  to: string[];
  subject: string;
  textPart: string;
  htmlPart: string;
};

export type MailjetSendResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unconfigured" | "http_error" | "rejected" | "network_error";
      detail: string;
    };

/**
 * Inspects a 2xx `/v3.1/send` body and returns a description of the
 * problem, or `null` when every message was genuinely accepted.
 *
 * An unrecognised body shape is treated as a FAILURE, not a success: this
 * function exists precisely because "the call returned 200" turned out not
 * to mean the mail was sent, and guessing optimistically about a body we
 * cannot parse would reintroduce exactly that.
 */
export function messageStatusError(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return "Mailjet returned an unreadable body";

  const messages = (body as { Messages?: unknown }).Messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return "Mailjet returned no per-message status";
  }

  const problems: string[] = [];
  for (const message of messages) {
    const status = (message as { Status?: unknown })?.Status;
    if (status === "success") continue;

    const errors = (message as { Errors?: unknown })?.Errors;
    const detail = Array.isArray(errors)
      ? errors
          .map((e) => (e as { ErrorMessage?: unknown })?.ErrorMessage)
          .filter((m): m is string => typeof m === "string")
          .join("; ")
      : "";
    problems.push(detail || `status "${String(status)}"`);
  }

  return problems.length > 0 ? problems.join(" | ") : null;
}

/**
 * Reads the four Mailjet secrets from the Cloudflare env. Returns `null`
 * (rather than throwing) if any are absent — the normal case for a fresh
 * clone that hasn't run `wrangler secret put` yet, and callers treat that
 * as "notifications are unconfigured", not an error.
 */
function readMailjetSecrets():
  | { apiKey: string; apiSecret: string; senderEmail: string; senderName: string }
  | null {
  try {
    return {
      apiKey: getSecret("MAILJET_API_KEY"),
      apiSecret: getSecret("MAILJET_API_SECRET"),
      senderEmail: getSecret("MAILJET_SENDER_EMAIL"),
      senderName: getSecret("MAILJET_SENDER_NAME"),
    };
  } catch {
    // getSecret throws a value-free "Missing required secret: X" error —
    // deliberately not logged here, since "not configured yet" is the
    // expected, silent-no-op state (see notify.ts), not a fault.
    return null;
  }
}

/**
 * Sends one email via Mailjet's `/v3.1/send` API. Never throws.
 *
 * - Returns `{ ok: false, reason: "unconfigured" }` with no network call at
 *   all when any of the four Mailjet secrets are missing.
 * - Enforces a hard 10s timeout via `AbortSignal.timeout` so a hanging
 *   request can never sit forever inside a `ctx.waitUntil()` background
 *   task (see `src/lib/notify.ts`).
 * - On a non-2xx response, logs the status and response body — but NEVER
 *   the API key/secret, which never appear in the body or are constructed
 *   into any logged string here.
 * - Checks the PER-MESSAGE status in the body, not just the HTTP status.
 *   `/v3.1/send` answers 200 for a request it accepted but a message it
 *   refused: an unvalidated sender comes back as HTTP 200 with
 *   `Messages[0].Status: "error"`, and the mail is silently dropped. See
 *   `messageStatusError` below.
 */
export async function sendMailjetEmail(input: MailjetSendInput): Promise<MailjetSendResult> {
  const secrets = readMailjetSecrets();
  if (!secrets) {
    return { ok: false, reason: "unconfigured", detail: "Mailjet secrets are not configured" };
  }

  const { apiKey, apiSecret, senderEmail, senderName } = secrets;
  const basicAuth = btoa(`${apiKey}:${apiSecret}`);

  const payload = {
    Messages: [
      {
        From: { Email: senderEmail, Name: senderName },
        To: input.to.map((email) => ({ Email: email })),
        Subject: input.subject,
        TextPart: input.textPart,
        HTMLPart: input.htmlPart,
      },
    ],
  };

  try {
    const response = await fetch(MAILJET_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Mailjet's error body is JSON describing what went wrong (invalid
      // sender, invalid recipient, ...) and never echoes back the
      // Authorization header/credentials, so it's safe to log verbatim.
      const body = await response.text().catch(() => "<unreadable body>");
      console.error(`sendMailjetEmail: Mailjet returned ${response.status}`, body);
      return {
        ok: false,
        reason: "http_error",
        detail: `Mailjet responded ${response.status}`,
      };
    }

    /*
     * HTTP 200 is not delivery. Mailjet answers 200 for a well-formed
     * request and reports the fate of each message inside the body:
     *
     *   {"Messages":[{"Status":"error","Errors":[{"ErrorMessage":"..."}]}]}
     *
     * This bit an actual send: with an unvalidated `From:` the API replied
     * 200 with Status "success", the app logged a success, and the message
     * never entered the pipeline at all. Anything other than an explicit
     * per-message "success" is now a failure, so a silent drop is reported
     * as one instead of being announced as a delivered email.
     */
    const body = await response.json().catch(() => null);
    const failure = messageStatusError(body);
    if (failure) {
      console.error("sendMailjetEmail: Mailjet accepted the request but refused the message", failure);
      return { ok: false, reason: "rejected", detail: failure };
    }

    return { ok: true };
  } catch (error) {
    // Network error, DNS failure, or the AbortSignal timeout firing — all
    // land here. Never include `basicAuth`/`apiKey`/`apiSecret` in what's
    // logged; `error` is whatever `fetch`/`AbortController` throws, which
    // never contains request headers.
    console.error("sendMailjetEmail: network error contacting Mailjet", error);
    return { ok: false, reason: "network_error", detail: "Network error contacting Mailjet" };
  }
}
