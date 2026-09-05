"use client";

import type { wedding } from "@/config/wedding";
import { trackEvent } from "@/lib/track";

export function LokasiSheet({ config }: { config: typeof wedding }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="font-script text-2xl text-brown-deep">{config.venue.name}</p>
      <address className="text-sm leading-6 text-brown not-italic">
        {config.venue.addressLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>

      <div className="mt-2 flex w-full flex-col gap-3">
        <a
          href={config.venue.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("maps_click")}
          className="inline-flex items-center justify-center rounded-full border border-goldenrod bg-tan px-6 py-3 text-sm font-medium text-brown-deep transition-transform hover:scale-[1.02]"
        >
          Google Maps
        </a>
        <a
          href={config.venue.wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("waze_click")}
          className="inline-flex items-center justify-center rounded-full border border-goldenrod bg-sand px-6 py-3 text-sm font-medium text-brown-deep transition-transform hover:scale-[1.02]"
        >
          Waze
        </a>
      </div>
    </div>
  );
}
