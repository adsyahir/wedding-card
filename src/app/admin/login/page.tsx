import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/auth";

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
 */
export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-2xl border border-tan/40 bg-sand/60 p-8 shadow-sm">
        <h1 className="font-serif text-2xl text-brown-deep text-center mb-1">Log Masuk Admin</h1>
        <p className="text-sm text-brown/70 text-center mb-6">Panel pentadbiran kad jemputan</p>
        <LoginForm />
      </div>
    </main>
  );
}
