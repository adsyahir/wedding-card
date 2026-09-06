import { GoogleAnalytics } from "@next/third-parties/google";

import { wedding } from "@/config/wedding";
import {
  getActiveMusicSrc,
  getApprovedWishes,
  getAttendanceCounts,
  getGalleryImages,
} from "@/db/queries/public";
import { getWeddingConfig } from "@/lib/wedding-config";

import { ClosedNotice } from "@/components/invite/ClosedNotice";
import { InviteApp } from "@/components/invite/InviteApp";

// This page reads live, per-request data (approved wishes, attendance
// counts, the active music track, the admin-editable wedding config) via
// Cloudflare bindings — it must never be statically prerendered at build
// time, which would bake in stale/empty data (and would also make
// `getCloudflareContext`'s sync D1 access throw, since that API only
// supports sync mode for genuinely dynamic routes).
export const dynamic = "force-dynamic";

export default async function Home() {
  const config = await getWeddingConfig();

  // Checked before anything else: when the invitation is closed, none of
  // the guest data is queried at all, rather than fetched and then hidden.
  if (config.siteMode !== "live") {
    return <ClosedNotice config={config} />;
  }

  const { sections } = config;

  // A hidden section isn't just hidden with CSS — its data isn't even
  // fetched. In particular, `getAttendanceCounts()` must not run at all
  // when `kehadiran` is off.
  const [wishes, counts, musicSrc, gallery] = await Promise.all([
    sections.ucapan ? getApprovedWishes() : Promise.resolve([]),
    sections.kehadiran ? getAttendanceCounts() : Promise.resolve(null),
    getActiveMusicSrc(),
    // A hidden `galeri` section isn't just hidden with CSS — its data
    // isn't even fetched (same rule as `kehadiran`/`ucapan` above).
    sections.galeri ? getGalleryImages() : Promise.resolve([]),
  ]);

  return (
    <main className="min-h-screen w-full">
      <InviteApp
        config={config}
        sections={sections}
        wishes={wishes}
        initialCounts={counts}
        musicSrc={musicSrc}
        gallery={gallery}
      />
      {/*
        Rendered ONLY here, on the public invite page — never in the
        /admin tree (which has its own, entirely separate page files that
        never import this one). Gated on a configured measurement id so a
        fresh clone of this repo never phones home to Google by default.
        `gaMeasurementId` is file-only (not admin-editable), so it's read
        straight from `wedding`, not the resolved config.
      */}
      {wedding.gaMeasurementId && <GoogleAnalytics gaId={wedding.gaMeasurementId} />}
    </main>
  );
}
