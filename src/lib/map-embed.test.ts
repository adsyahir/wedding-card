import { describe, expect, it } from "vitest";

import { buildMapEmbedUrl } from "./map-embed";

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
