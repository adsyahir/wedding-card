"use client";

import { useEffect, useMemo } from "react";

import { ADMIN_LANG_COOKIE_NAME, getAdminDict, parseAdminLang } from "@/lib/i18n/admin-dict";

/**
 * Reads the `wc_admin_lang` cookie directly from `document.cookie` — this
 * boundary is mounted by Next.js with only `{ error, reset }` props, it
 * can't receive a `dict` prop from a parent server component the way every
 * other admin component here does. Never throws; an unreadable cookie
 * (or none at all) falls back to `"ms"` the same way the server-side
 * `getAdminLang()` does.
 */
function readAdminLangFromDocument(): "ms" | "en" {
  try {
    const cookies = document.cookie ? document.cookie.split("; ") : [];
    for (const entry of cookies) {
      const eq = entry.indexOf("=");
      if (eq === -1) continue;
      if (entry.slice(0, eq) === ADMIN_LANG_COOKIE_NAME) {
        return parseAdminLang(decodeURIComponent(entry.slice(eq + 1)));
      }
    }
    return "ms";
  } catch {
    return "ms";
  }
}

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

  const dict = useMemo(() => getAdminDict(readAdminLangFromDocument()), []);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-tan/30 bg-sand/40 px-6 py-16 text-center">
      <h1 className="font-serif text-xl text-brown-deep">{dict.errorBoundary_title}</h1>
      <p className="max-w-sm text-sm text-brown/70">{dict.errorBoundary_message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-goldenrod px-6 py-2.5 text-sm font-medium text-cream transition hover:bg-brown"
      >
        {dict.errorBoundary_retry}
      </button>
    </div>
  );
}
