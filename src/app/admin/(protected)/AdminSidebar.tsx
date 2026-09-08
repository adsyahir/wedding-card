import type { AdminTheme } from "@/lib/admin-theme";
import type { AdminDict, AdminLang } from "@/lib/i18n/admin-dict";

import { AccountMenu } from "./AccountMenu";
import { AdminNav } from "./AdminNav";
import { LangToggle } from "./LangToggle";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The desktop admin sidebar.
 *
 * The nav used to be a horizontal row in the header. Five items fit, but
 * only just — and this is a dashboard whose sections grow (Settings alone
 * has five tabs of its own). A vertical column has room the row does not,
 * keeps the section list visible while you scroll a long RSVP table, and
 * gives the couple's names and the log-out button somewhere sensible to
 * live that isn't competing for the same row.
 *
 * Below `lg` this renders nothing: the header plus `AdminMobileMenu` takes
 * over, because a sidebar on a phone is just a drawer with extra steps.
 */
export function AdminSidebar({
  dict,
  lang,
  theme,
  pendingWishCount,
  coupleNames,
  hashtag,
  username,
}: {
  dict: AdminDict;
  lang: AdminLang;
  theme: AdminTheme;
  pendingWishCount: number;
  coupleNames: string;
  hashtag: string;
  /** Signed-in admin, shown in the account menu at the foot of the sidebar. */
  username: string;
}) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-tan/40 bg-sand/60 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <div className="border-b border-tan/30 px-5 py-4">
        <p className="truncate font-serif text-lg leading-tight text-brown-deep">{coupleNames}</p>
        <p className="truncate text-xs text-brown/60">{hashtag}</p>
      </div>

      {/* `overflow-y-auto` so a future sixth or seventh section scrolls
          inside the column rather than pushing the log-out button off the
          bottom of the screen. */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <AdminNav pendingWishCount={pendingWishCount} dict={dict} orientation="sidebar" />
      </div>

      <div className="flex flex-col gap-3 border-t border-tan/30 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-brown/70">{dict.theme_light}</span>
          <ThemeToggle current={theme} lightLabel={dict.theme_light} darkLabel={dict.theme_dark} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-brown/70">{dict.nav_language}</span>
          <LangToggle current={lang} />
        </div>
        <AccountMenu username={username} dict={dict} />
      </div>
    </aside>
  );
}
