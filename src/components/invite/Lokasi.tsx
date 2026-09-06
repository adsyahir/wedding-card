import { GoogleMapsIcon, WazeIcon } from "./BrandIcons";
import type { WeddingConfig } from "@/config/wedding";
import { trackEvent } from "@/lib/track";

import { Reveal } from "./Reveal";



/**
 * The Lokasi section on the page: venue name, address, and the two
 * navigation buttons.
 *
 * Deliberately NO embedded map here. The map lives only in the Lokasi
 * bottom sheet (`LokasiSheet`) — an iframe sitting in the middle of the
 * scroll interrupts the card's flow, and it costs every guest a request to
 * Google on page load whether or not they ever wanted directions. In the
 * sheet it loads only when someone actually taps Lokasi.
 */
export function Lokasi({ config }: { config: WeddingConfig }) {
  return (
    <section className="w-full px-6 py-16 text-center">
      <Reveal as="h2" className="font-serif text-2xl tracking-[0.25em] text-brown-deep uppercase">
        Lokasi Majlis
      </Reveal>

      <Reveal delay={0.1} className="mx-auto mt-8 max-w-md">
        {/*
          Script face here, by choice — this is the decorative display of the
          venue on the card itself, and it follows the admin's font pick.

          The Lokasi *sheet* deliberately keeps a plain sans version (see
          LokasiSheet.tsx). That is the one a guest opens when they are
          actually trying to find the place, so a legible copy of the venue
          name is always one tap away whatever font is chosen here.
        */}
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
          <GoogleMapsIcon />
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
