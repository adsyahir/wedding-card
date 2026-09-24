import Image from "next/image";

/**
 * The floral border around the first page.
 *
 * THE ARTWORK IS A SUPPLIED ASSET, not something drawn here. An earlier
 * version of this component built the frame from SVG petals and leaves; it
 * was replaced because vector shapes cannot produce the soft washes and
 * bleeding edges of a painted border, and the difference is obvious at the
 * size this is shown. The drawn version is in this file's git history if it
 * is ever wanted back — swapping is a one-line change here, since the
 * component's contract to `Hero` is unchanged.
 *
 * Licensing for `floral-border.webp` rests with whoever added it: it was
 * provided for this card, and nothing here verifies its terms.
 *
 * `z-0` here and `z-10` on the hero's content, because this image is OPAQUE
 * in the middle where the old SVG frame was transparent. An absolutely
 * positioned element paints above static siblings, so without the stacking
 * order being stated the border covered the couple's names completely —
 * the page rendered as an empty frame.
 *
 * `object-fill`, deliberately, where `object-cover` would be the usual
 * choice. A border has to meet all four edges of the card. The artwork is
 * 600x1080 (0.56) and the card runs nearer 0.46 on a phone, so `cover`
 * would scale to height and crop the left and right — taking the side
 * strips with it, which is precisely the part that makes this read as a
 * frame. Slight vertical stretch on soft watercolour shapes is far less
 * noticeable than a border missing down both sides.
 */
export function FloralFrame({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
    >
      <Image
        src="/images/frame/floral-border.webp"
        alt=""
        fill
        // Above the fold on the very first screen, so it is fetched eagerly
        // rather than lazily — a border that fades in after the names have
        // rendered reads as a loading glitch.
        priority
        sizes="(max-width: 480px) 100vw, 480px"
        className="object-fill"
      />
    </div>
  );
}
