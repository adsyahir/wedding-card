import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
 * Reads the `wc_admin_lang` cookie the same way every other admin page
 * does (see `src/lib/i18n/admin.ts`) — the language toggle lives in the
 * protected shell's header, but the preference is still readable (and
 * respected) here since it's just a cookie, set before login too.
 */
export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }

  const lang = await getAdminLang();
  const dict = getAdminDict(lang);

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-2xl border border-tan/40 bg-sand/60 p-8 shadow-sm">
        <h1 className="font-serif text-2xl text-brown-deep text-center mb-1">{dict.login_title}</h1>
        <p className="text-sm text-brown/70 text-center mb-6">{dict.login_subtitle}</p>
        <LoginForm dict={dict} />
      </div>
    </main>
  );
}
