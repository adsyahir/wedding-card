import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Walimatul Urus",
  description: "Jemputan perkahwinan",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ms" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
