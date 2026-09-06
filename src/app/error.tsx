"use client";

import { useEffect } from "react";

/**
 * The App Router error boundary for everything under the root layout
 * (i.e. the public invite page and anything else outside `/admin`, which
 * has its own boundary — see `src/app/admin/(protected)/error.tsx`).
 *
 * Next.js requires this to be a Client Component. It renders below the root
 * layout, so `<html>`/`<body>`/fonts from `src/app/layout.tsx` are still
 * intact — unlike `src/app/global-error.tsx`, which only fires when the
 * root layout ITSELF throws and must render its own `<html>`/`<body>`.
 *
 * SECURITY: `error.message` and `error.digest` are NEVER rendered into the
 * DOM here — a stack trace or internal exception message is not something
 * a guest should ever see. The error itself was already logged server-side
 * by Next.js's own rendering pipeline before this boundary ever mounts;
 * the `console.error` below is purely a convenience echo for whoever has
 * the browser console open during local testing, not a substitute for
 * server-side logging.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Public page error boundary caught:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-cream px-6 text-center">
      <p className="font-script text-4xl text-goldenrod">Ops.</p>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl text-brown-deep">Maaf, berlaku ralat.</h1>
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
    </main>
  );
}
