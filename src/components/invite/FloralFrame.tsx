/**
 * The floral frame around the first page: a cluster in each corner and a
 * narrow pressed-botanical strip down each side.
 *
 * DRAWN HERE, NOT SOURCED. Every petal, leaf and wing below is our own
 * geometry, for the same reason `Botanical.tsx` is: the references this
 * follows are watercolour illustrations under someone else's licence. Ours
 * costs a couple of kilobytes, scales to any screen, and recolours with the
 * theme because every fill is a token.
 *
 * WHY IT REPLACES THE OLD CORNERS. `BotanicalCorner` is a thin stem with
 * three berries — at arm's length on a phone it reads as a stray mark rather
 * than as framing. This has enough mass to actually frame the page: layered
 * blooms of three different forms, so the eye reads a bouquet instead of a
 * repeated stamp.
 *
 * The strips are the part that makes it a frame rather than four ornaments.
 * They are deliberately faint — this sits behind the couple's names, and
 * anything louder competes with the one thing the page is for.
 */

type Petal = { rotate: number; rx?: number; ry?: number; cy?: number };

/** An open flower: petals swept around a centre, each one a touch different so it is not a rosette. */
function Bloom({
  x,
  y,
  scale = 1,
  rotate = 0,
  petal,
  centre,
  petals = DEFAULT_PETALS,
}: {
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  petal: string;
  centre: string;
  petals?: Petal[];
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      {petals.map((p, i) => (
        <g key={i} transform={`rotate(${p.rotate})`}>
          <ellipse cx="0" cy={p.cy ?? -13} rx={p.rx ?? 7.5} ry={p.ry ?? 13} fill={petal} />
          {/*
            A second ellipse at the petal's base, darker and smaller. Two
            tones is the least it takes to read as a painted petal rather
            than a filled shape — one flat colour is what made the first
            attempt look like clip-art.
          */}
          <ellipse
            cx="0"
            cy={(p.cy ?? -13) + 4}
            rx={(p.rx ?? 7.5) * 0.58}
            ry={(p.ry ?? 13) * 0.55}
            fill={petal}
            style={{ filter: "brightness(0.9)" }}
            opacity="0.85"
          />
        </g>
      ))}
      <circle r="4.6" fill={centre} />
      {/* Stamens: the detail that stops a flower reading as a cog. */}
      <g stroke={centre} strokeWidth="0.9" strokeLinecap="round" opacity="0.75">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <line key={a} x1="0" y1="0" x2="0" y2="-7.5" transform={`rotate(${a})`} />
        ))}
      </g>
    </g>
  );
}

const DEFAULT_PETALS: Petal[] = [
  { rotate: 0 },
  { rotate: 52, rx: 7, ry: 12.5 },
  { rotate: 108, rx: 8, ry: 13.5 },
  { rotate: 164, rx: 7.2, ry: 12 },
  { rotate: 216, rx: 7.8, ry: 13 },
  { rotate: 268, rx: 7, ry: 12.6 },
  { rotate: 312, rx: 7.6, ry: 13.2 },
];

/** A broader, ruffled flower — the poppy note that keeps the cluster from being uniform. */
function WideBloom({
  x,
  y,
  scale = 1,
  rotate = 0,
  petal,
  centre,
}: {
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  petal: string;
  centre: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      {[0, 72, 144, 216, 288].map((a, i) => (
        <g key={a} transform={`rotate(${a})`}>
          <path
            d="M0 0 C -15 -6, -17 -20, -8 -25 C -2 -28, 6 -25, 9 -18 C 12 -10, 7 -3, 0 0 Z"
            fill={petal}
            opacity={i % 2 ? 0.92 : 1}
          />
          <path
            d="M0 0 C -8 -4, -9 -12, -4 -15 C 0 -17, 4 -14, 5 -10 C 6 -5, 4 -2, 0 0 Z"
            fill={petal}
            style={{ filter: "brightness(0.9)" }}
            opacity="0.8"
          />
        </g>
      ))}
      <circle r="4.4" fill={centre} />
    </g>
  );
}

/** A closed bud on a short stem. */
function Bud({ x, y, rotate = 0, scale = 1, fill }: { x: number; y: number; rotate?: number; scale?: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d="M0 0 C -5 -4, -5 -13, 0 -17 C 5 -13, 5 -4, 0 0 Z" fill={fill} />
      <path d="M0 0 V 7" stroke="var(--color-sage)" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  );
}

/** A lens-shaped leaf with a midrib. */
function Leaf({ x, y, rotate = 0, scale = 1, fill }: { x: number; y: number; rotate?: number; scale?: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d="M0 0 Q 15 -8 30 0 Q 15 8 0 0 Z" fill={fill} />
      <path d="M2 0 H 27" stroke="var(--color-cream)" strokeWidth="0.7" opacity="0.45" />
    </g>
  );
}

/** A small butterfly: two pairs of wings, no body detail — it is 12px on a phone. */
function Butterfly({ x, y, rotate = 0, scale = 1 }: { x: number; y: number; rotate?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} opacity="0.75">
      <g fill="var(--bloom-rose)">
        <path d="M0 0 C -9 -10, -14 -5, -12 1 C -10 6, -4 5, 0 0 Z" />
        <path d="M0 0 C 9 -10, 14 -5, 12 1 C 10 6, 4 5, 0 0 Z" />
        <path d="M0 0 C -7 6, -9 12, -5 13 C -1 14, 0 7, 0 0 Z" opacity="0.85" />
        <path d="M0 0 C 7 6, 9 12, 5 13 C 1 14, 0 7, 0 0 Z" opacity="0.85" />
      </g>
      <line x1="0" y1="-2" x2="0" y2="9" stroke="var(--color-brown)" strokeWidth="0.9" opacity="0.6" />
    </g>
  );
}

/**
 * One corner cluster, drawn for the TOP-LEFT and mirrored by the caller with
 * CSS transforms — so the four corners are one drawing, not four.
 */
export function FloralCorner({ className = "", size = 190 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 190 190"
      width={size}
      height={size}
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      {/* Stems first, so everything else sits on top of them. */}
      <g fill="none" stroke="var(--color-sage)" strokeWidth="1.3" opacity="0.8">
        <path d="M6 8 C 46 18, 62 44, 58 78" />
        <path d="M6 8 C 18 46, 44 60, 78 56" />
        <path d="M30 4 C 52 26, 60 44, 62 62" />
      </g>

      {/*
        Leaves that sit BEHIND the blooms are leaves nobody sees — the first
        pass hid all four and the cluster read as flowers floating on
        nothing. These reach outward past the petals instead, which is also
        what gives the corner its diagonal sweep.
      */}
      <g opacity="0.95">
        <Leaf x={96} y={40} rotate={18} scale={1.05} fill="var(--color-sage)" />
        <Leaf x={40} y={104} rotate={104} scale={1} fill="var(--color-sage)" />
        <Leaf x={86} y={78} rotate={52} scale={0.8} fill="var(--color-sage-light)" />
        <Leaf x={12} y={64} rotate={128} scale={0.72} fill="var(--color-sage-light)" />
        <Leaf x={64} y={14} rotate={-16} scale={0.78} fill="var(--color-sage)" />
      </g>

      <Bud x={112} y={54} rotate={34} scale={1} fill="var(--bloom-mauve)" />
      <Bud x={30} y={118} rotate={-14} scale={0.9} fill="var(--bloom-peach)" />

      {/* The three blooms, largest nearest the corner so the mass sits outward. */}
      {/*
        Weighted to the corner and thinning along both edges, rather than
        one clump with empty space around it. Sizes step down as they travel
        outward so the eye reads depth.
      */}
      <WideBloom x={30} y={30} scale={1.2} rotate={-14} petal="var(--bloom-peach)" centre="var(--bloom-gold)" />
      <Bloom x={68} y={22} scale={0.92} rotate={16} petal="var(--bloom-rose)" centre="var(--bloom-gold)" />
      <Bloom x={22} y={70} scale={0.88} rotate={-28} petal="var(--bloom-mauve)" centre="var(--bloom-gold)" />
      <Bloom x={52} y={58} scale={0.58} rotate={40} petal="var(--bloom-blush)" centre="var(--bloom-gold)" />
      <Bloom x={102} y={16} scale={0.5} rotate={8} petal="var(--bloom-blush)" centre="var(--bloom-gold)" />
      <Bloom x={16} y={104} scale={0.46} rotate={-40} petal="var(--bloom-rose)" centre="var(--bloom-gold)" />

      {/* One butterfly, not two: at this size a second reads as a smudge. */}
      <Butterfly x={122} y={86} rotate={-18} scale={0.85} />
    </svg>
  );
}

/**
 * The pressed-botanical strip down a side edge.
 *
 * Repeats a single sprig at three sizes rather than tiling one, because a
 * visible repeat is exactly what makes a border look printed rather than
 * drawn. Faint on purpose: it frames the page, it does not decorate it.
 */
export function BotanicalStrip({ className = "" }: { className?: string }) {
  const sprigs = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <svg
      viewBox="0 0 34 560"
      preserveAspectRatio="none"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      <g opacity="0.5">
        {sprigs.map((i) => {
          const y = 18 + i * 70;
          const flip = i % 2 === 0 ? 1 : -1;
          const scale = 0.8 + ((i * 37) % 5) / 12;
          return (
            <g key={i} transform={`translate(17 ${y}) scale(${flip * scale} ${scale})`}>
              <path
                d="M0 0 C 6 12, 4 26, 0 38"
                fill="none"
                stroke="var(--color-sage)"
                strokeWidth="1.1"
              />
              <Leaf x={1} y={9} rotate={34} scale={0.38} fill="var(--color-sage)" />
              <Leaf x={2} y={20} rotate={-26} scale={0.32} fill="var(--color-sage-light)" />
              <Leaf x={1} y={31} rotate={48} scale={0.28} fill="var(--color-sage)" />
              {i % 3 === 0 && (
                <Bloom
                  x={3}
                  y={2}
                  scale={0.3}
                  petal="var(--bloom-blush)"
                  centre="var(--bloom-gold)"
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/**
 * The whole frame: four corners and two side strips, positioned absolutely
 * inside a `relative` parent.
 *
 * `pointer-events-none` throughout — this sits over the page and must never
 * swallow a tap meant for the seal or a nav item beneath it.
 */
export function FloralFrame({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <BotanicalStrip className="absolute inset-y-0 left-0 h-full w-[26px]" />
      <BotanicalStrip className="absolute inset-y-0 right-0 h-full w-[26px] -scale-x-100" />

      <FloralCorner className="absolute -top-3 -left-4" />
      <FloralCorner className="absolute -top-3 -right-4 -scale-x-100" />
      <FloralCorner className="absolute -bottom-3 -left-4 -scale-y-100" />
      <FloralCorner className="absolute -right-4 -bottom-3 -scale-x-100 -scale-y-100" />
    </div>
  );
}
