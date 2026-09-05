import Link from "next/link";

import { listWishes, type WishStatus } from "@/db/queries/admin";
import { requireAdmin } from "@/lib/auth";

import { formatDateTime } from "../_components/format";
import { WishActions } from "../_components/WishActions";

// Never statically optimized/cached — every request must actually run the
// guard below and read fresh data.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const TABS: { status: WishStatus; label: string }[] = [
  { status: "pending", label: "Menunggu" },
  { status: "approved", label: "Diluluskan" },
  { status: "rejected", label: "Ditolak" },
];

function isWishStatus(value: string | undefined): value is WishStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

/**
 * Ucapan moderation queue. Defaults to the `pending` tab — the whole point
 * of this page is the moderation backlog, not a general-purpose ucapan
 * browser.
 */
export default async function AdminUcapanPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Defense in depth — see the comment on the layout for why this call is
  // required here too, not just there.
  await requireAdmin();

  const sp = await searchParams;
  const statusParam = first(sp.status);
  const status: WishStatus = isWishStatus(statusParam) ? statusParam : "pending";

  const rawPage = Number(first(sp.page));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const { rows, total, perPage, page: currentPage } = await listWishes({ status, page });
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  function tabHref(tabStatus: WishStatus): string {
    return `/admin/ucapan?status=${tabStatus}`;
  }

  function pageHref(p: number): string {
    const params = new URLSearchParams({ status });
    if (p > 1) params.set("page", String(p));
    return `/admin/ucapan?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-2xl text-brown-deep">Ucapan</h1>

      <p className="rounded-lg border border-tan/30 bg-sand/40 px-3 py-2 text-sm text-brown/70">
        Hanya ucapan berstatus <span className="font-medium text-brown-deep">Diluluskan</span> dipaparkan
        di laman jemputan awam. Ucapan yang menunggu semakan tidak kelihatan kepada tetamu.
      </p>

      <nav className="flex items-center gap-1 border-b border-tan/30">
        {TABS.map((tab) => {
          const isActive = tab.status === status;
          return (
            <Link
              key={tab.status}
              href={tabHref(tab.status)}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-b-2 border-goldenrod text-brown-deep"
                  : "text-brown/60 hover:text-brown-deep"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <p className="text-sm text-brown/60">{total} rekod</p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-tan/30 bg-sand/40 px-4 py-8 text-center text-sm text-brown/60">
          Tiada ucapan dalam kategori ini.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((wish) => (
            <li
              key={wish.id}
              className="flex flex-col gap-2 rounded-xl border border-tan/30 bg-sand/40 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="font-medium text-brown-deep">{wish.name}</p>
                <p className="mt-1 text-sm text-brown/80">{wish.message}</p>
                <p className="mt-1 text-xs text-brown/50">
                  Dihantar {formatDateTime(wish.createdAt)}
                  {wish.moderatedAt && ` · Disemak ${formatDateTime(wish.moderatedAt)}`}
                </p>
              </div>
              <WishActions id={wish.id} status={wish.status} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between text-sm text-brown/70">
        <Link
          href={pageHref(Math.max(1, currentPage - 1))}
          aria-disabled={currentPage <= 1}
          className={currentPage <= 1 ? "pointer-events-none opacity-40" : "underline"}
        >
          &larr; Sebelum
        </Link>
        <span>
          Muka {currentPage} / {totalPages}
        </span>
        <Link
          href={pageHref(Math.min(totalPages, currentPage + 1))}
          aria-disabled={currentPage >= totalPages}
          className={currentPage >= totalPages ? "pointer-events-none opacity-40" : "underline"}
        >
          Seterusnya &rarr;
        </Link>
      </div>
    </div>
  );
}
