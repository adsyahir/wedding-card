import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_THEME_COOKIE_NAME, parseAdminTheme } from "@/lib/admin-theme";
import { getAdminSession } from "@/lib/auth";
import { getAdminDict, getAdminLang } from "@/lib/i18n/admin";

import { LoginForm } from "./LoginForm";

// Never statically optimized/cached: whether a session already exists must
// be checked fresh on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Sits OUTSIDE the `(protected)` route group deliberately: the guarded
 * layout (`src/app/admin/(protected)/layout.tsx`) calls `requireAdmin()`,
 * which redirects HERE when there's no session — if this page were inside
 * that group too, an unauthenticated visit would redirect to itself
 * forever.
 *
 * Reads the `wc_admin_lang` and `wc_admin_theme` cookies the same way
 * every other admin page does — the toggles live in the protected shell,
 * but the preferences are plain cookies and are readable here too.
 *
 * The theme in particular has to be applied here. Both preferences persist
 * for a year and survive logout (which only clears the session and CSRF
 * cookies), but this page sat outside the `(protected)` layout that stamps
 * `data-admin-theme` — so logging out of a dark dashboard landed you on a
 * bright white login screen, which reads exactly like the preference
 * having been thrown away.
 */
export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }

  const lang = await getAdminLang();
  const dict = getAdminDict(lang);
  const theme = parseAdminTheme((await cookies()).get(ADMIN_THEME_COOKIE_NAME)?.value);

  return (
    <main
      data-admin-theme={theme}
      className="min-h-screen flex items-center justify-center bg-cream px-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-tan/40 bg-sand/60 p-8 shadow-sm">
        <h1 className="font-serif text-2xl text-brown-deep text-center mb-1">{dict.login_title}</h1>
        <p className="text-sm text-brown/70 text-center mb-6">{dict.login_subtitle}</p>
        <LoginForm dict={dict} />
      </div>
    </main>
  );
}
