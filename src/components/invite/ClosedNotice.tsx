import type { WeddingConfig } from "@/config/wedding";

import { SiteCredit } from "@/components/SiteCredit";

import { BotanicalCorner } from "./Botanical";

/**
 * Shown in place of the whole invitation when the admin has closed it —
 * either for maintenance or because the wedding has happened.
 *
 * Styled like the card rather than like an error page: a guest who opens a
 * forwarded link and lands on a stark "503" will assume the link is broken
 * and may never come back. This should read as a deliberate, gentle note
 * from the couple.
 *
 * The card itself is not rendered at all in this state, so none of the
 * guest-facing data is even queried — and the write endpoints reject too
 * (see /api/rsvp, /api/wishes, /api/track). "Closed" means closed on the
 * server, not merely hidden.
 */

const DEFAULT_MESSAGES: Record<Exclude<WeddingConfig["siteMode"], "live">, string> = {
  maintenance: "Kad jemputan ini sedang diselenggara. Sila kembali sebentar lagi.",
  ended: "Majlis telah berlangsung. Terima kasih atas doa dan restu tuan/puan.",
};

export function ClosedNotice({ config }: { config: WeddingConfig }) {
  if (config.siteMode === "live") return null;

  const message = config.siteClosedMessage?.trim() || DEFAULT_MESSAGES[config.siteMode];

  return (
    <main className="flex min-h-screen w-full items-center justify-center px-6 py-16">
      <div className="invite-card relative mx-auto flex w-full max-w-[480px] flex-col items-center gap-6 px-8 py-20 text-center">
        <BotanicalCorner className="pointer-events-none absolute -top-2 -left-3" size={110} />
        <BotanicalCorner
          className="pointer-events-none absolute -right-3 -bottom-2 -scale-x-100 -scale-y-100"
          size={110}
        />

        <p className="text-xs font-medium tracking-[0.35em] text-brown uppercase">
          {config.eventType}
        </p>

        <h1 className="font-script text-4xl leading-tight text-brown-deep">
          {config.groom.shortName}
          <span className="mx-2 text-goldenrod">&amp;</span>
          {config.bride.shortName}
        </h1>

        <p className="max-w-xs text-base leading-7 text-brown">{message}</p>

        <SiteCredit className="mt-4" />
      </div>
    </main>
  );
}
