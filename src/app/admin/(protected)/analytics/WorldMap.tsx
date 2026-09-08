import type { CityPoint, KeyCount } from "@/db/queries/analytics";
import type { AdminDict } from "@/lib/i18n/admin-dict";
import { MapViewport } from "./MapViewport";
import { projectEquirectangular } from "@/lib/world-map-projection";
import worldMap from "@/lib/world-map.json";

/**
 * The analytics world map: countries shaded by visit count, cities as dots.
 *
 * A SERVER COMPONENT, and inline SVG, for two reasons that reinforce each
 * other. The CSP allows scripts and connections from 'self' only, so a map
 * library from a CDN or tiles from a tile server are both out — and a tile
 * server would additionally tell a third party which admin was looking at
 * which map, on a dashboard whose whole point is that it does not do that.
 * Rendering here also keeps the 123KB of geometry in `world-map.json` out
 * of the browser bundle entirely: it becomes HTML, not JavaScript.
 *
 * There is no pan, zoom or hover panel. `<title>` gives every shape a
 * native tooltip, which browsers and screen readers already handle, and the
 * ranked lists beside the map carry the exact numbers.
 */

/**
 * Shade for a country, from its share of the busiest country's traffic.
 *
 * `sqrt` rather than linear: with one dominant country — which is exactly
 * what a Malaysian wedding invitation looks like — a linear ramp renders
 * every other country at nearly zero and the map says only "Malaysia".
 * The square root lifts the small values enough to be visible while
 * keeping the order intact.
 */
function shade(count: number, max: number): string {
  if (max <= 0) return "var(--color-sand)";
  const t = Math.sqrt(count / max);
  // Between the page's own sand and goldenrod, so the map belongs to the
  // dashboard rather than looking like an embedded widget.
  return `color-mix(in oklab, var(--color-goldenrod) ${Math.round(18 + t * 82)}%, var(--color-sand))`;
}

export function WorldMap({
  countries,
  cities,
  dict,
  countryNames,
}: {
  countries: KeyCount[];
  cities: CityPoint[];
  dict: AdminDict;
  /** ISO alpha-2 -> display name, for the tooltips. */
  countryNames: Record<string, string>;
}) {
  const { width, height, paths } = worldMap as {
    width: number;
    height: number;
    paths: Record<string, string>;
  };

  const byCountry = new Map(countries.map((c) => [c.key.toUpperCase(), c.count]));
  const maxCountry = countries.length > 0 ? Math.max(...countries.map((c) => c.count)) : 0;
  const maxCity = cities.length > 0 ? Math.max(...cities.map((c) => c.count)) : 0;

  if (countries.length === 0 && cities.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-brown/60">{dict.analytics_emptyCountries}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <MapViewport dict={dict}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={dict.analytics_mapAria}
          className="block h-auto w-full"
        >
          <rect width={width} height={height} fill="var(--color-cream)" />

          {Object.entries(paths).map(([code, d]) => {
            const n = byCountry.get(code) ?? 0;
            return (
              <path
                key={code}
                d={d}
                fill={n > 0 ? shade(n, maxCountry) : "var(--color-sand)"}
                stroke="var(--color-cream)"
                strokeWidth={0.6}
              >
                {n > 0 && (
                  <title>{`${countryNames[code] ?? code}: ${n}`}</title>
                )}
              </path>
            );
          })}

          {cities.map((city) => {
            const { x, y } = projectEquirectangular(city.lat, city.lng, width, height);
            // Area, not radius, tracks the count — a radius-proportional dot
            // exaggerates a busy city by its square.
            const r = 2.5 + Math.sqrt(city.count / Math.max(maxCity, 1)) * 7;
            return (
              <g key={`${city.city}-${city.country ?? ""}`}>
                <circle cx={x} cy={y} r={r} fill="var(--color-brown-deep)" fillOpacity={0.55} />
                <circle cx={x} cy={y} r={Math.max(r * 0.35, 1.2)} fill="var(--color-brown-deep)">
                  <title>{`${city.city}: ${city.count}`}</title>
                </circle>
              </g>
            );
          })}
        </svg>
      </MapViewport>

      <p className="text-xs text-brown/60">
        {cities.length > 0 ? dict.analytics_mapLegend : dict.analytics_mapNoCityCoords}
      </p>
    </div>
  );
}
