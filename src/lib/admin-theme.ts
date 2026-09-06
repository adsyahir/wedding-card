/**
 * Admin dashboard colour theme (light / dark).
 *
 * Mirrors the language preference in `src/lib/i18n/admin-dict.ts` exactly,
 * for the same reason: several family members may share one admin login,
 * so a cookie gives each of them their own choice on their own device
 * where a column on `admin_users` would force one on everybody.
 *
 * PUBLIC CARD IS UNAFFECTED. The invitation is a printed-card aesthetic
 * and stays light for every guest; this only ever re-tints the admin
 * subtree, via a `data-admin-theme` attribute the dark palette is scoped
 * to (see globals.css).
 *
 * Not security-sensitive: it selects a stylesheet branch, nothing more. So
 * no `__Host-` prefix (reserved here for the session and CSRF cookies) and
 * readable by client JS, since the toggle sets it directly.
 */

export const ADMIN_THEME_COOKIE_NAME = "wc_admin_theme";
export const ADMIN_THEME_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export type AdminTheme = "light" | "dark";

const VALID_THEMES: readonly AdminTheme[] = ["light", "dark"];

/**
 * Never trust the raw cookie: anything that is not exactly "light" or
 * "dark" falls back to light. The value is stamped into a DOM attribute
 * that a CSS selector keys off, so an unvalidated value has no business
 * getting through.
 */
export function parseAdminTheme(value: string | null | undefined): AdminTheme {
  return VALID_THEMES.includes(value as AdminTheme) ? (value as AdminTheme) : "light";
}
