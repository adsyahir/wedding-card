"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * The LAST-RESORT error boundary — only fires when the root layout itself
 * (`src/app/layout.tsx`) throws, so unlike `src/app/error.tsx` it must
 * render its own complete `<html>`/`<body>` (the layout that would
 * otherwise provide them is exactly what failed).
 *
 * Deliberately minimal and dependency-light: no `next/font` (a font load
 * failure is one plausible reason the root layout itself could throw), just
 * the Tailwind theme tokens from `globals.css` and system fonts. Same rule
 * as `src/app/error.tsx`: never render `error.message`/`error.digest` to
 * the guest, and the error is already logged server-side by Next.js's own
 * rendering pipeline before this ever mounts.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error boundary caught:", error);
  }, [error]);

  return (
    <html lang="ms">
      <body className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-cream px-6 text-center font-sans">
        <p className="text-4xl text-goldenrod" style={{ fontFamily: "cursive" }}>
          Ops.
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl text-brown-deep" style={{ fontFamily: "Georgia, serif" }}>
            Maaf, berlaku ralat.
          </h1>
          <p className="max-w-sm text-sm text-brown/70">
            Sesuatu tidak kena semasa memuatkan halaman ini. Sila cuba sekali lagi.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-goldenrod px-6 py-2.5 text-sm font-medium text-cream transition hover:bg-brown"
        >
          Cuba Lagi
        </button>
      </body>
    </html>
  );
}
