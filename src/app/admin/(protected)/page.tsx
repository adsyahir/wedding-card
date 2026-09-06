import Link from "next/link";

import { getDashboardStats, listPendingWishesPreview } from "@/db/queries/admin";
import { requireAdmin } from "@/lib/auth";
import { getAdminDict, getAdminLang } from "@/lib/i18n/admin";

import { formatDateTime } from "./_components/format";
import { getWeddingConfig } from "@/lib/wedding-config";

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
  // but every page under it calls it again independently — never rely on
  // the layout's call alone.
  await requireAdmin();

  const lang = await getAdminLang();
  const dict = getAdminDict(lang);

  const [stats, pendingPreview, config] = await Promise.all([
    getDashboardStats(),
    listPendingWishesPreview(5),
    getWeddingConfig(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="font-serif text-2xl text-brown-deep mb-4">{dict.dashboard_heading}</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label={dict.dashboard_statHadir} value={stats.rsvpHadir} />
          <StatCard label={dict.dashboard_statTidakHadir} value={stats.rsvpTidakHadir} />
          {/*
            Headcount cards follow the admin's `rsvpPaxMode`. Showing
            "Jumlah Dewasa: 0" when the form never asked how many adults
            are coming is not a neutral zero — it reads as "nobody is
            bringing adults", which is a different and wrong statement.
          */}
          {config.rsvpPaxMode === "adultsChildren" && (
            <>
              <StatCard label={dict.dashboard_statJumlahDewasa} value={stats.totalDewasa} />
              <StatCard
                label={dict.dashboard_statJumlahKanakKanak}
                value={stats.totalKanakKanak}
              />
            </>
          )}
          {config.rsvpPaxMode !== "none" && (
            <StatCard label={dict.dashboard_statJumlahPax} value={stats.totalPax} emphasize />
          )}
          <StatCard
            label={dict.dashboard_statUcapanMenunggu}
            value={stats.wishesPending}
            emphasize={stats.wishesPending > 0}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl text-brown-deep">{dict.dashboard_recentWishesHeading}</h2>
          <Link href="/admin/ucapan" className="text-sm text-goldenrod underline">
            {dict.dashboard_viewAll}
          </Link>
        </div>

        {pendingPreview.length === 0 ? (
          <p className="rounded-xl border border-tan/30 bg-sand/40 px-4 py-6 text-center text-sm text-brown/60">
            {dict.dashboard_emptyPending}
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
                  <p className="mt-1 text-xs text-brown/50">
                    {formatDateTime(wish.createdAt, lang)}
                  </p>
                </div>
                <WishActions id={wish.id} status={wish.status} dict={dict} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
