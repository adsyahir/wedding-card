"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AdminTheme } from "@/lib/admin-theme";
import type { AdminDict, AdminLang } from "@/lib/i18n/admin-dict";

import { AccountMenu } from "./AccountMenu";
import { AdminNav } from "./AdminNav";
import { LangToggle } from "./LangToggle";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The admin header on a phone.
 *
 * Five nav items plus two toggles plus a log-out button will not sit on a
 * 390px row, and the previous attempts either scrolled the nav sideways
 * (so "Settings" was always half off the edge) or stacked everything into
 * three crowded rows that ate a third of the screen before any content.
 * One button, everything behind it.
 *
 * Above `lg` this renders nothing — the desktop sidebar carries the nav
 * and the toggles instead.
 */
export function AdminMobileMenu({
  dict,
  lang,
  theme,
  pendingWishCount,
  username,
}: {
  dict: AdminDict;
  lang: AdminLang;
  theme: AdminTheme;
  pendingWishCount: number;
  username: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on navigation. Without this the menu stays open over the page you
  // just asked for, which reads as the tap not having worked.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="admin-mobile-menu"
        aria-label={dict.nav_menu}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-tan/50 text-brown-deep"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}

        {/* The pending-wishes count is the one thing worth surfacing while
            the menu is shut — otherwise closing it hides the only prompt
            that something needs moderating. */}
        {!open && pendingWishCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-goldenrod px-1 text-[10px] font-semibold text-cream">
            {pendingWishCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id="admin-mobile-menu"
          ref={panelRef}
          className="absolute inset-x-0 top-full border-b border-tan/40 bg-sand px-4 py-3 shadow-lg"
        >
          <AdminNav
            pendingWishCount={pendingWishCount}
            dict={dict}
            orientation="vertical"
            onNavigate={() => setOpen(false)}
          />

          <div className="mt-3 flex flex-col gap-3 border-t border-tan/30 pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-brown/70">{dict.theme_light}</span>
              <ThemeToggle
                current={theme}
                lightLabel={dict.theme_light}
                darkLabel={dict.theme_dark}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-brown/70">{dict.nav_language}</span>
              <LangToggle current={lang} />
            </div>
            <AccountMenu username={username} dict={dict} />
          </div>
        </div>
      )}
    </div>
  );
}
