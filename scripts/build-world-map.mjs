#!/usr/bin/env node
// @ts-check

/**
 * Pre-renders the world map's country outlines into `src/lib/world-map.json`.
 *
 * WHY PRE-RENDER: the analytics map has to work under this app's CSP, which
 * allows scripts and connections from 'self' only. No map library from a
 * CDN, no tile server — and a tile server would also mean telling a third
 * party which admin looked at which map. So the map is inline SVG, drawn
 * from geometry committed to the repo.
 *
 * WHY A BUILD STEP RATHER THAN CONVERTING AT RUNTIME: `world-atlas` and
 * `topojson-client` are devDependencies. Converting on every render would
 * pull them into the Worker bundle to recompute a constant. This script is
 * run by hand when the geometry needs regenerating:
 *
 *   node scripts/build-world-map.mjs
 *
 * PROJECTION: equirectangular, which is `x = (lon + 180) / 360` and
 * `y = (90 - lat) / 180` and nothing else. It distorts area badly near the
 * poles — Greenland looks absurd — but it is the only projection where a
 * city's dot can be placed from its coordinates with two divisions and no
 * projection library on the server. For "which countries are these guests
 * in", that trade is the right way round.
 */

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

import { feature } from "topojson-client";
import countries from "i18n-iso-countries";

const require = createRequire(import.meta.url);
/*
 * 110m, deliberately, even though it omits the smallest countries.
 *
 * The 50m set does include Singapore — which a Malaysian wedding will
 * certainly see — but it produces 1.1MB of path data against 123KB, and
 * this JSON is imported by a server component, so it lands in the Worker
 * bundle. Worse, it buys nothing visually: at this canvas width Singapore
 * is about one pixel across, so its fill would be invisible either way.
 *
 * Small countries are covered by the CITY DOTS instead, which are placed
 * from coordinates and so do not depend on the polygon existing at all.
 * A Singapore visit shows as a dot over Singapore.
 */
const topology = require("world-atlas/countries-110m.json");

const WIDTH = 1000;
const HEIGHT = 500;
/** Coordinate precision in the emitted path data. 1 = ~0.1px at this size. */
const PRECISION = 1;

const projected = (lon, lat) => [
  (((lon + 180) / 360) * WIDTH).toFixed(PRECISION),
  (((90 - lat) / 180) * HEIGHT).toFixed(PRECISION),
];

/**
 * Countries that are simply not worth drawing here.
 *
 * Antarctica spans every longitude and reaches the pole, so in an
 * equirectangular projection it renders as a band smeared across the whole
 * bottom of the map — visually enormous, and no wedding guest is browsing
 * from it. Google Analytics omits it from its map for the same reason.
 */
const SKIP_ALPHA2 = new Set(["AQ"]);

/**
 * Longitude gap above which two consecutive points are assumed to be on
 * opposite sides of the antimeridian rather than genuinely that far apart.
 * No real country has a 180-degree step between adjacent border points.
 */
const ANTIMERIDIAN_JUMP = 180;

function ringToPath(ring) {
  let d = "";
  let last = null;
  let lastLon = null;

  for (const [lon, lat] of ring) {
    const [x, y] = projected(lon, lat);

    /*
     * Break the subpath when the ring crosses the antimeridian.
     *
     * Russia, Fiji and the Aleutians have borders that pass through 180
     * degrees. Projected naively, the point before the crossing is at the
     * far right of the canvas and the point after is at the far left, so
     * joining them with `L` draws a horizontal band straight across the
     * whole map. That band was visible across the top of the rendered map
     * before this: it looked like a rendering glitch because it was one.
     *
     * Starting a fresh subpath with `M` leaves the two halves drawn where
     * they belong and nothing stretched between them.
     */
    const wrapped = lastLon !== null && Math.abs(lon - lastLon) > ANTIMERIDIAN_JUMP;
    lastLon = lon;

    // Drop points that round to the same place: at 110m resolution a lot of
    // coastline detail collapses at this size, and keeping it triples the
    // file for pixels nobody can see.
    if (!wrapped && last && last[0] === x && last[1] === y) continue;

    d += `${d && !wrapped ? "L" : "M"}${x},${y}`;
    last = [x, y];
  }
  return d ? `${d}Z` : "";
}

function geometryToPath(geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons
    .map((polygon) => polygon.map(ringToPath).join(""))
    .join("");
}

const collection = feature(topology, topology.objects.countries);

/** ISO alpha-2 -> SVG path. Alpha-2 because that is what Cloudflare's `cf.country` gives us. */
const paths = {};
const skipped = [];

for (const f of collection.features) {
  // world-atlas ids are ISO 3166-1 NUMERIC; the analytics rows are alpha-2.
  const alpha2 = countries.numericToAlpha2(String(f.id).padStart(3, "0"));
  if (!alpha2) {
    skipped.push(f.properties?.name ?? f.id);
    continue;
  }
  if (SKIP_ALPHA2.has(alpha2)) continue;
  const d = geometryToPath(f.geometry);
  if (d) paths[alpha2] = d;
}

const out = { width: WIDTH, height: HEIGHT, paths };
writeFileSync("src/lib/world-map.json", JSON.stringify(out) + "\n");

const bytes = JSON.stringify(out).length;
console.log(
  `src/lib/world-map.json: ${Object.keys(paths).length} countries, ${Math.round(bytes / 1024)}KB` +
    (skipped.length ? `\nno alpha-2 mapping (skipped): ${skipped.join(", ")}` : ""),
);
