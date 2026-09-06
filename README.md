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

`src/config/wedding.ts` is the single file to edit for the card's actual
content — nothing else needs to change. It exports one `wedding` object,
typed by `WeddingConfig`, with:

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
  under `public/images/gallery/` — replace `src` with real photos (any
  raster format) when available.
- `doa` — the closing prayer text.

Every field is documented inline in the file itself.

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

## Deploying

⚠️ This checklist creates and modifies **real** Cloudflare resources
(database, bucket, secrets, a live Worker). Nothing in local development
(`npm run dev`, `npm test`, `npm run smoke`) touches any of this — it's
entirely separate. Do this only when you're actually ready to go live, in
order, on a machine with `wrangler` logged into the right Cloudflare
account (`npx wrangler login`).

**A note on the Cloudflare API token**: `wrangler`'s OAuth login (`wrangler
login`) is enough for everything below — you don't need a separately
issued API token for any of this. If you *are* using an API token instead
(e.g. in CI), it needs **D1 (edit)**, **R2 (edit)**, and **Workers Scripts
(edit)** permissions at minimum; a token scoped to only `user:read` (a
common default for a freshly created token) can authenticate but can't
create or write to any of the resources below, which is why, before this
checklist has been run, no remote D1 database or R2 bucket exists yet.

1. **Create the D1 database**:
   ```bash
   npx wrangler d1 create wedding-card-db
   ```
   Copy the `database_id` this prints into `wrangler.jsonc`'s
   `d1_databases[0].database_id` — it currently holds a LOCAL-ONLY
   placeholder (see the comment above it in that file) that only Miniflare
   uses to key its local SQLite store; it is not a real remote database id.

2. **Create the R2 bucket**:
   ```bash
   npx wrangler r2 bucket create wedding-card-assets
   ```

3. **Regenerate the Cloudflare env types** (picks up any binding changes):
   ```bash
   npm run cf-typegen
   ```

4. **Set the production secrets** — never reuse the values from your local
   `.dev.vars`, and generate each with a real random-bytes source:
   ```bash
   openssl rand -base64 32 | npx wrangler secret put ANALYTICS_SALT
   openssl rand -base64 32 | npx wrangler secret put CRON_SECRET
   ```
   These are the only two app secrets that exist today (see
   `.dev.vars.example` and `src/types/cloudflare-env.d.ts`). There is no
   `SESSION_SECRET`: admin sessions are plain cryptographically-random
   tokens, SHA-256-hashed before being stored in D1 (`src/lib/session.ts`)
   — there's no HMAC secret involved in issuing or checking one, so there's
   nothing by that name to provision. See `SECURITY.md` for what actually
   happens if you need to invalidate every admin session.

5. **Run migrations against the remote database**:
   ```bash
   npm run db:migrate:remote
   ```

6. **Seed the first admin user, on the remote database**:
   ```bash
   npm run seed:admin -- --remote
   ```

7. **Deploy**:
   ```bash
   npm run deploy
   ```
   This runs `opennextjs-cloudflare build` then `opennextjs-cloudflare
   deploy`. Verify the printed `*.workers.dev` URL loads before doing
   anything else.

8. **Attach a custom domain** (Cloudflare dashboard → Workers & Pages → this
   worker → Settings → Domains & Routes → Add), then update `siteUrl` in
   `src/config/wedding.ts` to that domain and redeploy (`npm run deploy`) —
   it feeds OG tags and every absolute URL the card generates.

9. **Set `wedding.gaMeasurementId`** in `src/config/wedding.ts` to a real
   `"G-XXXXXXXXXX"` Measurement ID if you want Google Analytics (optional —
   see "Google Analytics (optional)" above), then redeploy.

10. **Schedule the cron endpoint** (analytics rollup + housekeeping — see
    "Analytics" above for why this isn't a native Cloudflare Cron Trigger on
    THIS worker). Any scheduler that can make an authenticated HTTPS POST
    once a day works. The simplest is a tiny, separate Worker whose only job
    is to be woken by a real Cron Trigger and call this app's endpoint —
    e.g. in a new directory:
    ```jsonc
    // wrangler.jsonc for the separate cron worker
    {
      "name": "wedding-card-cron",
      "main": "index.js",
      "compatibility_date": "2026-09-03",
      "triggers": { "crons": ["0 18 * * *"] } // adjust to your timezone; this is ~2am MYT
    }
    ```
    ```js
    // index.js
    export default {
      async scheduled(event, env, ctx) {
        await fetch("https://<your-domain>/api/cron/rollup", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
        });
      },
    };
    ```
    deployed with its own `npx wrangler deploy` (with its own `CRON_SECRET`
    set to the same value via `wrangler secret put`, in that worker) — or
    use any external scheduler capable of an authenticated POST (a GitHub
    Actions scheduled workflow, cron-job.org, etc.) instead of a second
    Worker at all. This step is optional in the sense that
    `/admin/analytics` opportunistically backfills missing days on its own
    — see the "Analytics" section — but real cron keeps
    `rate_limits`/`sessions` pruned and is a five-minute setup.

After step 7, re-run `npm run smoke` against the deployed URL
(`SMOKE_BASE_URL=https://<your-domain> npm run smoke`) to confirm the live
deployment behaves the same as local dev did.
