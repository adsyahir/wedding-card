"use client";

import { useRouter } from "next/navigation";

import {
  ADMIN_LANG_COOKIE_MAX_AGE_SECONDS,
  ADMIN_LANG_COOKIE_NAME,
  type AdminLang,
} from "@/lib/i18n/admin-dict";

const OPTIONS: { value: AdminLang; label: string }[] = [
  { value: "ms", label: "BM" },
  { value: "en", label: "EN" },
];

/**
 * The admin dashboard's Bahasa Melayu / English toggle: a small segmented
 * control that writes the `wc_admin_lang` cookie directly from the client
 * (no API route needed — this preference isn't security-sensitive, see
 * `src/lib/i18n/admin-dict.ts`) and then `router.refresh()`s so every
 * server component down the tree re-reads the cookie and re-renders with
 * the new dictionary.
 */
export function LangToggle({ current }: { current: AdminLang }) {
  const router = useRouter();

  function select(lang: AdminLang) {
    if (lang === current) return;
    document.cookie = `${ADMIN_LANG_COOKIE_NAME}=${lang}; Path=/; Max-Age=${ADMIN_LANG_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Bahasa paparan pentadbiran / Admin display language"
      className="flex items-center gap-0.5 rounded-lg border border-tan/50 bg-cream p-0.5 text-xs font-medium"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={current === option.value}
          onClick={() => select(option.value)}
          className={`rounded-md px-2.5 py-1 transition ${
            current === option.value
              ? "bg-goldenrod text-cream"
              : "text-brown-deep hover:bg-tan/20"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
