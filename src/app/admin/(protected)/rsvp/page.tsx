import Link from "next/link";

import { listRsvps, resolveSort, type RsvpSortField } from "@/db/queries/admin";
import { requireAdmin } from "@/lib/auth";
import { getAdminDict, getAdminLang, interpolate } from "@/lib/i18n/admin";

import { formatDateTime } from "../_components/format";
import { RsvpDeleteButton } from "../_components/RsvpDeleteButton";

// Never statically optimized/cached — every request must actually run the
// guard below and read fresh data.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Builds `/admin/rsvp?...` from `base`, applying `overrides` (a value of `undefined` removes that param). */
function buildHref(base: URLSearchParams, overrides: Record<string, string | undefined>): string {
  const params = new URLSearchParams(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `/admin/rsvp?${qs}` : "/admin/rsvp";
}

/**
 * The RSVP admin list: search, an attending filter, sortable headers, and
 * pagination — all state lives in the URL query string (never client-side
 * component state), which is what keeps this a plain server component and
 * every view shareable/bookmarkable/back-button-safe.
 */
export default async function AdminRsvpPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Defense in depth — see the comment on the layout for why this call is
  // required here too, not just there.
  await requireAdmin();

  const lang = await getAdminLang();
  const dict = getAdminDict(lang);

  const sp = await searchParams;
  const q = first(sp.q)?.trim() ?? "";
  const attendingParam = first(sp.attending);
  const attending =
    attendingParam === "hadir" ? true : attendingParam === "tidak" ? false : undefined;

  const rawPage = Number(first(sp.page));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const { sort: activeSort, direction: activeDirection } = resolveSort({
    sort: first(sp.sort),
    direction: first(sp.direction),
  });

  const { rows, total, perPage, page: currentPage } = await listRsvps({
    search: q || undefined,
    attending,
    sort: activeSort,
    direction: activeDirection,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const fullBase = new URLSearchParams();
  if (q) fullBase.set("q", q);
  if (attendingParam) fullBase.set("attending", attendingParam);
  fullBase.set("sort", activeSort);
  fullBase.set("direction", activeDirection);

  function sortHref(field: RsvpSortField): string {
    const nextDirection = activeSort === field && activeDirection === "asc" ? "desc" : "asc";
    return buildHref(fullBase, { sort: field, direction: nextDirection, page: undefined });
  }

  function sortIndicator(field: RsvpSortField): string {
    if (activeSort !== field) return "";
    return activeDirection === "asc" ? " ▲" : " ▼";
  }

  function pageHref(p: number): string {
    return buildHref(fullBase, { page: p > 1 ? String(p) : undefined });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-brown-deep">{dict.rsvp_heading}</h1>
        <a
          href="/api/admin/rsvp/export"
          className="rounded-lg bg-goldenrod px-4 py-2 text-sm font-medium text-cream transition hover:bg-brown"
        >
          {dict.rsvp_downloadCsv}
        </a>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder={dict.rsvp_searchPlaceholder}
          className="min-w-[14rem] flex-1 rounded-lg border border-tan/50 bg-cream px-3 py-2 text-sm text-brown-deep outline-none focus-visible:border-goldenrod"
        />
        <select
          name="attending"
          defaultValue={attendingParam ?? ""}
          className="rounded-lg border border-tan/50 bg-cream px-3 py-2 text-sm text-brown-deep outline-none focus-visible:border-goldenrod"
        >
          <option value="">{dict.rsvp_filterAll}</option>
          <option value="hadir">{dict.rsvp_filterHadir}</option>
          <option value="tidak">{dict.rsvp_filterTidak}</option>
        </select>
        <input type="hidden" name="sort" value={activeSort} />
        <input type="hidden" name="direction" value={activeDirection} />
        <button
          type="submit"
          className="rounded-lg border border-tan/50 bg-sand/60 px-4 py-2 text-sm font-medium text-brown-deep transition hover:bg-tan/30"
        >
          {dict.rsvp_filterSubmit}
        </button>
      </form>

      <p className="text-sm text-brown/60">{interpolate(dict.rsvp_recordCount, { n: total })}</p>

      <div className="overflow-x-auto rounded-xl border border-tan/30">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-tan/30 bg-sand/60 text-brown-deep">
              <th className="px-3 py-2 font-medium">
                <Link href={sortHref("name")} className="hover:underline">
                  {dict.rsvp_colName}
                  {sortIndicator("name")}
                </Link>
              </th>
              <th className="px-3 py-2 font-medium">{dict.rsvp_colPhone}</th>
              <th className="px-3 py-2 font-medium">{dict.rsvp_colAttending}</th>
              <th className="px-3 py-2 font-medium">
                <Link href={sortHref("adults")} className="hover:underline">
                  {dict.rsvp_colAdults}
                  {sortIndicator("adults")}
                </Link>
              </th>
              <th className="px-3 py-2 font-medium">{dict.rsvp_colChildren}</th>
              <th className="px-3 py-2 font-medium">{dict.rsvp_colMessage}</th>
              <th className="px-3 py-2 font-medium">
                <Link href={sortHref("createdAt")} className="hover:underline">
                  {dict.rsvp_colDate}
                  {sortIndicator("createdAt")}
                </Link>
              </th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-brown/60">
                  {dict.rsvp_emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-tan/20 align-top">
                  <td className="px-3 py-2 text-brown-deep">{row.name}</td>
                  <td className="px-3 py-2">
                    <a href={`tel:${row.phone}`} className="text-brown-deep underline">
                      {row.phone}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        row.attending
                          ? "rounded-full bg-goldenrod/15 px-2 py-0.5 text-xs font-medium text-brown-deep"
                          : "rounded-full bg-tan/20 px-2 py-0.5 text-xs font-medium text-brown/70"
                      }
                    >
                      {row.attending ? dict.rsvp_filterHadir : dict.rsvp_filterTidak}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.adults}</td>
                  <td className="px-3 py-2">{row.children}</td>
                  <td className="max-w-[16rem] px-3 py-2 text-brown/80">{row.message ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDateTime(row.createdAt, lang)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RsvpDeleteButton id={row.id} dict={dict} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-brown/70">
        <Link
          href={pageHref(Math.max(1, currentPage - 1))}
          aria-disabled={currentPage <= 1}
          className={currentPage <= 1 ? "pointer-events-none opacity-40" : "underline"}
        >
          {dict.common_prev}
        </Link>
        <span>{interpolate(dict.common_pageLabel, { page: currentPage, total: totalPages })}</span>
        <Link
          href={pageHref(Math.min(totalPages, currentPage + 1))}
          aria-disabled={currentPage >= totalPages}
          className={currentPage >= totalPages ? "pointer-events-none opacity-40" : "underline"}
        >
          {dict.common_next}
        </Link>
      </div>
    </div>
  );
}
