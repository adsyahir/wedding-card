/**
 * Slowly drifting leaves behind the invitation content.
 *
 * Deliberately a SERVER component with pure-CSS animation, not a client
 * component driving frames in JavaScript:
 *
 * - No hydration mismatch. Every petal's position, delay and duration comes
 *   from the fixed table below rather than `Math.random()`, so the server
 *   and client render byte-identical markup. Randomising at render time is
 *   the classic way this effect breaks React.
 * - No JavaScript cost. These animate on `transform` and `opacity` only,
 *   which the compositor handles without touching layout or paint — it
 *   keeps working on a cheap phone over a bad connection, and it still
 *   works if the page's JS never loads at all.
 * - `prefers-reduced-motion` hides the whole layer in CSS (see
 *   `globals.css`), so a guest who asked for stillness gets stillness
 *   rather than a frozen scattering of leaves mid-fall.
 *
 * The layer is fixed to the viewport and clipped to the card's width, so
 * leaves drift past the content as the guest scrolls instead of being
 * pinned to one spot in a very long page. `pointer-events: none` means it
 * can never swallow a tap on the RSVP button underneath.
 */

type Petal = {
  /** Horizontal position, % of the card width. */
  left: number;
  /** Seconds before this leaf first appears — negative starts mid-fall. */
  delay: number;
  /** Seconds for one full top-to-bottom drift. */
  duration: number;
  scale: number;
  /** Which of the two sway keyframes, so they don't move in lockstep. */
  variant: 1 | 2;
  sage: boolean;
};

/**
 * Twelve is enough to feel alive and few enough to stay unobtrusive.
 * Negative delays stagger them so the effect is already underway on load
 * rather than starting with an empty screen that slowly fills.
 */
const PETALS: Petal[] = [
  { left: 6, delay: -2, duration: 26, scale: 0.7, variant: 1, sage: true },
  { left: 17, delay: -14, duration: 34, scale: 0.5, variant: 2, sage: false },
  { left: 28, delay: -7, duration: 29, scale: 0.85, variant: 1, sage: true },
  { left: 38, delay: -21, duration: 38, scale: 0.6, variant: 2, sage: true },
  { left: 47, delay: -4, duration: 31, scale: 0.45, variant: 1, sage: false },
  { left: 56, delay: -17, duration: 27, scale: 0.75, variant: 2, sage: true },
  { left: 66, delay: -10, duration: 36, scale: 0.55, variant: 1, sage: false },
  { left: 74, delay: -25, duration: 30, scale: 0.8, variant: 2, sage: true },
  { left: 83, delay: -6, duration: 33, scale: 0.5, variant: 1, sage: true },
  { left: 91, delay: -19, duration: 28, scale: 0.65, variant: 2, sage: false },
  { left: 12, delay: -30, duration: 40, scale: 0.4, variant: 2, sage: true },
  { left: 61, delay: -35, duration: 42, scale: 0.42, variant: 1, sage: false },
];

export function Petals() {
  return (
    <div className="petal-layer" aria-hidden="true">
      {PETALS.map((petal, i) => (
        <span
          key={i}
          className={`petal petal--sway${petal.variant}`}
          style={{
            left: `${petal.left}%`,
            animationDelay: `${petal.delay}s`,
            animationDuration: `${petal.duration}s`,
          }}
        >
          <svg
            viewBox="0 0 26 14"
            width={26 * petal.scale}
            height={14 * petal.scale}
            role="presentation"
            focusable="false"
          >
            <path
              d="M0 7 Q 13 0 26 7 Q 13 14 0 7 Z"
              fill={petal.sage ? "var(--color-sage)" : "var(--color-gold-light)"}
            />
          </svg>
        </span>
      ))}
    </div>
  );
}
