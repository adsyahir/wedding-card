import type { AdminLang } from "@/lib/i18n/admin-dict";

/** Shared, forgiving date formatting for the admin dashboard's server components. */
export function formatDateTime(iso: string, lang: AdminLang = "ms"): string {
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ms-MY", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
