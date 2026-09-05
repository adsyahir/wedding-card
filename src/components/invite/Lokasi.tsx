import type { wedding } from "@/config/wedding";
import { trackEvent } from "@/lib/track";

import { Reveal } from "./Reveal";

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none">
      <path
        d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function WazeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none">
      <path
        d="M4 14c0-5 3.5-9 8-9s8 4 8 9-3.5 6-8 6c-1.5 0-2.6-.3-3.5-.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M6 18.5 4 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="13" r="1" fill="currentColor" />
      <circle cx="14" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

export function Lokasi({ config }: { config: typeof wedding }) {
  return (
    <section className="w-full px-6 py-16 text-center">
      <Reveal as="h2" className="font-serif text-2xl tracking-[0.25em] text-brown-deep uppercase">
        Lokasi Majlis
      </Reveal>

      <Reveal delay={0.1} className="mx-auto mt-8 max-w-md">
        <p className="font-script text-3xl text-brown-deep">{config.venue.name}</p>
        <address className="mt-3 text-base leading-7 text-brown not-italic">
          {config.venue.addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      </Reveal>

      <Reveal
        delay={0.2}
        className="mx-auto mt-8 flex max-w-md flex-col items-stretch gap-3 sm:flex-row sm:justify-center"
      >
        <a
          href={config.venue.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("maps_click")}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-goldenrod bg-tan px-6 py-3 text-sm font-medium text-brown-deep transition-transform hover:scale-[1.02]"
        >
          <MapPinIcon />
          Google Maps
        </a>
        <a
          href={config.venue.wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("waze_click")}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-goldenrod bg-sand px-6 py-3 text-sm font-medium text-brown-deep transition-transform hover:scale-[1.02]"
        >
          <WazeIcon />
          Waze
        </a>
      </Reveal>
    </section>
  );
}
