import type { WeddingConfig } from "@/config/wedding";

import { Reveal } from "./Reveal";

function CornerFlourish({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width="88"
      height="88"
      role="presentation"
      aria-hidden="true"
      className={`text-goldenrod/25 ${className}`}
    >
      <path
        d="M6 6 C 40 6, 40 30, 26 34 C 46 30, 54 46, 54 60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M6 6 C 6 40, 30 40, 34 26 C 30 46, 46 54, 60 54"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <circle cx="6" cy="6" r="3.5" fill="currentColor" />
    </svg>
  );
}

export function Hero({ config }: { config: WeddingConfig }) {
  const [day, month, year] = formatNumeric(config.date);

  return (
    <section className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <CornerFlourish className="absolute top-4 left-4" />
      <CornerFlourish className="absolute top-4 right-4 -scale-x-100" />
      <CornerFlourish className="absolute bottom-4 left-4 -scale-y-100" />
      <CornerFlourish className="absolute bottom-4 right-4 -scale-x-100 -scale-y-100" />

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
