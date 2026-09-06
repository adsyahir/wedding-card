# Deploying to production

Step by step, in order. Everything here creates or modifies **real**
Cloudflare resources and sends **real** email. Nothing in local development
(`npm run dev`, `npm test`, `npm run smoke`) touches any of it.

Before you start:

```bash
npx wrangler login
```

`wrangler`'s OAuth login is enough for every step below. If you use an API
token instead (CI, for example) it needs **D1 (edit)**, **R2 (edit)** and
**Workers Scripts (edit)**. A token scoped to `user:read` — a common default
for a freshly created one — authenticates fine but silently cannot create
anything.

---

## Part 1 — Content, before you touch Cloudflare

Get these right first. Several of them are baked into the build or into
emails that cannot be recalled once sent.

### 1.1 Wedding details

Edit `src/config/wedding.ts`. Everything in it is still placeholder:

| Field | Currently | Notes |
|---|---|---|
| `groom` / `bride` | Arif / Nur Aisyah | short name shows on the cover, full name in the invitation text |
| `date` | `2026-11-01T11:00:00+08:00` | keep the `+08:00` offset; the countdown and calendar links derive from it |
| `venue` | Dewan Serbaguna Taman Seri Indah | name and address drive the map when no Maps link is set |
| `venue.googleMapsUrl` | placeholder | use the **full** `google.com/maps/place/…` link, not a `maps.app.goo.gl` short link — short links carry no coordinates and cannot be read |
| `contacts` | Ahmad / Fatimah, `+60123456789` | these become WhatsApp buttons |
| `hashtag` | `#PlaceholderHashtag` | |
| `gallery` | three `.svg` placeholders | see 1.2 |

Most of this is also editable later from **Admin → Tetapan** without a
redeploy. The file is the fallback; the admin values win.

Four fields are **file-only** and are not in the admin UI: `siteUrl` (see
2.5), `presetMusicPath`, `gaMeasurementId` (see Part 4) and `gallery`.

### 1.2 Photos

Replace the placeholder SVGs in `public/images/gallery/` and update the
`gallery` array. Use **JPEG, not PNG** — these are photographs, and PNG will
be several times larger for no visible gain on a phone.

You can also skip the file entirely and upload photos through
**Admin → Tetapan → Galeri** after deploying, which stores them in R2.

### 1.3 Music

`public/music/` is empty and `presetMusicPath` is `null`, so "preset"
currently resolves to no track. Either drop an MP3 in and point
`presetMusicPath` at it, or upload one through **Admin → Tetapan → Muzik**
after deploying.

Use something the family has the right to play on a public page. A
commercial track on a public URL is a real licensing risk.

### 1.4 Verify locally

```bash
npm test        # 366 tests
npm run lint
npm run build
```

---

## Part 2 — Cloudflare resources

### 2.1 Create the D1 database

```bash
npx wrangler d1 create wedding-card-db
```

Copy the printed `database_id` into `wrangler.jsonc` →
`d1_databases[0].database_id`.

> The id currently in the file is a **local-only placeholder** that only
> Miniflare uses to key its local SQLite store. It is not a real remote
> database.

### 2.2 Create the R2 bucket

```bash
npx wrangler r2 bucket create wedding-card-assets
```

This holds uploaded music and gallery images. Without it, those uploads fail
at runtime.

### 2.3 Regenerate env types

```bash
npm run cf-typegen
```

Run this any time you change bindings or vars in `wrangler.jsonc`.

### 2.4 Set the production secrets

Generate fresh values. **Do not reuse anything from `.dev.vars`** — that file
is for local development and its values may have been in shell history,
screenshots, or this repo's working tree.

```bash
openssl rand -base64 32 | npx wrangler secret put ANALYTICS_SALT
openssl rand -base64 32 | npx wrangler secret put CRON_SECRET

npx wrangler secret put MAILJET_API_KEY
npx wrangler secret put MAILJET_API_SECRET
npx wrangler secret put MAILJET_SENDER_EMAIL   # no-reply@adsyahir.com
npx wrangler secret put MAILJET_SENDER_NAME    # Kad Jemputan Arif
```

Notes:

- **`ANALYTICS_SALT`** is the HMAC key behind the daily-rotating
  `visitor_hash`. Changing it later is harmless — it just means old rows stop
  correlating with new ones.
- **There is no `SESSION_SECRET`.** Admin sessions are random tokens, stored
  SHA-256-hashed in D1; no HMAC secret is involved, so there is nothing by
  that name to provision.
- **`MAILJET_SENDER_EMAIL` must be a validated Mailjet sender.** `adsyahir.com`
  is verified with SPF and DKIM both OK, so `no-reply@adsyahir.com` works. An
  unvalidated sender is silently dropped by Mailjet — it returns HTTP 200 and
  the mail never arrives.

### 2.5 Set `SITE_URL`

In `wrangler.jsonc`, under `vars`:

```jsonc
"vars": {
  "SITE_URL": "https://kahwin.adsyahir.com"
}
```

No trailing slash. This is what the **"Lihat senarai RSVP" links in every
notification email** point at, and what the WhatsApp share preview resolves
its image against. A wrong value here fails silently.

It is a plain `var`, not a secret: it ships in the worker bundle and is
visible in the dashboard, which is fine for a public hostname. It is
deliberately **not** derived from the request `Host`, because that header is
client-supplied and the RSVP notification is triggered by an anonymous public
POST — see `src/lib/site-url.ts`.

If you do not know the final domain yet, deploy with the `*.workers.dev` URL
and come back to this after 3.3.

### 2.6 Migrate the remote database

```bash
npm run db:migrate:remote
```

### 2.7 Create the first admin user

```bash
npm run seed:admin -- --remote
```

The password is read interactively with terminal echo off. It is never
accepted as an argument or an environment variable, so it never lands in
shell history or the process table.

---

## Part 3 — Deploy

### 3.1 Ship it

```bash
npm run deploy
```

Runs `opennextjs-cloudflare build` then `opennextjs-cloudflare deploy`.
Confirm the printed `*.workers.dev` URL loads before doing anything else.

### 3.2 Smoke test the live deployment

```bash
SMOKE_BASE_URL=https://<your-domain> npm run smoke
```

### 3.3 Attach the custom domain

Cloudflare dashboard → **Workers & Pages** → this worker → **Settings** →
**Domains & Routes** → **Add**.

Then update `SITE_URL` (2.5) to that domain and `npm run deploy` again. Until
you do, email links and the share preview still point at `*.workers.dev`.

---

## Part 4 — Google Analytics

Optional. The admin dashboard has its own first-party analytics that works
without any of this — GA4 is only worth adding if you want Google's reporting
too.

### 4.1 Create the property

1. [analytics.google.com](https://analytics.google.com) → **Admin** →
   **Create** → **Property**
2. Name it, set timezone **(GMT+08:00) Kuala Lumpur** and currency **MYR**
3. Platform → **Web**
4. Website URL → your custom domain. Stream name → anything
5. Copy the **Measurement ID**, format `G-XXXXXXXXXX`

### 4.2 Wire it in

`src/config/wedding.ts`:

```ts
gaMeasurementId: "G-XXXXXXXXXX",
```

Then redeploy:

```bash
npm run deploy
```

### 4.3 What this does, and does not, do

- GA is rendered **only on the public invitation page** (`src/app/page.tsx`),
  never on `/admin`. Your family's admin activity never reaches Google.
- The CSP in `src/middleware.ts` widens **conditionally on this value**: with
  it set, `script-src` gains `https://www.googletagmanager.com` and
  `connect-src` gains `https://*.google-analytics.com`. Left `null`, the CSP
  stays tighter. This is why GA cannot be switched on from the admin UI — the
  policy is computed at request time from the file value.
- It is **not** a substitute for `/admin/analytics`. That exists precisely
  because most of the family cannot be given a GA login.

### 4.4 Verify

Open the card, then GA4 → **Reports** → **Realtime**. You should appear within
about 30 seconds. If nothing shows, open the browser console and look for a
CSP violation naming `googletagmanager.com` — that means the ID is set
somewhere the middleware did not see, so redeploy.

---

## Part 5 — Email notifications

### 5.1 Turn them on

**Admin → Tetapan → Notifikasi** → enable, add recipient addresses, save.
Credentials alone send nothing: notifications stay off until there is at
least one recipient.

### 5.2 Test

Click **Hantar e-mel ujian**. The response distinguishes the failure modes:

| Result | Meaning |
|---|---|
| Success | Mailjet accepted **and** queued it |
| `no_recipients_configured` | Nothing saved in 5.1 |
| `mailjet_unconfigured` | Secrets missing — redo 2.4 |
| `mailjet_rejected` | Mailjet refused, almost always an unvalidated sender |
| `mailjet_network_error` | Could not reach Mailjet |

### 5.3 End to end

Submit a real RSVP on the public card and confirm the email arrives with a
working "Lihat senarai RSVP" link. That link is built from `SITE_URL`, so this
is also the check that 2.5 is right.

---

## Part 6 — Scheduled housekeeping

Optional but recommended, about five minutes.

`POST /api/cron/rollup` rolls raw `page_views` into `daily_stats` and prunes
rows older than 90 days, plus expired sessions and rate-limit entries. It is
a plain authenticated endpoint rather than a native Cron Trigger, because
OpenNext's generated worker exports only `fetch`, no `scheduled()` handler.

`/admin/analytics` backfills missing days on its own, so the dashboard works
without this. What you lose by skipping it is the **pruning** — raw analytics
rows accumulate forever.

Any scheduler that can make an authenticated HTTPS POST once a day works:
GitHub Actions on a schedule, cron-job.org, or a tiny second Worker:

```jsonc
// wrangler.jsonc for a separate cron worker
{
  "name": "wedding-card-cron",
  "main": "index.js",
  "compatibility_date": "2026-09-03",
  "triggers": { "crons": ["0 18 * * *"] }  // 18:00 UTC = 02:00 MYT
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

Deploy it with its own `npx wrangler deploy`, and set `CRON_SECRET` on **that**
worker to the same value you used in 2.4.

---

## Part 7 — Before sharing the link

- [ ] Card loads on a real phone, not just a desktop browser at narrow width
- [ ] Envelope opens, music plays after the tap, mute persists across reload
- [ ] Countdown, gallery, Google Maps and Waze links all work
- [ ] Map pin is the **right venue** — check the preview in Tetapan → Lokasi
- [ ] Submit a test RSVP, confirm it appears in Admin → RSVP
- [ ] Submit a test ucapan, confirm it does **not** appear publicly until approved
- [ ] Notification email arrives, and its links open the live admin
- [ ] `/admin` redirects to login when signed out
- [ ] Paste the URL into WhatsApp and check the share preview renders
- [ ] Clear the test data: `npm run guests:truncate -- --remote` (requires
      typing `PADAM`)

---

## Rollback

```bash
npx wrangler rollback
```

Reverts the Worker to the previous deployment. **It does not roll back D1
migrations** — those are forward-only, so a migration that has run stays run.

---

## Reference

| What | Where |
|---|---|
| Security model, threat notes | `SECURITY.md` |
| Local development, scripts | `README.md` |
| Moving settings between local and prod | `README.md` → "Moving settings" |
| Why `SITE_URL` is not derived from the request | `src/lib/site-url.ts` |
| Why cron is not a native trigger | `src/app/api/cron/rollup/route.ts` |
