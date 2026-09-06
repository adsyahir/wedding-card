"use client";

import { GoogleMapsIcon, WazeIcon } from "./BrandIcons";
import { buildMapEmbedUrl } from "@/lib/map-embed";
import type { WeddingConfig } from "@/config/wedding";
import { trackEvent } from "@/lib/track";

export function LokasiSheet({ config, showMap }: { config: WeddingConfig; showMap: boolean }) {
  const mapUrl = buildMapEmbedUrl(config.venue);
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {/* Sans, not script — see the note in Lokasi.tsx. */}
      <p className="text-lg font-medium text-brown-deep">{config.venue.name}</p>
      <address className="text-sm leading-6 text-brown not-italic">
        {config.venue.addressLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>

      {showMap && mapUrl && (
        <iframe
          src={mapUrl}
          title={`Peta lokasi: ${config.venue.name}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="aspect-[4/3] w-full rounded-lg border-0"
        />
      )}

      {/* Side by side: two short labels stacked full-width read as a list of
          steps rather than a choice between two equivalent apps. */}
      <div className="mt-2 flex w-full gap-3">
        <a
          href={config.venue.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("maps_click")}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-goldenrod bg-tan px-4 py-3 text-sm font-medium text-brown-deep transition-transform hover:scale-[1.02]"
        >
          <GoogleMapsIcon />
          Google Maps
        </a>
        <a
          href={config.venue.wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("waze_click")}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-goldenrod bg-sand px-4 py-3 text-sm font-medium text-brown-deep transition-transform hover:scale-[1.02]"
        >
          <WazeIcon />
          Waze
        </a>
      </div>
    </div>
  );
}
