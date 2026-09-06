/**
 * Builds the Google Maps embed URL for the venue.
 *
 * WHY NOT COORDINATES: `?q=<lat>,<lng>` drops an anonymous red pin. Google
 * only renders the place's LABEL — the business name beside the pin — when
 * the query is something it can resolve to a known place, i.e. a name and
 * address rather than a raw coordinate pair. A guest glancing at the map
 * should see "Dewan Serbaguna Taman Seri Indah", not a nameless dot.
 *
 * The trade is that a name is geocoded and could in principle resolve to
 * the wrong place, where coordinates are exact. Including the full address
 * alongside the name makes that unlikely, and the couple can see
 * immediately whether it landed correctly — whereas a wrong-but-anonymous
 * pin looks perfectly fine and misleads everyone. If it ever does resolve
 * wrongly, making the venue name more specific fixes it.
 *
 * Falls back to coordinates when there is no usable name, so the map still
 * renders something rather than nothing.
 */
export function buildMapEmbedUrl(venue: {
  name: string;
  addressLines: readonly string[];
  lat: number;
  lng: number;
}): string {
  const query = [venue.name, ...venue.addressLines]
    .map((part) => part.trim().replace(/,\s*$/, ""))
    .filter(Boolean)
    .join(", ");

  const q = query.length > 0 ? query : `${venue.lat},${venue.lng}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
}
