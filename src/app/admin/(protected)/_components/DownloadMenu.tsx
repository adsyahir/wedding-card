"use client";

import { useEffect, useRef, useState } from "react";

import type { AdminDict } from "@/lib/i18n/admin-dict";

/**
 * The RSVP export control: one button, with the format chosen from a
 * dropdown.
 *
 * Two side-by-side buttons made the format look like the decision, when
 * the decision is "get me the guest list" and the format is a detail most
 * people have no opinion about. Collapsing them puts the action first and
 * leaves Excel as the obvious default at the top of the list.
 *
 * The items are plain `<a>` elements, not buttons calling `fetch`: the
 * export route replies with `Content-Disposition: attachment`, so letting
 * the browser follow the link gives a real download with a real filename
 * and a real progress indicator, and it still works if this component
 * never hydrates.
 */
export function DownloadMenu({ dict }: { dict: AdminDict }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // `pointerdown`, not `click`: a click listener added during the click
    // that opened the menu can fire on that very same event and shut it
    // again immediately.
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const items = [
    { href: "/api/admin/rsvp/export?format=xlsx", label: dict.rsvp_downloadXlsx, hint: ".xlsx" },
    { href: "/api/admin/rsvp/export", label: dict.rsvp_downloadCsv, hint: ".csv" },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 rounded-lg bg-goldenrod px-4 py-2 text-sm font-medium text-cream transition hover:bg-brown"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12" />
          <path d="M7 11l5 5 5-5" />
          <path d="M4 20h16" />
        </svg>
        {dict.rsvp_download}
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-tan/40 bg-cream shadow-lg"
        >
          {items.map((item) => (
            <a
              key={item.href}
              role="menuitem"
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm text-brown-deep transition hover:bg-tan/20"
            >
              {item.label}
              <span className="text-xs text-brown/50">{item.hint}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
