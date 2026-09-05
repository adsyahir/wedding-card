import Link from "next/link";

import { getDashboardStats, listPendingWishesPreview } from "@/db/queries/admin";
import { requireAdmin } from "@/lib/auth";

import { formatDateTime } from "./_components/format";
import { StatCard } from "./_components/StatCard";
import { WishActions } from "./_components/WishActions";

// Never statically optimized/cached — every request must actually run the
// guard below and fetch fresh stats.
export const dynamic = "force-dynamic";

/**
 * The admin dashboard's overview page: aggregate stats plus a short queue of
 * pending ucapan that can be approved/rejected right here without leaving
 * the page.
 */
export default async function AdminHomePage() {
  // Defense in depth: the `(protected)` layout already calls `requireAdmin()`,
  // but every page under it calls it again independently — never rely on the
  // layout's call alone.
  await requireAdmin();

  const [stats, pendingPreview] = await Promise.all([
    getDashboardStats(),
    listPendingWishesPreview(5),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="font-serif text-2xl text-brown-deep mb-4">Ringkasan</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Hadir" value={stats.rsvpHadir} />
          <StatCard label="Tidak Hadir" value={stats.rsvpTidakHadir} />
          <StatCard label="Jumlah Dewasa" value={stats.totalDewasa} />
          <StatCard label="Jumlah Kanak-Kanak" value={stats.totalKanakKanak} />
          <StatCard label="Jumlah Pax" value={stats.totalPax} emphasize />
          <StatCard
            label="Ucapan Menunggu"
            value={stats.wishesPending}
            emphasize={stats.wishesPending > 0}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl text-brown-deep">Ucapan terkini menunggu semakan</h2>
          <Link href="/admin/ucapan" className="text-sm text-goldenrod underline">
            Lihat semua
          </Link>
        </div>

        {pendingPreview.length === 0 ? (
          <p className="rounded-xl border border-tan/30 bg-sand/40 px-4 py-6 text-center text-sm text-brown/60">
            Tiada ucapan menunggu semakan.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingPreview.map((wish) => (
              <li
                key={wish.id}
                className="flex flex-col gap-2 rounded-xl border border-tan/30 bg-sand/40 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-medium text-brown-deep">{wish.name}</p>
                  <p className="mt-1 text-sm text-brown/80">{wish.message}</p>
                  <p className="mt-1 text-xs text-brown/50">{formatDateTime(wish.createdAt)}</p>
                </div>
                <WishActions id={wish.id} status={wish.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
