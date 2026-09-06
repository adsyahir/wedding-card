import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Dancing_Script,
  Great_Vibes,
  Jost,
  Parisienne,
  Sacramento,
} from "next/font/google";

import { getWeddingConfig } from "@/lib/wedding-config";

import "./globals.css";

// Five self-hosted script/serif families the admin can choose between for
// `--font-script` (see globals.css's `html[data-script-font=...]` rules and
// `WeddingConfigSettings`'s Butiran-tab dropdown). `next/font/google`
// downloads and subsets each at BUILD time and serves it from this origin
// — no request to fonts.googleapis.com at runtime, so no CSP change is
// needed for these. Only the weight actually used (400) is loaded for the
// four script faces to keep the bundle cost of five families in check;
// Cormorant Garamond is already loaded below with the weights the serif
// body copy needs.
const script = Parisienne({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-parisienne",
  display: "swap",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-great-vibes",
  display: "swap",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dancing-script",
  display: "swap",
});

const sacramento = Sacramento({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sacramento",
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
// than only ever the file defaults. `siteUrl` is not admin-editable: it
// comes from the SITE_URL deployment var, falling back to the file default
// (see src/lib/site-url.ts).
export async function generateMetadata(): Promise<Metadata> {
  const config = await getWeddingConfig();
  const title = `${config.groom.shortName} & ${config.bride.shortName} | Walimatul Urus`;
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
    // A maintenance or post-event notice should not be what a search
    // engine has on file for this wedding.
    robots:
      config.siteMode === "live"
        ? { index: true, follow: true }
        : { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read once here (in addition to `generateMetadata` above — both are
  // cheap, cached-per-request reads of the same D1 row) so the chosen
  // script font is known at server-render time: `data-script-font` below
  // must be correct in the very first byte of HTML, or the invitation
  // would flash the wrong font as client JS reconciles it.
  const config = await getWeddingConfig();

  return (
    <html
      lang="ms"
      data-script-font={config.scriptFont}
      className={`h-full antialiased ${script.variable} ${serif.variable} ${sans.variable} ${greatVibes.variable} ${dancingScript.variable} ${sacramento.variable}`}
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
