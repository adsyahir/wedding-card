import { ImageResponse } from "next/og";

import { wedding as weddingDefaults } from "@/config/wedding";
import { getWeddingConfig } from "@/lib/wedding-config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Reads the admin-resolved config via a Cloudflare/D1 binding, so — like
// every other page in this app that does the same — it must never be
// statically prerendered at build time (there is no D1 binding available
// then, and `getCloudflareContext`'s sync mode throws outside a genuinely
// dynamic route).
export const dynamic = "force-dynamic";
// Next.js's image-metadata convention requires `alt` to be a static string
// (unlike the default export, it cannot be async) — so this uses the file
// defaults rather than the admin-resolved config. A stale alt string on a
// renamed couple is a cosmetic, non-critical gap; the actual rendered image
// below always reflects the live, admin-saved config.
export const alt = `${weddingDefaults.groom.shortName} & ${weddingDefaults.bride.shortName} | Walimatul Urus`;

export default async function OpengraphImage() {
  const wedding = await getWeddingConfig();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAF6EF",
          border: "16px solid #C9A227",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: 8,
            color: "#6B4F2A",
            marginBottom: 24,
          }}
        >
          WALIMATUL URUS
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 110,
            color: "#3E2C18",
            fontStyle: "italic",
          }}
        >
          {wedding.groom.shortName}
          <span style={{ margin: "0 24px", color: "#C9A227" }}>&amp;</span>
          {wedding.bride.shortName}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 34,
            letterSpacing: 4,
            color: "#6B4F2A",
          }}
        >
          {wedding.dayNameMs}, {wedding.displayDate}
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 24,
            color: "#C9A473",
          }}
        >
          {wedding.venue.name}
        </div>
      </div>
    ),
    { ...size },
  );
}
