import type { WeddingConfig } from "@/config/wedding";
import { isoToParts } from "@/lib/datetime-my";

import { FloralFrame } from "./FloralFrame";
import { Reveal } from "./Reveal";

export function Hero({ config }: { config: WeddingConfig }) {
  const [day, month, year] = formatNumeric(config.date);

  return (
    /*
     * `min-h-dvh`, not `min-h-screen`. `100vh` on a phone is the viewport
     * with the browser chrome RETRACTED, so with the URL bar showing the
     * hero is taller than what you can actually see and the venue line sits
     * just below the fold — which is the one line a guest needs. `100dvh`
     * tracks the visible height, so the first screen is genuinely one
     * screen.
     */
    <section className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/*
        The floral frame, on the first page only. The old corner ornaments
        were a stem and three berries each — at arm's length on a phone they
        read as stray marks rather than as framing. This has the mass to
        actually frame the page, and the side strips are what make it a
        frame rather than four separate ornaments.
      */}
      <FloralFrame />

      {/*
        Every letterspaced line below carries a negative inline-end margin
        equal to its own tracking. CSS puts the letter-space AFTER the last
        glyph as well as between glyphs, and centring includes that phantom
        space — so a line tracked at 0.2em sits 0.1em left of true centre
        while the barely-tracked Hijri line under it does not, and the
        stack visibly fails to line up. Cancelling the trailing space from
        the box is the standard fix; it is not a nudge tuned by eye, which
        is why each value simply mirrors the tracking on the same element.
      */}
      <Reveal className="relative z-10 flex flex-col items-center gap-6">
        <p className="-me-[0.35em] text-xs font-medium tracking-[0.35em] text-brown uppercase">
          {config.eventType}
        </p>

        <h1 className="font-script text-5xl leading-tight text-brown-deep sm:text-6xl">
          {config.groom.shortName}
          <span className="mx-3 text-goldenrod">&amp;</span>
          {config.bride.shortName}
        </h1>

        <p className="-me-[0.2em] font-serif text-sm tracking-[0.2em] text-brown uppercase">
          {config.dayNameMs}
        </p>

        {/*
          Cinzel: Roman inscriptional capitals, the lettering used on
          engraved invitations. Its figures are lining and evenly weighted
          by construction, so the date holds together at display size where
          Cormorant's text figures went fragile and Jost read a little
          plain against the script names above.
        */}
        <p className="-me-[0.2em] font-display text-2xl tracking-[0.2em] text-brown-deep">
          {day}
          <span className="mx-2 text-goldenrod">|</span>
          {month}
          <span className="mx-2 text-goldenrod">|</span>
          {year}
        </p>

        <div className="mt-2 flex flex-col items-center gap-1">
          <p className="font-serif text-lg text-brown-deep">{config.venue.name}</p>
          <p className="text-sm text-brown">
            {lastAddressSegment(config.venue.addressLines)}
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/**
 * `2026-11-14T11:00:00+08:00` -> `["14", "11", "2026"]`.
 *
 * Reads the literal parts off the stored string rather than going through
 * `new Date()`, whose getters report in the RENDERING machine's timezone.
 * Every stored value carries `+08:00`, so the literal date already IS
 * Malaysia local; the previous version parsed it as a Date and called
 * `getDate()`, which showed 13 to a guest opening the card from Europe.
 */
function formatNumeric(iso: string): [string, string, string] {
  const { date } = isoToParts(iso);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return ["", "", ""];
  return [match[3], match[2], match[1]];
}

function lastAddressSegment(lines: readonly string[]): string {
  const last = lines[lines.length - 1] ?? "";
  // Address lines carry their own trailing commas for the full-address
  // display elsewhere; strip a trailing comma here since this is the last
  // line shown standalone under the venue name.
  return last.replace(/,\s*$/, "");
}
