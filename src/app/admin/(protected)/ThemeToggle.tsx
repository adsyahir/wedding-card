"use client";

import { useRouter } from "next/navigation";

import {
  ADMIN_THEME_COOKIE_MAX_AGE_SECONDS,
  ADMIN_THEME_COOKIE_NAME,
  type AdminTheme,
} from "@/lib/admin-theme";

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Light / dark toggle for the admin dashboard. Writes the cookie directly
 * and refreshes, the same approach as `LangToggle` — the server stamps
 * `data-admin-theme` on the admin wrapper so there is no flash of the
 * wrong theme on load, which a client-only toggle would give.
 */
export function ThemeToggle({ current, lightLabel, darkLabel }: {
  current: AdminTheme;
  lightLabel: string;
  darkLabel: string;
}) {
  const router = useRouter();

  function select(theme: AdminTheme) {
    if (theme === current) return;
    document.cookie = `${ADMIN_THEME_COOKIE_NAME}=${theme}; Path=/; Max-Age=${ADMIN_THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    router.refresh();
  }

  const options: { value: AdminTheme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: lightLabel, icon: <SunIcon /> },
    { value: "dark", label: darkLabel, icon: <MoonIcon /> },
  ];

  return (
    <div
      role="group"
      aria-label={`${lightLabel} / ${darkLabel}`}
      className="flex overflow-hidden rounded-full border border-tan/50"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={current === option.value}
          title={option.label}
          onClick={() => select(option.value)}
          className={`flex items-center px-2.5 py-1.5 transition-colors ${
            current === option.value
              ? "bg-tan text-brown-deep"
              : "bg-transparent text-brown/70 hover:text-brown-deep"
          }`}
        >
          {option.icon}
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
