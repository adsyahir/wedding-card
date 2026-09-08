import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { projectEquirectangular } from "./world-map-projection";

const W = 1000;
const H = 500;

describe("projectEquirectangular", () => {
  it("puts 0,0 at the centre", () => {
    expect(projectEquirectangular(0, 0, W, H)).toEqual({ x: 500, y: 250 });
  });

  it("puts the north pole at the top and the south pole at the bottom", () => {
    // The sign of latitude is the easy one to get backwards, and getting it
    // backwards still produces a map that looks entirely plausible.
    expect(projectEquirectangular(90, 0, W, H).y).toBe(0);
    expect(projectEquirectangular(-90, 0, W, H).y).toBe(H);
  });

  it("puts the antimeridian at both edges", () => {
    expect(projectEquirectangular(0, -180, W, H).x).toBe(0);
    expect(projectEquirectangular(0, 180, W, H).x).toBe(W);
  });

  it("places Kuala Lumpur in the right quadrant", () => {
    // 3.1N, 101.7E: north of the equator, east of Greenwich.
    const { x, y } = projectEquirectangular(3.1, 101.7, W, H);
    expect(x).toBeGreaterThan(W / 2);
    expect(y).toBeLessThan(H / 2);
  });

  it("places Sydney south of the equator and San Francisco west of Greenwich", () => {
    expect(projectEquirectangular(-33.9, 151.2, W, H).y).toBeGreaterThan(H / 2);
    expect(projectEquirectangular(37.8, -122.4, W, H).x).toBeLessThan(W / 2);
  });
});

describe("agreement with the pre-rendered geometry", () => {
  const map = JSON.parse(readFileSync("src/lib/world-map.json", "utf8")) as {
    width: number;
    height: number;
    paths: Record<string, string>;
  };

  it("uses the same canvas the geometry was generated for", () => {
    expect(map.width).toBe(W);
    expect(map.height).toBe(H);
  });

  it("has geometry for the larger countries this invitation will see", () => {
    for (const code of ["MY", "AU", "GB", "US", "ID", "SA"]) {
      expect(map.paths[code], code).toBeTruthy();
    }
  });

  it("documents that the smallest countries have no polygon at this resolution", () => {
    // Singapore is below the 110m threshold (Brunei survives). This is not an
    // oversight: the 50m set that includes them is 1.1MB against 123KB and
    // lands in the Worker bundle, and at this canvas width Singapore is
    // about one pixel, so the fill would be invisible regardless.
    //
    // They are covered by the CITY DOTS, which are placed from coordinates
    // and do not need the polygon. If this test ever fails because the
    // geometry gained them, delete it — nothing depends on their absence.
    expect(map.paths.SG).toBeUndefined();
  });

  it("keeps every path inside the canvas", () => {
    // A projection change in the build script that this module did not
    // follow would show up here as coordinates off the canvas.
    for (const [code, d] of Object.entries(map.paths)) {
      for (const [, xs, ys] of d.matchAll(/([\d.-]+),([\d.-]+)/g)) {
        expect(Number(xs), code).toBeGreaterThanOrEqual(-1);
        expect(Number(xs), code).toBeLessThanOrEqual(W + 1);
        expect(Number(ys), code).toBeGreaterThanOrEqual(-1);
        expect(Number(ys), code).toBeLessThanOrEqual(H + 1);
      }
    }
  });
});
