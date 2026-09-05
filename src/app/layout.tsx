import type { Metadata } from "next";
import { Cormorant_Garamond, Jost, Parisienne } from "next/font/google";

import { wedding } from "@/config/wedding";

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

const title = `${wedding.groom.shortName} & ${wedding.bride.shortName} — Walimatul Urus`;
const description = `Jemputan perkahwinan ${wedding.groom.shortName} & ${wedding.bride.shortName}, ${wedding.dayNameMs} ${wedding.displayDate} di ${wedding.venue.name}.`;
const siteUrl = "https://wedding-card-arif.pages.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ms"
      className={`h-full antialiased ${script.variable} ${serif.variable} ${sans.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
