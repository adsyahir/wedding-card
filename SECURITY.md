# Security posture

## Threat model

This is a public wedding invitation that collects guest names, phone
numbers, headcounts, and free-text well-wishes, and gives one admin account
(the couple / family) a dashboard over that data plus background-music
uploads. The assets worth protecting are (1) **the guest list** — names and
phone numbers of everyone who RSVP'd, and (2) **the admin account** — the
only credential that can read the guest list, moderate/export it, or upload
files. The invite itself has no payments, no other user accounts, and
nothing else sensitive. The realistic attackers are opportunistic bots
scraping/spamming the public forms, not a targeted attacker — the defenses
below are sized accordingly.

## What's protected, and how

- **PII minimisation** — no raw IP address or raw user-agent string is ever
  persisted, anywhere in the schema (see the header comment in
  `src/db/schema.ts`). The only per-visitor identifier stored is
  `visitorHash`: `sha256(ip + " " + userAgent + " " + dailySalt)`,
  truncated to 16 bytes, where `dailySalt` rotates every UTC day via HMAC
  over `ANALYTICS_SALT`. Two different days for the same visitor are
  cryptographically unlinkable.
- **Write-only public API surface** — `/api/rsvp`, `/api/wishes`, and
  `/api/track` are the only unauthenticated endpoints, and all three are
  POST-only with no corresponding public GET; there is no public API that
  reads back guest data. `/api/music/[id]` is a public GET, but it only
  ever streams an R2 object resolved server-side from a UUID that never
  touches guest data.
- **Session hashing at rest** — only a SHA-256 hash of the session token
  (and of the CSRF token) is ever stored in `sessions`; the raw values exist
  only in the response that sets the cookies, once, at login.
- **PBKDF2 parameters** — PBKDF2-HMAC-SHA256, 600,000 iterations (OWASP's
  2023 minimum), 32-byte derived key, 16-byte random salt per password
  (`src/lib/password.ts`). The iteration count is stored per-row so it can
  be raised later without invalidating existing passwords.
- **`__Host-` cookies** — the session cookie and the CSRF companion cookie
  are both scoped with the `__Host-` prefix (`Secure`, `Path=/`, no
  `Domain` attribute), which stops any subdomain from ever setting or
  overriding them.
- **CSRF** — double-submit-cookie pattern: every non-GET `/api/admin/*`
  request must carry an `X-CSRF-Token` header whose SHA-256 hash matches
  the session's stored `csrfHash`, AND the request must be same-origin.
  Both on top of, never instead of, the session cookie itself
  (`requireAdminApi` in `src/lib/auth.ts`).
- **Rate limits** — fixed-window, per key, enforced in D1
  (`src/lib/rate-limit.ts`): RSVP 3/hour, wishes 5/hour, analytics beacon
  60/hour, admin login 5/15min (plus a 10-strikes/15-minute account
  lockout independent of IP), cron endpoint 6/hour. All keyed on
  `visitorHash`, never a raw IP.
- **CSP** — nonce-based `script-src` with `'strict-dynamic'`, `frame-ancestors
  'none'`, `object-src 'none'`, and no wildcard sources anywhere except the
  Google Analytics domains, which are only added to the policy when
  `wedding.gaMeasurementId` is actually configured (`src/middleware.ts`).
- **Upload validation** — background-music uploads are validated by
  sniffing the actual file's magic bytes (`src/lib/audio.ts`), never by the
  client-declared `Content-Type` or filename; size is capped and checked
  against the real decoded byte length, not a trusted `Content-Length`.
  Gallery photo uploads (`src/lib/image.ts`) follow the identical pattern —
  magic-byte sniffing only, double size cap — with one extra rule: SVG is
  never accepted, even though it's technically an image format, because an
  SVG document can carry `<script>` and would be a stored-XSS vector if
  ever served inline.
- **CSV injection** — the RSVP export escapes any cell starting with
  `=`, `+`, `-`, `@`, tab, or CR with a leading `'`, so a guest named
  `=HYPERLINK(...)` can't execute a formula when the caterer opens the
  sheet in Excel/Sheets (`src/lib/csv.ts`).
- **Moderation before publication** — a wish is always inserted as
  `pending` (server-set, never client-supplied) and the public wishes wall
  only ever selects `status = 'approved'` rows; nothing reaches the public
  page without an admin explicitly approving it.

## Known limitations (stated honestly)

- **RSVP/ucapan notification emails carry guest PII to a third party, on
  purpose.** When enabled, `src/lib/notify.ts` emails the admin-configured
  recipients a copy of the guest's **name and phone number** (RSVP) or
  **name** (ucapan), plus their message/headcount, via Mailjet. That is
  guest PII leaving this system's D1 database and Cloudflare Worker and
  landing in Mailjet's infrastructure and then the recipients' own inbox
  provider — a deliberate, user-requested tradeoff (the couple/family
  wants to know about a new RSVP immediately), not an oversight. It is
  off by default (`notifications.enabled: false`) and only ever sends to
  addresses the admin explicitly configured. Notification volume is capped
  at 20/hour globally (`checkRateLimit`, key `notify:global`,
  `src/lib/notify.ts`) so a spam burst on the public forms can't also turn
  into a PII-leaking flood. The Mailjet API key/secret and the sender
  identity are Cloudflare secrets set via `wrangler secret put` — never
  admin-editable, never stored in the database, and never logged (see
  `src/lib/mailjet.ts`, which excludes them from every error message and
  log line it writes, even on a failed send).

- **The embedded map (when enabled) sends every guest's IP address to
  Google.** `sections.petaEmbed` (default **off**) puts a keyless Google
  Maps `output=embed` iframe in the Lokasi section/sheet
  (`src/components/invite/{Lokasi,LokasiSheet}.tsx`). No API key or
  billing is involved, but loading that iframe is still a request from the
  guest's browser straight to google.com, carrying their IP address (and
  whatever else a browser normally sends), independent of anything this
  app does. That's why the toggle defaults to off and the admin UI
  (`WeddingConfigSettings`'s Bahagian tab) states this plainly rather than
  hiding it in a changelog — the couple should opt into that privacy cost
  for their guests, not inherit it silently. `frame-src
  https://www.google.com` is likewise added to the CSP (`src/middleware.ts`)
  only while the toggle is on, so a deployment that never enables the map
  keeps the tighter default policy.

- **The rate limiter fails open.** If D1 is unreachable, `checkRateLimit`
  logs the error and returns `{ allowed: true }` rather than blocking every
  request (`src/lib/rate-limit.ts`). A broken rate limiter must never be
  the reason a real guest can't RSVP on the wedding morning — the tradeoff
  is that a burst of spam gets through while D1 is unhealthy, which is
  judged the lesser problem.
- **`constantTimeEqual` is best-effort, not a guarantee.** It's a
  hand-rolled fixed-time comparison over JavaScript string operations
  (`src/lib/crypto.ts`) — JS engines, JIT behavior, and garbage collection
  make true constant-time execution impossible to prove in this
  environment. It meaningfully raises the bar over `===` but is not a
  formally verified defense against a sophisticated remote timing attack.
- **RSVP dedupe keys on phone number alone.** A resubmission with the same
  phone number overwrites the existing row rather than creating a
  duplicate (deliberately, so a guest who changes their headcount doesn't
  inflate the catering tally) — see the comment in
  `src/app/api/rsvp/route.ts`. This means anyone who knows a guest's phone
  number could overwrite that guest's RSVP. The per-visitor rate limit
  bounds how fast that can be done, and the admin RSVP list makes every
  change visible, but there is no ownership proof (e.g. an OTP) tying a
  submission to the phone number's actual owner.
- **`style-src` requires `'unsafe-inline'`.** Next.js's App Router injects
  its own `<style>` tags (streaming/critical CSS) and `next/font`'s
  `@font-face` rules with no nonce hook available today, so `style-src` is
  deliberately looser than the nonce-based `script-src`
  (`src/middleware.ts`). This is a real, accepted gap: a script-injection
  bug elsewhere could pair with this to inject attacker CSS (never
  attacker script — `script-src` has no `'unsafe-inline'`).
- **The analytics beacon can be forged by anyone same-origin.** `POST
  /api/track` has no session or capability check beyond same-origin — by
  design, since real guests have no account. Anyone who can run JavaScript
  on the page (or just script same-origin POSTs) can send fabricated page
  views or events. This is accepted because it's analytics, not billing:
  the worst case is a skewed chart, not a financial or privacy loss, and
  it's bounded by the per-visitor rate limit.
- **No SESSION_SECRET / signed session tokens.** Sessions are plain
  cryptographically-random tokens (`randomToken(32)`), hashed with SHA-256
  before storage — there is no HMAC secret involved in issuing or
  validating one, so there is nothing called "SESSION_SECRET" to rotate
  in this app (see the runbook below for what compromise recovery actually
  looks like here).

## If you suspect compromise

1. **Rotate the real secrets**: `wrangler secret put ANALYTICS_SALT` and
   `wrangler secret put CRON_SECRET` (generate new values with `openssl
   rand -base64 32`, never reuse the old ones or the local dev values).
   Rotating `ANALYTICS_SALT` immediately breaks the link between
   yesterday's and tomorrow's `visitorHash` for every visitor, which is a
   feature, not a side effect, in an incident.
2. **Revoke every admin session.** There is no `SESSION_SECRET` to rotate
   (sessions aren't signed — see above), so revocation means deleting/
   invalidating the `sessions` rows directly:
   ```bash
   npx wrangler d1 execute DB --remote --command \
     "UPDATE sessions SET revoked_at = unixepoch() WHERE revoked_at IS NULL;"
   ```
   Every logged-in browser is forced back to `/admin/login` on its next
   request.
3. **Change the admin password**: `npm run seed:admin -- --remote --force`
   for the existing username. This also implicitly requires re-doing step 2
   afterwards if you didn't already, since a password change alone does not
   revoke existing sessions.
4. Review `audit_log` (`wrangler d1 execute DB --remote --command "SELECT *
   FROM audit_log ORDER BY ts DESC LIMIT 100;"`) for anything unexpected —
   every login, logout, export, delete, and moderation action is recorded
   there with the acting `admin_user_id`.
