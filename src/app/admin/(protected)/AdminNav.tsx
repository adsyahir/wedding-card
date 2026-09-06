"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AdminDict } from "@/lib/i18n/admin-dict";

/**
 * The admin shell's nav. Client-only because highlighting the active link
 * needs `usePathname()` — the links themselves are plain `<Link>`s, so
 * navigation still works with JS disabled, only the active-state styling
 * would be missing.
 *
 * Three orientations, one component: the desktop `sidebar`, the stacked
 * `vertical` list inside the mobile menu, and the old `horizontal` row
 * (kept because the login-adjacent shells and any narrow-but-not-mobile
 * layout may still want it).
 */

/**
 * Icons only appear in the sidebar. A horizontal row of five labels is
 * already scannable by shape; a vertical column of five is not, and the
 * icon is what the eye actually aims at once the position is learned.
 */
const ICONS: Record<string, React.ReactNode> = {
  "/admin": (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  "/admin/rsvp": (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M17 11l2 2 4-4" />
    </>
  ),
  "/admin/ucapan": <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.7L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />,
  "/admin/analytics": (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </>
  ),
  "/admin/settings": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
};

export function AdminNav({
  pendingWishCount,
  dict,
  orientation = "horizontal",
  onNavigate,
}: {
  pendingWishCount: number;
  dict: AdminDict;
  /** "vertical" is the stacked list inside the mobile menu; "sidebar" is the desktop column. */
  orientation?: "horizontal" | "vertical" | "sidebar";
  /** Lets the mobile menu close itself when a link is followed. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/admin", label: dict.nav_ringkasan },
    { href: "/admin/rsvp", label: dict.nav_rsvp },
    { href: "/admin/ucapan", label: dict.nav_ucapan },
    { href: "/admin/analytics", label: dict.nav_analitik },
    { href: "/admin/settings", label: dict.nav_tetapan },
  ] as const;

  const sidebar = orientation === "sidebar";
  const stacked = sidebar || orientation === "vertical";

  return (
    <nav
      className={
        stacked
          ? "flex flex-col gap-1"
          : "no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1"
      }
    >
      {links.map((link) => {
        const isActive =
          link.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
            className={`flex items-center gap-2 rounded-lg text-sm font-medium transition ${
              sidebar ? "px-3 py-2" : "px-3 py-1.5 gap-1.5"
            } ${stacked ? "w-full" : "shrink-0 whitespace-nowrap"} ${
              isActive ? "bg-goldenrod text-cream" : "text-brown-deep hover:bg-tan/20"
            }`}
          >
            {sidebar && (
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0"
              >
                {ICONS[link.href]}
              </svg>
            )}

            <span className={sidebar ? "flex-1 truncate" : undefined}>{link.label}</span>

            {link.href === "/admin/ucapan" && pendingWishCount > 0 && (
              <span
                className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  isActive ? "bg-cream text-goldenrod" : "bg-goldenrod text-cream"
                }`}
              >
                {pendingWishCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
