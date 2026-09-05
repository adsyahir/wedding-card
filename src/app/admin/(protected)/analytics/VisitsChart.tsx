"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ChartPoint = { day: string; views: number; uniques: number };

/**
 * Visits-over-time line chart. Admin-only, so Recharts' bundle size is a
 * non-issue (it never ships to the public invite page).
 *
 * Handles the empty state explicitly: a brand-new deployment (or a range
 * with genuinely zero traffic) renders a message instead of an empty/broken
 * chart — Recharts can render an empty `<LineChart>` without crashing, but
 * an axis with no data drawn across it reads as a bug, not "no traffic
 * yet".
 */
export function VisitsChart({ data }: { data: ChartPoint[] }) {
  const hasData = data.some((point) => point.views > 0 || point.uniques > 0);

  if (!hasData) {
    return (
      <p className="rounded-xl border border-tan/30 bg-sand/40 px-4 py-12 text-center text-sm text-brown/60">
        Tiada data lawatan lagi untuk tempoh ini.
      </p>
    );
  }

  return (
    <div className="h-72 w-full rounded-xl border border-tan/30 bg-sand/40 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#C9A473" strokeOpacity={0.35} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "#6B4F2A" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6B4F2A" }} tickLine={false} width={32} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #C9A473",
              background: "#FAF6EF",
            }}
            labelFormatter={(label) => `Hari: ${label}`}
          />
          <Line
            type="monotone"
            dataKey="views"
            name="Lawatan"
            stroke="#C9A227"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="uniques"
            name="Pelawat unik"
            stroke="#3E2C18"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
