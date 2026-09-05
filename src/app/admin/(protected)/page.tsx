import { getAdminSession } from "@/lib/auth";

import { LogoutButton } from "./LogoutButton";

/**
 * Placeholder admin home. Proves the guard works — reaching this page at
 * all means `(protected)/layout.tsx`'s `requireAdmin()` call succeeded.
 * Phase 5 replaces this body with the real dashboard (RSVP list, ucapan
 * moderation, stats).
 */
export default async function AdminHomePage() {
  // Already validated by the layout; re-reading here is just to display
  // the signed-in id, not a second security check.
  const session = await getAdminSession();

  return (
    <main className="min-h-screen bg-cream px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-3xl text-brown-deep mb-2">Panel Admin</h1>
        <p className="text-brown/70 mb-8">
          Log masuk sebagai <span className="font-medium">{session?.adminUserId}</span>.
        </p>
        <LogoutButton />
      </div>
    </main>
  );
}
