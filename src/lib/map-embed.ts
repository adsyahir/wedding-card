/**
 * Builds the Google Maps embed URL for the venue.
 *
 * WHERE THE PIN COMES FROM, in order of preference:
 *
 *   1. The Google Maps LINK the admin pasted. A `/maps/place/...` URL
 *      carries both Google's own canonical name for the place and its
 *      coordinates, which makes it by far the most trustworthy thing we
 *      have — it is the place the admin actually looked at and confirmed.
 *   2. The venue name and address typed into the settings.
 *   3. The latitude/longitude fields, if they were filled in.
 *
 * WHY A NAME AT ALL, RATHER THAN JUST COORDINATES: `?q=<lat>,<lng>` drops
 * an anonymous red pin. Google only renders the place's LABEL — the
 * business name beside the pin — when the query resolves to a known place.
 * A guest glancing at the map should see "Bukit Beruntung Golf & Country
 * Resort", not a nameless dot. When the link gives us both, we send the
 * name as the query AND the coordinates as `ll`, so the label appears and
 * an ambiguous name still resolves near the right spot.
 *
 * Returns null when there is nothing to point at, so the caller renders no
 * map rather than an embed of nowhere.
 */

/** Latitude/longitude sanity. Guards against a malformed URL yielding NaN or a swapped pair. */
function validCoords(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    // A parse that lands exactly on Null Island is a parse that went wrong,
    // not a venue in the Gulf of Guinea.
    !(lat === 0 && lng === 0)
  );
}

export type ParsedMapsLink = { placeName: string | null; lat: number | null; lng: number | null };

/**
 * Pulls the place name and coordinates out of a Google Maps URL.
 *
 * Handles the shapes Google actually produces when you hit Share → Copy
 * link, or copy the address bar:
 *
 *   /maps/place/<Name>/@3.437,101.565,13z/data=...!3d3.4370!4d101.5656
 *   /maps/@3.437,101.565,15z
 *   /maps?q=3.437,101.565     ?ll=3.437,101.565     ?q=Some+Place
 *
 * `!3d...!4d...` inside `data=` is preferred over `@lat,lng`: the former is
 * the marker itself, the latter is only wherever the map happened to be
 * centred, which after a drag can be a suburb away.
 *
 * SHORT LINKS (`maps.app.goo.gl/xxxx`) carry nothing — they are opaque
 * redirects, and resolving one means an outbound request from the server
 * to follow it. Those return all-nulls, and the caller falls back to the
 * typed name and address.
 */
export function parseGoogleMapsLink(raw: string | null | undefined): ParsedMapsLink {
  const empty: ParsedMapsLink = { placeName: null, lat: null, lng: null };
  if (!raw || raw.trim() === "") return empty;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return empty;
  }

  // Only trust Google's own hosts. Anything else is either a mistake or an
  // attempt to get an arbitrary string into the query we build below.
  const host = url.hostname.toLowerCase();
  const isGoogle =
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host === "goo.gl" ||
    host.endsWith(".goo.gl") ||
    host === "google.com.my" ||
    host.endsWith(".google.com.my");
  if (!isGoogle) return empty;

  const href = url.href;

  let placeName: string | null = null;
  const placeMatch = url.pathname.match(/\/place\/([^/@]+)/);
  if (placeMatch) {
    try {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
      // Google falls back to a coordinate string as the "place" segment when
      // you drop a pin on empty ground — that is not a name.
      if (decoded && !/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(decoded)) {
        placeName = decoded;
      }
    } catch {
      // A malformed percent-escape: fall through with no name.
    }
  }

  let lat: number | null = null;
  let lng: number | null = null;

  const marker = href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const centre = href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const param = (url.searchParams.get("q") ?? url.searchParams.get("ll") ?? "").match(
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
  );

  for (const m of [marker, centre, param]) {
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (validCoords(a, b)) {
      lat = a;
      lng = b;
      break;
    }
  }

  // `?q=Some+Place` is a name too, when the path had none.
  if (!placeName && !param) {
    const q = url.searchParams.get("q")?.trim();
    if (q) placeName = q;
  }

  return { placeName, lat, lng };
}

export function buildMapEmbedUrl(venue: {
  name: string;
  addressLines: readonly string[];
  lat?: number | null;
  lng?: number | null;
  googleMapsUrl?: string | null;
}): string | null {
  const link = parseGoogleMapsLink(venue.googleMapsUrl);

  const typed = [venue.name, ...venue.addressLines]
    .map((part) => part.trim().replace(/,\s*$/, ""))
    .filter(Boolean)
    .join(", ");

  const hasTypedCoords =
    typeof venue.lat === "number" &&
    typeof venue.lng === "number" &&
    validCoords(venue.lat, venue.lng);

  // The query decides what the pin is LABELLED; `ll` only nudges an
  // ambiguous name towards the right part of the world.
  let q: string | null = null;
  let ll: string | null = null;

  if (link.placeName) {
    q = link.placeName;
    if (link.lat !== null && link.lng !== null) ll = `${link.lat},${link.lng}`;
  } else if (link.lat !== null && link.lng !== null) {
    q = `${link.lat},${link.lng}`;
  } else if (typed.length > 0) {
    // Deliberately no `ll` here. The link's name and coordinates both come
    // from Google and always agree; a typed name and typed coordinates are
    // entered independently and can contradict each other, and centring on
    // the wrong one of the two is worse than letting the name geocode.
    q = typed;
  } else if (hasTypedCoords) {
    q = `${venue.lat},${venue.lng}`;
  }

  // Nothing to point at — no link, no name, no address, no coordinates.
  if (q === null) return null;

  const params = new URLSearchParams({ q });
  if (ll) params.set("ll", ll);
  params.set("z", "16");
  params.set("output", "embed");

  // URLSearchParams encodes a space as "+", which reads oddly in a URL a
  // human may inspect and which the previous tests pin as %20.
  return `https://www.google.com/maps?${params.toString().replace(/\+/g, "%20")}`;
}
