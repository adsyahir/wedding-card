import type { Metadata } from "next";

import { countPendingWishes } from "@/db/queries/admin";
import { wedding } from "@/config/wedding";
import { requireAdmin } from "@/lib/auth";

import { AdminNav } from "./AdminNav";
import { LogoutButton } from "./LogoutButton";

// Never statically optimized/cached — every request must actually run the
// guard below.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Guards every route under `src/app/admin/(protected)/*` (this route group
 * excludes `/admin/login`, which sits outside it — see that page for why).
 *
 * `requireAdmin()` is the actual security boundary: it validates the
 * session against the database and redirects to `/admin/login` if it's
 * missing/invalid/expired. `src/middleware.ts` also redirects unauthenticated
 * `/admin/*` requests, but only as a fast, unauthenticated-looking UX
 * shortcut — it never validates the token, so this call is required
 * regardless of what middleware does.
 *
 * Every page inside this group ALSO calls `requireAdmin()` itself (defense
 * in depth — never rely on the layout's call alone) — see
 * `src/app/admin/(protected)/page.tsx`, `.../rsvp/page.tsx`,
 * `.../ucapan/page.tsx`.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  // Best-effort — a stats query failing must never take down the entire
  // dashboard shell. Falls back to 0 (no badge) rather than throwing.
  let pendingWishCount = 0;
  try {
    pendingWishCount = await countPendingWishes();
  } catch (error) {
    console.error("ProtectedAdminLayout: countPendingWishes failed", error);
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-10 border-b border-tan/40 bg-sand/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <div>
              <p className="font-serif text-lg leading-tight text-brown-deep">
                {wedding.groom.shortName} &amp; {wedding.bride.shortName}
              </p>
              <p className="text-xs text-brown/60">{wedding.hashtag}</p>
            </div>
            <AdminNav pendingWishCount={pendingWishCount} />
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
