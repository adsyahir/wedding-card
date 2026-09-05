import Link from "next/link";

import {
  getBrowserBreakdown,
  getDailyStatsInRange,
  getDeviceBreakdown,
  getLiveDayStats,
  getOsBreakdown,
  getRangeTotals,
  getReferrerBreakdown,
  getRsvpFunnel,
  getTopCities,
  getTopCountries,
  resolveDateRange,
  resolveRangeDays,
  type DailyPoint,
  type KeyCount,
  type RangeDays,
} from "@/db/queries/analytics";
import { backfillMissingDailyStats } from "@/lib/analytics-rollup";
import { requireAdmin } from "@/lib/auth";

import { StatCard } from "../_components/StatCard";
import { VisitsChart } from "./VisitsChart";

// Never statically optimized/cached — every request must actually run the
// guard below and read fresh data.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const RANGE_OPTIONS: { value: RangeDays; label: string }[] = [
  { value: 7, label: "7 hari" },
  { value: 30, label: "30 hari" },
  { value: 90, label: "90 hari" },
];

function rangeHref(range: RangeDays): string {
  return range === 30 ? "/admin/analytics" : `/admin/analytics?range=${range}`;
}

function percentage(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** A plain "key — count" list, used for the country/city/device/OS/browser breakdowns. */
function BreakdownList({
  rows,
  emptyLabel,
  formatKey,
}: {
  rows: KeyCount[];
  emptyLabel: string;
  formatKey?: (key: string) => string;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-brown/60">{emptyLabel}</p>;
  }

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <ul className="flex flex-col divide-y divide-tan/20">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
          <span className="text-brown-deep">{formatKey ? formatKey(row.key) : row.key}</span>
          <span className="tabular-nums text-brown/70">
            {row.count} <span className="text-brown/40">({percentage(row.count, total)})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-tan/30 bg-sand/40">
      <h2 className="border-b border-tan/30 px-4 py-2 font-serif text-lg text-brown-deep">{title}</h2>
      {children}
    </div>
  );
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Mudah alih",
  tablet: "Tablet",
  desktop: "Desktop",
};

/**
 * `/admin/analytics` — traffic and engagement dashboard for the invite.
 *
 * All range state lives in the `?range=` query string (7/30/90 days),
 * same convention as `/admin/rsvp`'s search/sort/page params — this stays
 * a plain server component and every view is shareable/bookmarkable.
 *
 * Before reading `daily_stats`, this OPPORTUNISTICALLY backfills any day
 * in the selected range that's missing a row (see
 * `backfillMissingDailyStats`) — see the README's "Analytics" section for
 * why: there's no Cloudflare Cron Trigger wired up in this app (see
 * `src/app/api/cron/rollup/route.ts` for why), so without this, the chart
 * would stay empty forever on a deployment that never calls that endpoint
 * on a schedule. This makes the dashboard work with zero scheduling setup,
 * at the cost of the aggregation running on an admin's page load instead
 * of a schedule — a fine trade for a low-traffic wedding invite.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Defense in depth — see the comment on the layout for why this call is
  // required here too, not just there.
  await requireAdmin();

  const sp = await searchParams;
  const rangeDays = resolveRangeDays(sp.range);
  const range = resolveDateRange(rangeDays);

  const historicalDays = range.days.filter((day) => day !== range.todayDay);
  await backfillMissingDailyStats(historicalDays);

  const yesterdayDay = historicalDays[historicalDays.length - 1];

  const [
    totals,
    historicalPoints,
    liveTodayPoint,
    topCountries,
    topCities,
    deviceBreakdown,
    osBreakdown,
    browserBreakdown,
    referrerBreakdown,
    funnel,
  ] = await Promise.all([
    getRangeTotals(range),
    yesterdayDay ? getDailyStatsInRange(range.startDay, yesterdayDay) : Promise.resolve<DailyPoint[]>([]),
    getLiveDayStats(range.todayDay),
    getTopCountries(range),
    getTopCities(range),
    getDeviceBreakdown(range),
    getOsBreakdown(range),
    getBrowserBreakdown(range),
    getReferrerBreakdown(range),
    getRsvpFunnel(range),
  ]);

  const chartData: DailyPoint[] = [...historicalPoints, liveTodayPoint];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-brown-deep">Analitik</h1>
        <div className="flex gap-1 rounded-lg border border-tan/40 bg-sand/40 p-1">
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={rangeHref(option.value)}
              aria-current={rangeDays === option.value ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                rangeDays === option.value
                  ? "bg-goldenrod text-cream"
                  : "text-brown-deep hover:bg-tan/20"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Jumlah Lawatan" value={totals.views} />
        <StatCard label="Pelawat Unik" value={totals.uniques} emphasize />
        <StatCard label="RSVP Dibuka" value={funnel.rsvpOpen} />
        <StatCard label="RSVP Dihantar" value={funnel.rsvpSubmit} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl text-brown-deep">Lawatan mengikut hari</h2>
        <VisitsChart data={chartData} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Negara teratas">
          <BreakdownList rows={topCountries} emptyLabel="Tiada data negara lagi." />
        </Panel>
        <Panel title="Bandar teratas">
          <BreakdownList rows={topCities} emptyLabel="Tiada data bandar lagi." />
        </Panel>
      </section>

      <section>
        <Panel title="Sumber rujukan (referrer)">
          {referrerBreakdown.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-brown/60">Tiada data rujukan lagi.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-tan/20">
              {referrerBreakdown.map((row) => {
                const total = referrerBreakdown.reduce((sum, r) => sum + r.count, 0);
                return (
                  <li
                    key={row.category}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                  >
                    <span className="text-brown-deep">{row.category}</span>
                    <span className="tabular-nums text-brown/70">
                      {row.count}{" "}
                      <span className="text-brown/40">({percentage(row.count, total)})</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Peranti">
          <BreakdownList
            rows={deviceBreakdown}
            emptyLabel="Tiada data peranti lagi."
            formatKey={(key) => DEVICE_LABELS[key] ?? key}
          />
        </Panel>
        <Panel title="Sistem operasi">
          <BreakdownList rows={osBreakdown} emptyLabel="Tiada data sistem operasi lagi." />
        </Panel>
        <Panel title="Pelayar">
          <BreakdownList rows={browserBreakdown} emptyLabel="Tiada data pelayar lagi." />
        </Panel>
      </section>

      <section>
        <Panel title="Corong penglibatan RSVP">
          <div className="flex flex-col divide-y divide-tan/20">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-brown-deep">Lawatan</span>
              <span className="tabular-nums text-brown/70">{funnel.views}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-brown-deep">RSVP dibuka</span>
              <span className="tabular-nums text-brown/70">
                {funnel.rsvpOpen}{" "}
                <span className="text-brown/40">({percentage(funnel.rsvpOpen, funnel.views)})</span>
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-brown-deep">RSVP dihantar</span>
              <span className="tabular-nums text-brown/70">
                {funnel.rsvpSubmit}{" "}
                <span className="text-brown/40">
                  ({percentage(funnel.rsvpSubmit, funnel.rsvpOpen)})
                </span>
              </span>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
