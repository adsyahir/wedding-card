/**
 * The five self-hosted `next/font/google` families the admin can pick for
 * `--font-script` (Hero/Undangan/Lokasi/Footer names, venue, hashtag).
 *
 * Deliberately split out of `src/lib/wedding-config.ts` (which carries a
 * `server-only` import): this constant/type needs to be importable from the
 * CLIENT component that renders the dropdown
 * (`WeddingConfigSettings.tsx`'s `ButiranTab`), and a plain `import type`
 * doesn't help here because `SCRIPT_FONT_KEYS` needs to exist at RUNTIME
 * (to `.map()` over it) — a value import pulls in the whole module,
 * including its `server-only` guard.
 *
 * See `src/app/layout.tsx` (loads all five, sets `data-script-font` on
 * `<html>`) and `globals.css`'s `html[data-script-font=...]` rules.
 */
export const SCRIPT_FONT_KEYS = [
  "parisienne",
  "greatVibes",
  "dancingScript",
  "sacramento",
  "cormorantGaramond",
] as const;

export type ScriptFontKey = (typeof SCRIPT_FONT_KEYS)[number];
