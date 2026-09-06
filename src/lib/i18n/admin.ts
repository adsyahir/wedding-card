import "server-only";

import { cookies } from "next/headers";

import { ADMIN_LANG_COOKIE_NAME, parseAdminLang, type AdminLang } from "./admin-dict";

export * from "./admin-dict";

/**
 * Server-only: reads and validates the `wc_admin_lang` cookie via
 * `next/headers`. Defaults to `"ms"` when the cookie is missing or its
 * value fails validation (see `parseAdminLang` in `./admin-dict` for the
 * validation itself). Never throws — a cookie-store failure is treated the
 * same as "no preference set".
 */
export async function getAdminLang(): Promise<AdminLang> {
  try {
    const cookieStore = await cookies();
    return parseAdminLang(cookieStore.get(ADMIN_LANG_COOKIE_NAME)?.value);
  } catch (error) {
    console.error("getAdminLang failed", error);
    return "ms";
  }
}
