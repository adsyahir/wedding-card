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
const topology = require("world-atlas/countries-110m.json");

const WIDTH = 1000;
const HEIGHT = 500;
/** Coordinate precision in the emitted path data. 1 = ~0.1px at this size. */
const PRECISION = 1;

const projected = (lon, lat) => [
  (((lon + 180) / 360) * WIDTH).toFixed(PRECISION),
  (((90 - lat) / 180) * HEIGHT).toFixed(PRECISION),
];

function ringToPath(ring) {
  let d = "";
  let last = null;
  for (const [lon, lat] of ring) {
    const [x, y] = projected(lon, lat);
    // Drop points that round to the same place: at 110m resolution a lot of
    // coastline detail collapses at this size, and keeping it triples the
    // file for pixels nobody can see.
    if (last && last[0] === x && last[1] === y) continue;
    d += `${d ? "L" : "M"}${x},${y}`;
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
