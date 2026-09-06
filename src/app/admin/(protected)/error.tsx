"use client";

import { useEffect } from "react";

/**
 * Error boundary for everything under `/admin/(protected)/*`. Same rules as
 * `src/app/error.tsx`: never render `error.message`/`error.digest` to the
 * admin, and the underlying error is already logged server-side by Next.js
 * before this boundary mounts. Kept visually distinct from the public
 * error page only in that it doesn't try to look like the invite card —
 * this is a dashboard tool, not a guest-facing screen — but uses the same
 * palette for consistency.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin page error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-tan/30 bg-sand/40 px-6 py-16 text-center">
      <h1 className="font-serif text-xl text-brown-deep">Maaf, berlaku ralat.</h1>
      <p className="max-w-sm text-sm text-brown/70">
        Halaman pentadbiran ini gagal dimuatkan. Sila cuba sekali lagi, atau log masuk semula jika
        masalah berterusan.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-goldenrod px-6 py-2.5 text-sm font-medium text-cream transition hover:bg-brown"
      >
        Cuba Lagi
      </button>
    </div>
  );
}
