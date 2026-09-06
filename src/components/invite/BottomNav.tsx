"use client";

import type { ReactElement } from "react";

export type NavKey = "kalendar" | "lokasi" | "hubungi" | "rsvp";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
      <path
        d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
      <path
        d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2C10.5 20 4 13.5 4 6a2 2 0 0 1 1-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
      <path
        d="M12 20s-7.5-4.6-9.5-9C1 7.8 2.8 5 6 5c2 0 3.3 1.2 4 2.3C10.7 6.2 12 5 14 5c3.2 0 5 2.8 3.5 6-2 4.4-9.5 9-9.5 9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ITEMS: { key: NavKey; label: string; Icon: () => ReactElement }[] = [
  { key: "kalendar", label: "Kalendar", Icon: CalendarIcon },
  { key: "lokasi", label: "Lokasi", Icon: PinIcon },
  { key: "hubungi", label: "Hubungi", Icon: PhoneIcon },
  { key: "rsvp", label: "RSVP", Icon: HeartIcon },
];

export function BottomNav({
  items,
  onSelect,
  registerTriggerRef,
}: {
  /** Which nav items are enabled (`navKalendar`/`navLokasi`/`navHubungi`/`navRsvp`). A hidden item is absent from the DOM, not merely styled hidden. */
  items?: Record<NavKey, boolean>;
  onSelect: (key: NavKey) => void;
  registerTriggerRef: (key: NavKey, el: HTMLButtonElement | null) => void;
}) {
  const visibleItems = ITEMS.filter(({ key }) => items?.[key] !== false);

  if (visibleItems.length === 0) return null;

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[480px] justify-around border-t border-gold-light/60 bg-sand/90 pt-2 pb-safe backdrop-blur"
    >
      {visibleItems.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          ref={(el) => registerTriggerRef(key, el)}
          onClick={() => onSelect(key)}
          className="flex flex-1 flex-col items-center gap-1 py-1 text-brown-deep"
        >
          <Icon />
          <span className="text-[11px] tracking-wide">{label}</span>
        </button>
      ))}
    </nav>
  );
}
