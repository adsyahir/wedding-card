# Wedding Card — Arif

A digital Malay wedding invitation, built with Next.js 15 (App Router) and
deployed to Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare).

## Stack

- Next.js 15 (App Router, TypeScript, strict mode)
- `@opennextjs/cloudflare` targeting Cloudflare Workers (not static export)
- Cloudflare D1 + Drizzle ORM + drizzle-kit
- Cloudflare R2 (media storage)
- Tailwind CSS v4
- Zod
- Vitest
- Recharts (admin-only analytics charts)
- `@next/third-parties` (optional Google Analytics 4)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Filling in the wedding details

`src/config/wedding.ts` is now the **default/fallback** — most of the
card's content is instead admin-editable from `/admin/settings` (see
"Admin-editable wedding content" below), which is the live source of truth
once anything has been saved there. Editing the file is still useful for:
setting up a fresh clone before an admin exists, and as the value that
"Kembalikan ke asal" restores. It exports one `wedding` object, typed by
`WeddingConfig`, with:

- `siteUrl` — the public origin (used for OG tags/absolute URLs); update it
  once a real domain is attached (see "Attach a custom domain" below).
- `presetMusicPath` / `gaMeasurementId` — see "Background music" and
  "Google Analytics" below; both ship disabled (`null`) by design.
- `eventType`, `groom`, `bride`, `hosts`, `salam`, `invitationBody`,
  `honorifics` — the invitation text itself.
- `date`, `dayNameMs`, `displayDate`, `endTime` — the akad/ceremony
  date-time (with the `+08:00` offset) and its human-readable form; `endTime`
  feeds the generated `.ics` calendar entry.
- `venue` — name, address lines, lat/lng, and Google Maps/Waze links.
- `aturCara` — the run-of-show list (`{ time, label }` pairs).
- `rsvpDeadline` / `rsvpDeadlineDisplay` — the RSVP cutoff shown to guests.
- `contacts` — the "hubungi kami" contact list.
- `hashtag` — the couple's wedding hashtag.
- `gallery` — photo entries (`{ src, alt }`); ships with placeholder SVGs
  under `public/images/gallery/` — this is now the **fallback only**: once
  an admin uploads at least one photo from `/admin/settings`, the public
  card renders the admin-managed gallery instead (see "Admin-managed
  gallery" below). Replace `src` with real photos (any raster format) if
  you'd rather keep the gallery file-only.
- `doa` — the closing prayer text.

Every field is documented inline in the file itself.

### Admin-editable wedding content

Phase 9a made most of the fields above admin-editable, from a tabbed panel
at `/admin/settings` (Butiran / Lokasi / Atur Cara / Hubungi / Bahagian,
alongside the existing Muzik panel):

- **Architecture**: the admin's edits are stored as a single JSON document
  in the `site_settings` row keyed `wedding_config`
  (`src/lib/wedding-config.ts`). `getWeddingConfig()` reads that row,
  validates it with a Zod schema, and deep-merges it over the file
  defaults in `src/config/wedding.ts` — every field an admin hasn't
  touched still comes straight from the file.
- **The card can never break from a bad edit.** If the row is missing,
  its JSON is malformed, or it fails schema validation, `getWeddingConfig`
  logs the problem server-side and returns the file defaults unchanged —
  wrapped in try/catch at every layer. This is deliberately the single
  most important property of this module (see the tests in
  `src/lib/wedding-config.test.ts`).
- **Validated hard**: name/text lengths, `date`/`endTime`/`rsvpDeadline` as
  parseable ISO 8601 strings, `lat`/`lng` range-checked, and —
  importantly — `venue.googleMapsUrl`/`venue.wazeUrl` are restricted to
  `https:` URLs on an allow-list of hosts (`google.com`/`goo.gl`/
  `maps.app.goo.gl`, `waze.com`). These render as links a guest taps, so a
  `javascript:` URL (or any non-`https:` scheme, or an unlisted host) is
  rejected outright, never saved. `aturCara` and `contacts` are capped at
  30 entries each; contact phone numbers are validated with the same
  Malaysian normaliser the public RSVP form uses
  (`normalizeMalaysianPhone`, `src/lib/validation.ts`).
- **Not admin-editable** (file-only, by design): `siteUrl`,
  `presetMusicPath`, and `gaMeasurementId` — the first two are
  infra/security-shaped enough to keep out of a JSON blob edited from a
  phone. `gallery` is a partial exception: the field itself stays
  file-only, but it's now just the fallback for the DB-backed,
  admin-managed gallery — see "Admin-managed gallery" below.
- **Section visibility**: the admin can also show/hide individual sections
  (`undangan`, `lokasi`, `aturCara`, `countdown`, `galeri`, `ucapan`,
  `kehadiran`) and bottom-nav items (`navKalendar`, `navLokasi`,
  `navHubungi`, `navRsvp`) from the "Bahagian" tab — all default to
  visible. A hidden section is absent from the DOM entirely, not merely
  CSS-hidden, and hiding `kehadiran` skips the `getAttendanceCounts()`
  query outright. Closing `ucapan` or `navRsvp` also closes the
  corresponding write endpoint server-side (`POST /api/wishes` /
  `POST /api/rsvp` both return 403) — the toggle is a real closure, not
  cosmetic. Two more fine-grained toggles live in the same "Bahagian" tab:
  `kalendarGrid` (the static month grid in the Kalendar sheet — default
  **on**; turning it off leaves the date line and the add-to-calendar
  buttons alone) and `petaEmbed` (the embedded Google Maps iframe in
  Lokasi/the Lokasi sheet — default **off**, see SECURITY.md for why).
- **Script font**: `scriptFont` (Butiran tab) picks which self-hosted
  `next/font/google` family drives `--font-script` — the couple's
  short/full names, the venue name, and the hashtag. Five options
  (`parisienne` default, `greatVibes`, `dancingScript`, `sacramento`,
  `cormorantGaramond`), all loaded unconditionally in `src/app/layout.tsx`
  and switched via a `data-script-font` attribute on `<html>` set
  server-side, so there's never a flash of the wrong font.
- **Saving**: `POST /api/admin/settings/wedding` (Zod-validated,
  `requireAdminApi`-guarded, audit-logged) — each settings tab saves only
  the fields it owns, merged over whatever was already saved. **"Kembalikan
  ke asal"** (`POST /api/admin/settings/wedding/reset`) deletes the
  `wedding_config` row outright, so a bad edit is always recoverable
  without touching the database by hand.
- The public invite (`src/app/page.tsx`), the root layout's metadata
  (`src/app/layout.tsx`), and the OG image (`src/app/opengraph-image.tsx`)
  all resolve their content through `getWeddingConfig()` — never the
  static `wedding` import — so an admin edit takes effect immediately on
  the next page load, no redeploy needed.

### Background music

There are two ways background music gets onto the card:

- **Bundled preset**: `wedding.presetMusicPath` in `src/config/wedding.ts`
  declares a static file under `public/`. It ships as `null` — drop an MP3
  into `public/music/` and set the value (e.g. `"/music/preset-1.mp3"`) to
  enable it.
- **Admin-managed uploads**: from `/admin/settings`, an admin can upload an
  MP3/M4A (up to 8 MB), listen to it inline before switching, and pick it as
  the active track. Uploads are validated by magic bytes (never by the
  declared `Content-Type` or filename) and stored in the `ASSETS_BUCKET` R2
  bucket under a server-generated key — the original filename is kept only
  for display. The public invite streams the active uploaded track from
  `/api/music/<track-id>` (`src/app/api/music/[id]/route.ts`), which
  supports HTTP Range requests (required for iOS Safari to play it at all).

Either way, `getActiveMusicSrc()` (`src/db/queries/public.ts`) resolves what
actually plays, based on the `site_settings` row `active_music_track`:
`"none"` disables music entirely (no player, no mute toggle rendered),
`"preset"` (or unset) falls back to the bundled file above, and anything
else is treated as an uploaded track's id. The track never autoplays — it
starts only when a guest taps **BUKA** on the envelope, and the mute choice
is remembered per device. If "Lagu lalai" is selected but no preset file is
bundled, the settings page warns about it explicitly, and the invite still
renders cleanly with no player rather than a broken one. The active track
also can't be deleted out from under the invite — `/admin/settings` refuses
that (409) until a different track is selected first.

### Admin-managed gallery

Phase 9b made the "Galeri" section admin-managed, mirroring the background
music upload flow above:

- From `/admin/settings`, an admin can upload a JPEG/PNG/WebP (up to 5 MB,
  up to 30 photos), edit each photo's alt text, reorder them with simple
  up/down buttons (no drag-and-drop), and delete them (with a confirmation
  step).
- Uploads are validated by **magic bytes only** (`src/lib/image.ts`) —
  never by the client-declared `Content-Type` or filename. SVG is
  deliberately never accepted, even though browsers render it as an image:
  an SVG document can embed `<script>`, which would be a stored-XSS vector
  once served inline. Files are stored in the `ASSETS_BUCKET` R2 bucket
  under a server-generated key; the original filename is kept only for
  display.
- The public invite streams each photo from `/api/gallery/<image-id>`
  (`src/app/api/gallery/[id]/route.ts`), which resolves the R2 key
  server-side from the database row — the id in the URL is never a storage
  path — and serves it with a hardcoded, whitelisted `Content-Type`,
  `X-Content-Type-Options: nosniff`, and `Content-Disposition: inline`.
- `getGalleryImages()` (`src/db/queries/public.ts`) resolves what the
  public card actually renders: the admin-uploaded photos ordered by their
  saved position, or — on any failure, or when nothing has been uploaded
  yet — the file config's `wedding.gallery` (the bundled placeholders), so
  a fresh install still looks right.
- Reordering validates that the submitted id list is exactly the same SET
  of ids already in the table (`isValidGalleryReorder`,
  `src/db/queries/admin.ts`) — no additions, no omissions — before writing
  anything, so a partial or foreign list can never corrupt the ordering.

### Analytics

The invite collects privacy-preserving, first-party analytics. This is
intentionally NOT third-party analytics with cookies/IP logging — it never
persists a raw IP address or a raw user-agent string anywhere. See the
schema-level comment at the top of `src/db/schema.ts` for the invariant this
is built around, and `src/lib/crypto.ts#visitorHash` for the salted,
daily-rotating, truncated hash that's the only per-visitor identifier ever
stored.

**What's collected**: a page view (path, coarse geography from Cloudflare's
own edge, referrer HOST only — never a full URL — device/OS/browser parsed
from the user-agent) via `POST /api/track`, plus a small closed set of
interaction events (`envelope_open`, `music_play`, `maps_click`,
`waze_click`, `calendar_add`, `rsvp_open`, `rsvp_submit`, `ucapan_submit`,
`gallery_open`, `contact_click` — see `src/lib/analytics-events.ts`). Bot
and crawler traffic is dropped before any write (`src/lib/user-agent.ts`),
and the beacon is rate-limited per visitor (60/hour) — see
`src/app/api/track/route.ts` for the full contract. `src/lib/track.ts` and
`src/components/invite/TrackView.tsx` are the client-side pieces that call
it; nothing is ever tracked on the `/admin` side.

**Viewing it**: `/admin/analytics` shows a 7/30/90-day dashboard — totals,
a visits-over-time chart, top countries/cities, a referrer breakdown
(WhatsApp/Facebook/Instagram/Google/direct/other), device/OS/browser
breakdowns, and the views → `rsvp_open` → `rsvp_submit` engagement funnel.

**Aggregation and retention**: raw `page_views`/`events` rows are rolled up
into one small `daily_stats` row per day (`src/lib/analytics-rollup.ts`) and
pruned after 90 days, so the raw tables never grow without bound.

**Driving the rollup — why there's no Cloudflare Cron Trigger wired up**:
`@opennextjs/cloudflare` (as of the version pinned here, `^1.20.6`)
generates `.open-next/worker.js` fresh on every build from its own
template, and that template exports only `{ fetch(request, env, ctx) }` —
no `scheduled()` handler, and no supported hook to add one without hand
patching a generated file that the next build silently overwrites. Rather
than force that with fragile custom-worker surgery, this app instead:

1. Exposes `POST /api/cron/rollup`, guarded by a `CRON_SECRET` bearer
   token (`constantTimeEqual`-compared — see `.dev.vars.example`). It rolls
   up yesterday, prunes analytics older than 90 days, and also runs
   `pruneRateLimits`/`pruneExpiredSessions`. Drive it with a Cloudflare
   Cron Trigger on a small separate worker that just does a `fetch()` to
   this URL with the header `Authorization: Bearer <CRON_SECRET>`, or any
   external scheduler capable of an authenticated HTTP call on a schedule
   (a GitHub Actions scheduled workflow, cron-job.org, etc.) — once a day
   is plenty.
2. **Also** makes `/admin/analytics` opportunistically backfill any day in
   its displayed range that's missing a `daily_stats` row
   (`backfillMissingDailyStats`), so the dashboard has real data the very
   first time an admin opens it — with zero scheduling setup required. The
   cron endpoint above is a nice-to-have on top of that, not a hard
   dependency.

Set `CRON_SECRET` the same way as `ANALYTICS_SALT` — via `.dev.vars`
locally, and `wrangler secret put CRON_SECRET` in production.

### Email notifications (Mailjet)

The couple/family can get an email whenever a guest submits an RSVP or an
ucapan (well-wish) — see `src/lib/notify.ts` and `src/lib/mailjet.ts`.

**Setup**:

1. Create a Mailjet account and an API key pair at
   <https://app.mailjet.com/account/apikeys>.
2. **Validate a sender address (or a whole domain)** in Mailjet before
   sending anything — this is not optional. Mailjet refuses to send from a
   `From:` address that hasn't been validated. Domain validation (adding
   the DNS records Mailjet gives you) is the more robust option but can
   take a while to propagate — a single validated sender email is faster
   to set up if you just want something working today.
3. Set the four secrets (never in `wrangler.jsonc`, never in the
   database):
   ```bash
   wrangler secret put MAILJET_API_KEY
   wrangler secret put MAILJET_API_SECRET
   wrangler secret put MAILJET_SENDER_EMAIL   # must be the validated address/domain above
   wrangler secret put MAILJET_SENDER_NAME
   ```
   For local dev, copy `.dev.vars.example` to `.dev.vars` and fill these
   four in (leaving them blank is fine — see below).
4. In `/admin/settings`, open the **Notifikasi** panel: turn notifications
   on, enter up to two recipient email addresses, choose whether to notify
   on RSVP/ucapan (or both), and use "Hantar e-mel ujian" to confirm it
   actually reaches an inbox.

**Design notes**:

- **Never blocks or breaks a guest submission.** The email is sent via
  `ctx.waitUntil()` strictly AFTER the RSVP/ucapan database write has
  already succeeded (`src/lib/background.ts`), wrapped in try/catch —
  Mailjet being slow, down, or misconfigured can never delay or fail a
  guest's 200 response. A 10-second hard timeout
  (`AbortSignal.timeout`) keeps a hanging Mailjet request from lingering in
  the background forever.
- **Silent no-op when unconfigured.** With any of the four secrets unset,
  or with the admin toggle off, or with no recipients saved, nothing is
  sent and nothing is logged as an error — this is the expected state for
  a fresh clone.
- **Throttled at 20 emails/hour, globally** (`checkRateLimit`, key
  `notify:global`) — a spam burst on the public forms can't flood the
  recipients' inboxes or burn the Mailjet quota. The RSVP/ucapan row is
  still written every time; only the email is skipped once throttled.
- Recipients and the on/off/per-event toggles are admin-editable
  (`notifications` in the `wedding_config` doc,
  `src/lib/wedding-config.ts`) — capped at 2 recipients, a third is
  rejected rather than silently dropped. The Mailjet credentials
  themselves are deployment secrets, deliberately kept out of that
  admin-editable JSON blob (see the module comment in
  `src/lib/wedding-config.ts`).

### Google Analytics (optional)

Set `wedding.gaMeasurementId` in `src/config/wedding.ts` to a real
`"G-XXXXXXXXXX"` Measurement ID to enable GA4. It ships as `null` (GA
disabled) so a fresh clone of this repo never phones home to Google by
default. When set, `<GoogleAnalytics>` (from `@next/third-parties/google`)
is rendered ONLY on the public invite page (`src/app/page.tsx`) — never
under `/admin` — and the CSP in `src/middleware.ts` conditionally allows
`googletagmanager.com`/`google-analytics.com` only when a measurement id is
configured.

### Admin login

The admin dashboard (`/admin`) is protected by a username/password login
backed by the `admin_users` D1 table. Create the first admin user with:

```bash
npm run seed:admin
```

This prompts interactively for a username and password (the password is
never echoed to the terminal, and is never accepted as a CLI argument or
environment variable — both would leak into shell history / the process
table). It enforces a minimum password length of 12 characters, derives a
PBKDF2-SHA256 hash locally (identical parameters to `src/lib/password.ts`),
and writes the row to the **local** D1 database via `wrangler d1 execute`.

- `npm run seed:admin -- --remote` writes to the real, deployed D1 database
  instead of the local one.
- `npm run seed:admin -- --force` allows overwriting an existing username
  (the script refuses to do this by default).

### Admin dashboard language (BM / EN)

The admin dashboard chrome (nav, headings, buttons, tables, toasts, the
login page, everything under `/admin/settings`) can be switched between
Bahasa Melayu and English with the "BM / EN" control in the dashboard
header. This is stored per-browser in a `wc_admin_lang` cookie (`ms` or
`en`, default `ms`), not a database column — several family members may
share one admin login, and a cookie gives each of them their own language
on their own device, with no migration needed. See
`src/lib/i18n/admin.ts`/`admin-dict.ts` for the dictionary and
`src/app/admin/(protected)/LangToggle.tsx` for the control itself.

This toggle only affects the admin dashboard. **The public invitation page
always renders in Bahasa Melayu** and is completely unaffected by this
cookie — it's a Malay wedding card, and the content the admin types into
`/admin/settings` (names, addresses, itinerary, ...) is the couple's own
data, not UI chrome, so it is never translated either.

### Local database

Local development already runs entirely on **SQLite**. `next dev` serves the
app through Miniflare, whose D1 implementation is a plain SQLite file on
disk under `.wrangler/state` — the same file `wrangler d1 execute DB --local`
writes to. There is no separate local database to keep in sync.

```bash
npm run db:migrate:local   # create/upgrade the local schema
npm run db:studio          # browse it in Drizzle Studio
npm run db:local:path      # print the .sqlite path, to open in any GUI
```

`npm run db:local:path` prints a path you can open directly in TablePlus,
DBeaver, `sqlite3`, or any other SQLite client.

## Scripts

- `npm run dev` — local dev server (Cloudflare bindings available via
  `initOpenNextCloudflareForDev`)
- `npm run build` — production Next.js build
- `npm run lint` / `npx tsc --noEmit` — lint / typecheck
- `npm test` — run the Vitest suite
- `npm run preview` — build for Cloudflare and preview with `wrangler`
- `npm run deploy` — build for Cloudflare and deploy
- `npm run cf-typegen` — regenerate `cloudflare-env.d.ts` after editing
  `wrangler.jsonc` bindings
- `npm run db:generate` — generate a new Drizzle migration from
  `src/db/schema.ts`
- `npm run db:migrate:local` / `npm run db:migrate:remote` — apply
  migrations to the local or remote D1 database
- `npm run seed:admin` — interactively create/update an admin login (see
  "Admin login" above)
- `npm run settings:export` / `npm run settings:import` — move the wedding
  settings between environments as a JSON file (see below)
- `npm run db:studio` — browse the local SQLite database in Drizzle Studio
- `npm run db:local:path` — print the local SQLite file path

## Testing

- `npm test` — the Vitest unit suite (pure logic: validation, crypto,
  rate-limit math, CSV encoding, session expiry arithmetic, etc.).
- `npm run smoke` — an end-to-end smoke test against an **already-running**
  local dev server (`npm run dev` in another terminal first). It exercises
  the public and admin HTTP surface with no dependencies beyond Node's
  built-in `fetch`: the public page loads, a valid RSVP is accepted, a
  duplicate RSVP (same phone) updates instead of inserting a second row, a
  submitted ucapan lands as pending and does NOT appear on the public page,
  the analytics beacon accepts a view and silently drops a bogus event name,
  unauthenticated `/admin` redirects to `/admin/login`, an unauthenticated
  admin API call returns 401, and the security headers are present. It
  prints a pass/warn/fail line per check with an actionable message (which
  file to look at) on failure, and exits non-zero if anything failed. Point
  it at a different port/host with `SMOKE_BASE_URL`, e.g. against a
  `wrangler` preview: `SMOKE_BASE_URL=http://localhost:8788 npm run smoke`.

## Security

See [`SECURITY.md`](./SECURITY.md) for the threat model, what's protected
and how, honestly-stated known limitations, and the "if you suspect
compromise" runbook.

### Moving settings between local and production

Everything the admin can edit — names, date, venue, atur cara, contacts,
section toggles, headcount mode, script font, notification recipients —
lives in one JSON document in `site_settings`. Rather than filling the
admin panel in twice (once locally, once against production), configure it
once and copy it:

```bash
npm run settings:export                 # local D1  -> wedding-settings.json
npm run settings:import -- --remote     # that file -> production D1
```

Both directions take `--remote`, and `--file <path>` for somewhere other
than the default `wedding-settings.json`. `npm run settings:import --
--reset` deletes the row, putting the card back on the defaults in
`src/config/wedding.ts` — the same thing the admin panel's "Kembalikan ke
asal" button does.

The exported file is gitignored: it contains the couple's real details.

It deliberately does **not** touch guest data (`rsvps`, `wishes`), admin
accounts, or the gallery and music tables — those last two point at R2
objects, so copying the rows alone would leave dangling references.
Re-upload media through the admin panel.

The script checks only that the file is a JSON object. The app validates
properly on read and falls back to the file defaults if the document is
malformed, so a bad import shows you the defaults rather than a broken
page — if an import appears to do nothing, that is the first thing to
suspect.

## Deploying

See **[DEPLOY.md](DEPLOY.md)** for the full production checklist: content to
fill in first, Cloudflare resources, secrets, `SITE_URL`, migrations, the
first admin user, Google Analytics, Mailjet, scheduled housekeeping, and a
pre-launch checklist.

Kept in one place deliberately: a second copy of a deploy sequence is a copy
that goes stale, and this one already had, missing `SITE_URL` and the four
Mailjet secrets.
