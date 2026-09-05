"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/rsvp", label: "RSVP" },
  { href: "/admin/ucapan", label: "Ucapan" },
  { href: "/admin/analytics", label: "Analitik" },
  { href: "/admin/settings", label: "Tetapan" },
] as const;

/**
 * The admin shell's nav. Client-only because highlighting the active link
 * needs `usePathname()` — the links themselves are plain `<Link>`s, so
 * navigation still works with JS disabled, only the active-state styling
 * would be missing.
 */
export function AdminNav({ pendingWishCount }: { pendingWishCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((link) => {
        const isActive =
          link.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
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
