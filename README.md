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

## Cloudflare setup

Before deploying, create the real D1 database and R2 bucket and update the
placeholders in `wrangler.jsonc`:

```bash
npx wrangler d1 create wedding-card-db
npx wrangler r2 bucket create wedding-card-assets
```

Copy the returned `database_id` into `wrangler.jsonc`, then run
`npm run cf-typegen` to refresh the generated environment types.
