import { describe, expect, it } from "vitest";

import { buildMapEmbedUrl, parseGoogleMapsLink } from "./map-embed";

const venue = {
  name: "Dewan Serbaguna Taman Seri Indah",
  addressLines: ["Jalan Seri Indah 5,", "Taman Seri Indah,", "43000 Kajang, Selangor"],
  lat: 2.9927,
  lng: 101.7909,
};

describe("buildMapEmbedUrl", () => {
  it("queries by name and address so Google labels the place", () => {
    const url = buildMapEmbedUrl(venue)!;
    expect(url).toContain(encodeURIComponent("Dewan Serbaguna Taman Seri Indah"));
    expect(url).toContain(encodeURIComponent("43000 Kajang, Selangor"));
    expect(url).toContain("output=embed");
  });

  it("does not fall back to a bare coordinate pin when a name exists", () => {
    expect(buildMapEmbedUrl(venue)).not.toContain("2.9927%2C101.7909");
  });

  it("strips the trailing commas the address lines carry for display", () => {
    const url = decodeURIComponent(buildMapEmbedUrl(venue)!);
    expect(url).not.toContain(",,");
    expect(url).toContain("Jalan Seri Indah 5, Taman Seri Indah");
  });

  it("URL-encodes so an ampersand in the venue name cannot break the query", () => {
    const url = buildMapEmbedUrl({ ...venue, name: "Golf & Country Resort" })!;
    expect(url).toContain("Golf%20%26%20Country%20Resort");
    // The only literal & left is the one separating our own parameters.
    expect(url.split("&").length).toBe(3);
  });

  it("falls back to coordinates when there is no usable name or address", () => {
    const url = buildMapEmbedUrl({ ...venue, name: "  ", addressLines: [] })!;
    expect(url).toContain(encodeURIComponent("2.9927,101.7909"));
  });

  it("returns null when there is no name, no address and no coordinates", () => {
    expect(
      buildMapEmbedUrl({ name: "  ", addressLines: [], lat: null, lng: null }),
    ).toBeNull();
  });

  it("still builds a URL from coordinates alone when the name is blank", () => {
    const url = buildMapEmbedUrl({ name: "", addressLines: [], lat: 3.1, lng: 101.7 })!;
    expect(url).toContain(encodeURIComponent("3.1,101.7"));
  });

  it("prefers the name over coordinates when both are present", () => {
    const url = buildMapEmbedUrl(venue)!;
    expect(url).not.toContain("2.9927");
  });
});

const BUKIT_BERUNTUNG =
  "https://www.google.com/maps/place/Bukit+Beruntung+Golf+%26+Country+Resort+Berhad/" +
  "@3.437028,101.565609,13z/data=!4m10!1m2!2m1!1sbukit!3m6!1s0x31cc4a!8m2!3d3.4361!4d101.5702";

describe("parseGoogleMapsLink", () => {
  it("pulls the place name and the marker coordinates out of a /place/ link", () => {
    expect(parseGoogleMapsLink(BUKIT_BERUNTUNG)).toEqual({
      placeName: "Bukit Beruntung Golf & Country Resort Berhad",
      lat: 3.4361,
      lng: 101.5702,
    });
  });

  it("prefers the !3d!4d marker over the @ map centre", () => {
    // The @ centre says 3.437028; the marker says 3.4361. After a drag the
    // centre can be a suburb away from the pin.
    expect(parseGoogleMapsLink(BUKIT_BERUNTUNG).lat).toBe(3.4361);
  });

  it("falls back to the @ centre when there is no marker", () => {
    expect(parseGoogleMapsLink("https://www.google.com/maps/@3.1,101.7,15z")).toMatchObject({
      lat: 3.1,
      lng: 101.7,
    });
  });

  it("reads ?q= and ?ll= coordinate pairs", () => {
    expect(parseGoogleMapsLink("https://maps.google.com/maps?q=3.1,101.7")).toMatchObject({
      lat: 3.1,
      lng: 101.7,
    });
    expect(parseGoogleMapsLink("https://www.google.com/maps?ll=3.2,101.8")).toMatchObject({
      lat: 3.2,
      lng: 101.8,
    });
  });

  it("does not treat a coordinate pair in the /place/ slug as a name", () => {
    expect(
      parseGoogleMapsLink("https://www.google.com/maps/place/3.1,101.7/@3.1,101.7,15z").placeName,
    ).toBeNull();
  });

  it("returns nothing for a short link, which carries no coordinates", () => {
    expect(parseGoogleMapsLink("https://maps.app.goo.gl/abc123")).toEqual({
      placeName: null,
      lat: null,
      lng: null,
    });
  });

  it("ignores a non-Google host, so no arbitrary string reaches the query we build", () => {
    expect(
      parseGoogleMapsLink("https://evil.example.com/maps/place/Anything/@1,2,15z"),
    ).toEqual({ placeName: null, lat: null, lng: null });
  });

  it("rejects out-of-range and Null Island coordinates", () => {
    expect(parseGoogleMapsLink("https://www.google.com/maps/@999,101.7,15z").lat).toBeNull();
    expect(parseGoogleMapsLink("https://www.google.com/maps?q=0,0").lat).toBeNull();
  });

  it("survives a malformed URL without throwing", () => {
    expect(parseGoogleMapsLink("not a url")).toEqual({ placeName: null, lat: null, lng: null });
    expect(parseGoogleMapsLink("")).toEqual({ placeName: null, lat: null, lng: null });
  });
});

describe("buildMapEmbedUrl with a pasted Google Maps link", () => {
  it("lets the link outrank a stale name and address", () => {
    // This is the bug the preview exposed: the link pointed at Bukit
    // Beruntung while the venue fields still held the previous venue in
    // Kajang, and the map showed Kajang.
    const url = buildMapEmbedUrl({ ...venue, googleMapsUrl: BUKIT_BERUNTUNG })!;
    expect(url).toContain(encodeURIComponent("Bukit Beruntung Golf & Country Resort Berhad"));
    expect(url).not.toContain(encodeURIComponent("Dewan Serbaguna"));
  });

  it("sends the link coordinates as ll so an ambiguous name still lands right", () => {
    const url = buildMapEmbedUrl({ ...venue, googleMapsUrl: BUKIT_BERUNTUNG })!;
    expect(url).toContain(`ll=${encodeURIComponent("3.4361,101.5702")}`);
  });

  it("uses coordinates alone when the link has no place name", () => {
    const url = buildMapEmbedUrl({
      ...venue,
      googleMapsUrl: "https://www.google.com/maps/@3.1,101.7,15z",
    })!;
    expect(url).toContain(encodeURIComponent("3.1,101.7"));
  });

  it("falls back to the typed name when the link is a short link", () => {
    const url = buildMapEmbedUrl({ ...venue, googleMapsUrl: "https://maps.app.goo.gl/abc" })!;
    expect(url).toContain(encodeURIComponent("Dewan Serbaguna Taman Seri Indah"));
  });
});
