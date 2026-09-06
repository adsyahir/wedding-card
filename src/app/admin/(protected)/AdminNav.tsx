"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AdminDict } from "@/lib/i18n/admin-dict";

/**
 * The admin shell's nav. Client-only because highlighting the active link
 * needs `usePathname()` — the links themselves are plain `<Link>`s, so
 * navigation still works with JS disabled, only the active-state styling
 * would be missing.
 */
export function AdminNav({
  pendingWishCount,
  dict,
  orientation = "horizontal",
  onNavigate,
}: {
  pendingWishCount: number;
  dict: AdminDict;
  /** "vertical" is the stacked list inside the mobile menu. */
  orientation?: "horizontal" | "vertical";
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

  const vertical = orientation === "vertical";

  return (
    <nav
      className={
        vertical
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
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${vertical ? "w-full" : "shrink-0 whitespace-nowrap"} ${
              isActive
                ? "bg-goldenrod text-cream"
                : "text-brown-deep hover:bg-tan/20"
            }`}
          >
            {link.label}
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
