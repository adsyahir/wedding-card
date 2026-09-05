import { GoogleAnalytics } from "@next/third-parties/google";

import { wedding } from "@/config/wedding";
import { getActiveMusicSrc, getApprovedWishes, getAttendanceCounts } from "@/db/queries/public";

import { InviteApp } from "@/components/invite/InviteApp";

// This page reads live, per-request data (approved wishes, attendance
// counts, the active music track) via Cloudflare bindings — it must never
// be statically prerendered at build time, which would bake in stale/empty
// data (and would also make `getCloudflareContext`'s sync D1 access throw,
// since that API only supports sync mode for genuinely dynamic routes).
export const dynamic = "force-dynamic";

export default async function Home() {
  const [wishes, counts, musicSrc] = await Promise.all([
    getApprovedWishes(),
    getAttendanceCounts(),
    getActiveMusicSrc(),
  ]);

  return (
    <main className="min-h-screen w-full bg-sand">
      <InviteApp config={wedding} wishes={wishes} initialCounts={counts} musicSrc={musicSrc} />
      {/*
        Rendered ONLY here, on the public invite page — never in the
        /admin tree (which has its own, entirely separate page files that
        never import this one). Gated on a configured measurement id so a
        fresh clone of this repo never phones home to Google by default.
      */}
      {wedding.gaMeasurementId && <GoogleAnalytics gaId={wedding.gaMeasurementId} />}
    </main>
  );
}
