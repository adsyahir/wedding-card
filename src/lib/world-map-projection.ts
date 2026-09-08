/**
 * The projection used by the analytics map, kept in one place so the
 * pre-render script and the renderer cannot disagree.
 *
 * Equirectangular: longitude maps linearly to x, latitude linearly to y.
 * It distorts area badly toward the poles — Greenland is comically large —
 * but it is the only projection where a city dot can be placed from its
 * coordinates with two divisions and no projection library on the server.
 * For "which countries are these guests in", that is the right trade.
 *
 * `scripts/build-world-map.mjs` is plain .mjs and cannot import this
 * TypeScript module, so it carries the same two expressions inline. The
 * tests pin the anchor points that would catch them drifting apart — a
 * flipped sign here puts every dot in the wrong hemisphere while the map
 * still looks perfectly fine.
 */
export function projectEquirectangular(
  lat: number,
  lng: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  };
}
