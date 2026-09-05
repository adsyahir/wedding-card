/**
 * Pure, dependency-free spam heuristics for the public RSVP/wishes forms.
 *
 * Deliberately has NO `server-only` import and touches no DB/request APIs —
 * every function here is a plain value -> boolean check, unit-testable
 * without mocking anything.
 */

const TOO_OLD_MS = 12 * 60 * 60 * 1000; // 12 hours

/** True when the honeypot field was filled in (a real visitor never sees it). */
export function isHoneypotTripped(website: unknown): boolean {
  return typeof website === "string" && website.length > 0;
}

/**
 * True when the form appears to have been submitted suspiciously fast, or
 * with a `renderedAt` timestamp that doesn't look like it came from a real
 * page render.
 *
 * Flags as suspicious (returns `true`) when:
 * - `renderedAt` isn't a parseable timestamp at all (a synthesised/replayed
 *   request rather than one produced by the real form component).
 * - `renderedAt` is in the future relative to `now` (clock tampering).
 * - `renderedAt` is more than 12 hours before `now` (a stale/replayed body —
 *   real guests don't leave a form open that long before submitting).
 * - Less than `minMs` elapsed between `renderedAt` and `now` (faster than a
 *   human can plausibly fill in the form — a bot filling and submitting
 *   instantly).
 */
export function isTooFast(renderedAt: unknown, now: number, minMs = 2000): boolean {
  if (typeof renderedAt !== "string") return true;

  const renderedMs = Date.parse(renderedAt);
  if (Number.isNaN(renderedMs)) return true;

  const elapsed = now - renderedMs;
  if (elapsed < 0) return true; // renderedAt is in the future
  if (elapsed > TOO_OLD_MS) return true; // stale/replayed
  if (elapsed < minMs) return true; // too fast for a human

  return false;
}
