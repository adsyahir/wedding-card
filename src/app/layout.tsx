import type { Metadata } from "next";
import { Cormorant_Garamond, Jost, Parisienne } from "next/font/google";

import { getWeddingConfig } from "@/lib/wedding-config";

import "./globals.css";

const script = Parisienne({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-parisienne",
  display: "swap",
});

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const sans = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

// `metadata` doesn't support being async directly, but Next.js's App Router
// DOES support exporting a `generateMetadata` function instead — used here
// so the title/description reflect any admin-saved names/date/venue rather
// than only ever the file defaults. `siteUrl` stays file-only (not
// admin-editable — see `src/lib/wedding-config.ts`).
export async function generateMetadata(): Promise<Metadata> {
  const config = await getWeddingConfig();
  const title = `${config.groom.shortName} & ${config.bride.shortName} — Walimatul Urus`;
  const description = `Jemputan perkahwinan ${config.groom.shortName} & ${config.bride.shortName}, ${config.dayNameMs} ${config.displayDate} di ${config.venue.name}.`;

  return {
    metadataBase: new URL(config.siteUrl),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ms_MY",
      siteName: title,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ms"
      className={`h-full antialiased ${script.variable} ${serif.variable} ${sans.variable}`}
    >
      <head>
        {/* Reveal-on-scroll elements are server-rendered with an inline
            opacity:0 that only JavaScript clears. If JS never runs, force
            them visible so the invitation is still readable — content
            must never depend on scripts to be seen. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1 !important;transform:none !important}`}</style>
        </noscript>
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
