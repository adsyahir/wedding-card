import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth";

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
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
