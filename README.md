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

## Getting started

Edit `src/config/wedding.ts` to set the real wedding details — names, date,
venue, contacts, etc. Nothing else needs to change to update the card's
content.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Background music

Drop an MP3 at `public/music/preset-1.mp3` to enable the bundled preset
background track. If that file is absent, `getActiveMusicSrc()`
(`src/db/queries/public.ts`) returns `null` and the music toggle simply
doesn't render — no broken player, no 404. An admin can later override the
active track via the `site_settings` row `active_music_track` (`"none"` to
disable, an uploaded track id to point at `/api/music/<id>`).
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

### Background music

`wedding.presetMusicPath` in `src/config/wedding.ts` declares the bundled
track. It ships as `null`, so no player and no mute toggle are rendered.
Drop an MP3 into `public/music/` and set the value (e.g.
`"/music/preset-1.mp3"`) to enable it. The track never autoplays — it starts
only when a guest taps **BUKA** on the envelope, and the mute choice is
remembered per device.

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

## Cloudflare setup

Before deploying, create the real D1 database and R2 bucket and update the
placeholders in `wrangler.jsonc`:

```bash
npx wrangler d1 create wedding-card-db
npx wrangler r2 bucket create wedding-card-assets
```

Copy the returned `database_id` into `wrangler.jsonc`, then run
`npm run cf-typegen` to refresh the generated environment types.
