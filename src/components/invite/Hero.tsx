import type { WeddingConfig } from "@/config/wedding";

import { BotanicalCorner } from "./Botanical";
import { Reveal } from "./Reveal";

export function Hero({ config }: { config: WeddingConfig }) {
  const [day, month, year] = formatNumeric(config.date);

  return (
    <section className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* Sized generously and bled slightly off the edges: at 88px these
          read as stray marks on a phone rather than as framing. */}
      <BotanicalCorner className="pointer-events-none absolute -top-2 -left-3" />
      <BotanicalCorner className="pointer-events-none absolute -top-2 -right-3 -scale-x-100" />
      <BotanicalCorner className="pointer-events-none absolute -bottom-2 -left-3 -scale-y-100" />
      <BotanicalCorner className="pointer-events-none absolute -right-3 -bottom-2 -scale-x-100 -scale-y-100" />

      <Reveal className="flex flex-col items-center gap-6">
        <p className="text-xs font-medium tracking-[0.35em] text-brown uppercase">
          {config.eventType}
        </p>

        <h1 className="font-script text-5xl leading-tight text-brown-deep sm:text-6xl">
          {config.groom.shortName}
          <span className="mx-3 text-goldenrod">&amp;</span>
          {config.bride.shortName}
        </h1>

        <p className="font-serif text-sm tracking-[0.2em] text-brown uppercase">
          {config.dayNameMs}
        </p>

        <p className="font-serif text-3xl tracking-[0.15em] text-brown-deep">
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

function formatNumeric(iso: string): [string, string, string] {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear().toString();
  return [day, month, year];
}

function lastAddressSegment(lines: readonly string[]): string {
  const last = lines[lines.length - 1] ?? "";
  // Address lines carry their own trailing commas for the full-address
  // display elsewhere; strip a trailing comma here since this is the last
  // line shown standalone under the venue name.
  return last.replace(/,\s*$/, "");
}
