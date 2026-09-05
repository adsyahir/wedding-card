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
    </main>
  );
}
