/**
 * Hand-built botanical corner ornament.
 *
 * The card is full-bleed on a phone, so these corners are the only
 * decoration a guest ever sees framing the content — the page background
 * behind the card is invisible at that width. They therefore need to
 * actually read as foliage at arm's length, which the previous 88px of
 * thin abstract curve at 25% opacity did not.
 *
 * Drawn rather than sourced: the reference sites use licensed watercolour
 * stock, which this can't copy. Two-tone (sage leaves, goldenrod stems and
 * berries) because real wedding florals are never monochrome, and an
 * all-warm ornament on a warm ground disappears.
 */

type Leaf = { x: number; y: number; rotate: number; scale?: number };

/** A single leaf: a lens shape, pointed at both ends. */
function LeafShape({ x, y, rotate, scale = 1 }: Leaf) {
  return (
    <path
      d="M0 0 Q 13 -7 26 0 Q 13 7 0 0 Z"
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
    />
  );
}

const STEM_A = "M10 10 C 52 14, 66 40, 60 70 C 58 86, 66 100, 82 108";
const STEM_B = "M10 10 C 14 52, 40 66, 70 60 C 86 58, 100 66, 108 82";

const LEAVES_A: Leaf[] = [
  { x: 30, y: 14, rotate: 8 },
  { x: 52, y: 26, rotate: 52, scale: 0.9 },
  { x: 40, y: 40, rotate: 158, scale: 0.85 },
  { x: 62, y: 56, rotate: 78, scale: 0.8 },
  { x: 48, y: 72, rotate: 192, scale: 0.7 },
  { x: 66, y: 92, rotate: 66, scale: 0.65 },
];

const LEAVES_B: Leaf[] = [
  { x: 14, y: 30, rotate: 82 },
  { x: 26, y: 52, rotate: 38, scale: 0.9 },
  { x: 40, y: 40, rotate: 292, scale: 0.85 },
  { x: 56, y: 62, rotate: 12, scale: 0.8 },
  { x: 72, y: 48, rotate: 282, scale: 0.7 },
  { x: 92, y: 66, rotate: 24, scale: 0.65 },
];

const BERRIES = [
  { cx: 44, cy: 30, r: 3.2 },
  { cx: 30, cy: 44, r: 3.2 },
  { cx: 74, cy: 74, r: 2.6 },
  { cx: 20, cy: 18, r: 2.2 },
];

export function BotanicalCorner({
  className = "",
  size = 150,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 130 130"
      width={size}
      height={size}
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      <g stroke="var(--color-goldenrod)" strokeWidth="1.1" fill="none" opacity="0.55">
        <path d={STEM_A} />
        <path d={STEM_B} />
      </g>

      <g fill="var(--color-sage)" opacity="0.42">
        {LEAVES_A.map((leaf, i) => (
          <LeafShape key={`a${i}`} {...leaf} />
        ))}
      </g>

      <g fill="var(--color-sage-light)" opacity="0.5">
        {LEAVES_B.map((leaf, i) => (
          <LeafShape key={`b${i}`} {...leaf} />
        ))}
      </g>

      <g fill="var(--color-goldenrod)" opacity="0.6">
        {BERRIES.map((berry, i) => (
          <circle key={i} {...berry} />
        ))}
      </g>
    </svg>
  );
}

/**
 * A slim horizontal sprig, for framing a section heading. Mirrors the
 * corner ornament's two-tone treatment at a smaller scale.
 */
export function BotanicalRule({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 24"
      width="180"
      height="22"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 12 H 76 M124 12 H 192"
        stroke="var(--color-gold-light)"
        strokeWidth="1"
        opacity="0.7"
      />
      <g fill="var(--color-sage)" opacity="0.5">
        <path d="M0 0 Q 11 -6 22 0 Q 11 6 0 0 Z" transform="translate(80 12) rotate(200)" />
        <path d="M0 0 Q 11 -6 22 0 Q 11 6 0 0 Z" transform="translate(120 12) rotate(-20)" />
      </g>
      <circle cx="100" cy="12" r="3" fill="var(--color-goldenrod)" opacity="0.65" />
    </svg>
  );
}
