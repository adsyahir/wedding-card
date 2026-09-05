import { ImageResponse } from "next/og";

import { wedding } from "@/config/wedding";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${wedding.groom.shortName} & ${wedding.bride.shortName} — Walimatul Urus`;

export default function OpengraphImage() {
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
