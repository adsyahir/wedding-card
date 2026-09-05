/**
 * Shared POST helper for the RSVP and Ucapan forms.
 *
 * The routes this calls (`/api/rsvp`, `/api/wishes`) don't exist yet —
 * they're built in Phase 3 against this exact contract:
 *   200 { ok: true }  |  4xx/5xx { ok: false, error: string }
 *
 * Per spec, a raw server error string is never rendered into the DOM (it may
 * not even exist yet, e.g. on a 404 before the route is built) — callers
 * only ever see a generic `ok: false` and choose their own friendly Malay
 * copy. The actual server text is logged for developer visibility only.
 */
export type SubmitResult = { ok: true } | { ok: false };

export async function submitPublicForm(url: string, body: unknown): Promise<SubmitResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      // Non-JSON body (e.g. a plain 404/500 page) — fall through to the
      // response.ok check below.
    }

    if (
      response.ok &&
      parsed &&
      typeof parsed === "object" &&
      (parsed as { ok?: unknown }).ok === true
    ) {
      return { ok: true };
    }

    if (parsed && typeof parsed === "object" && "error" in parsed) {
      console.error("Form submission rejected:", (parsed as { error: unknown }).error);
    } else {
      console.error("Form submission failed with status", response.status);
    }
    return { ok: false };
  } catch (error) {
    console.error("Form submission network error:", error);
    return { ok: false };
  }
}
