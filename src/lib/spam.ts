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
 * True when the form was filled in implausibly fast for a human.
 *
 * `elapsedMs` is measured ENTIRELY ON THE CLIENT — the form records
 * `Date.now()` when it mounts and subtracts it from `Date.now()` at submit.
 * We never compare a client-supplied absolute timestamp against the server
 * clock, and that is the whole point: doing so silently discards the
 * submission of any guest whose phone clock is skewed even slightly ahead
 * of ours. Because a tripped check returns a *fake success* to the client,
 * such a guest would see "Terima kasih!" while their RSVP was thrown away —
 * the worst failure this app could have. Measuring a duration against a
 * single clock makes the check immune to skew.
 *
 * A bot can of course forge `elapsedMs`, exactly as it could forge a
 * timestamp. This check only catches naive instant submitters; the honeypot
 * and the rate limiter are the real defences, and neither is weakened here.
 *
 * Flags as suspicious (returns `true`) when `elapsedMs` is not a finite
 * non-negative number, is under `minMs`, or exceeds 12 hours (a stale tab or
 * a replayed body).
 */
export function isTooFast(elapsedMs: unknown, minMs = 2000): boolean {
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs)) return true;
  if (elapsedMs < 0) return true;
  if (elapsedMs < minMs) return true;
  if (elapsedMs > TOO_OLD_MS) return true;
  return false;
}
