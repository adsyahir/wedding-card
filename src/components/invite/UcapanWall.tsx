"use client";

import { useEffect, useRef } from "react";

import { Reveal } from "./Reveal";

export type PublicWish = {
  name: string;
  message: string;
  createdAt: string;
};

/** Pixels per second the wall drifts while nobody is touching it. Slow enough to read along with. */
const DRIFT_PX_PER_SECOND = 14;

/** How long after the guest stops interacting before the drift resumes. */
const RESUME_AFTER_MS = 2500;

/** Pause at each end before looping, so the last wish is actually readable. */
const EDGE_PAUSE_MS = 2000;

export function UcapanWall({ wishes }: { wishes: PublicWish[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Someone who asked for reduced motion gets a plain scrollable list.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let lastTs = 0;
    let pausedUntil = 0;
    let resumeAt = 0;
    let running = false;

    /*
     * The position is kept HERE, not read back from the DOM each frame.
     * At 14px/second a frame advances about 0.23px, and accumulating that
     * by reading `scrollTop` back invites the browser's own rounding into
     * the loop. Owning the float and writing it out keeps the rate exact.
     */
    let pos = el.scrollTop;

    /*
     * NOT `scroll-smooth`. CSS `scroll-behavior: smooth` turns every
     * `scrollTop` write into its own animated scroll, so writing once per
     * frame queues sixty overlapping animations a second that fight each
     * other — measured as accelerating to ~120px/s, stalling for seconds,
     * then jumping backwards. Programmatic per-frame scrolling needs the
     * default instant behaviour.
     */
    const step = (ts: number) => {
      if (!running) return;
      frame = requestAnimationFrame(step);

      // Clamp the frame delta. A backgrounded tab or a long main-thread
      // stall produces a delta of seconds, which would otherwise be applied
      // as one enormous jump the moment the page becomes visible again.
      const raw = lastTs ? ts - lastTs : 0;
      const delta = Math.min(raw, 50);
      lastTs = ts;

      if (ts < pausedUntil || ts < resumeAt) return;

      // Re-checked every frame rather than once at mount: the wall may not
      // overflow until the web fonts have swapped in.
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 4) return;

      pos += (DRIFT_PX_PER_SECOND * delta) / 1000;

      if (pos >= max) {
        pos = max;
        el.scrollTop = max;
        pausedUntil = ts + EDGE_PAUSE_MS;
        // Back to the top rather than reversing: a list that scrolls
        // backwards reads as broken.
        window.setTimeout(() => {
          pos = 0;
          if (scrollRef.current) scrollRef.current.scrollTop = 0;
        }, EDGE_PAUSE_MS);
        return;
      }

      el.scrollTop = pos;
    };

    const start = () => {
      if (running) return;
      running = true;
      lastTs = 0;
      pos = el.scrollTop;
      frame = requestAnimationFrame(step);
    };

    const stop = () => {
      running = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    /*
     * The drift starts when the guest actually REACHES the wall, and stops
     * when they leave it.
     *
     * Starting on mount was wrong twice over: the whole card is one long
     * page, so the wall would quietly scroll itself to the bottom while the
     * guest was still reading the doa, and by the time they arrived the
     * first wishes had already gone past. It also burned a rAF loop for the
     * entire visit. 40% visible is the threshold — enough that the wall is
     * genuinely on screen rather than one line peeking over the fold.
     */
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start();
        else stop();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);

    /*
     * Any interaction stops the drift and holds it for RESUME_AFTER_MS. The
     * guest reading a particular wish should never have it slide out from
     * under them — the drift exists to show that there ARE more wishes, not
     * to fight whoever is reading them.
     */
    const hold = () => {
      resumeAt = performance.now() + RESUME_AFTER_MS;
      // Adopt wherever the guest scrolled to, rather than resuming from the
      // drift's own stale idea of the position and yanking them back.
      pos = el.scrollTop;
    };

    const events: (keyof HTMLElementEventMap)[] = [
      "pointerdown",
      "wheel",
      "touchstart",
      "touchmove",
      "keydown",
      "focusin",
    ];
    for (const name of events) el.addEventListener(name, hold, { passive: true });

    return () => {
      stop();
      observer.disconnect();
      for (const name of events) el.removeEventListener(name, hold);
    };
  }, [wishes.length]);

  return (
    <section className="w-full px-6 py-16 text-center">
      <Reveal as="h2" className="font-serif text-2xl tracking-[0.25em] text-brown-deep uppercase">
        Ucapan
      </Reveal>

      {wishes.length === 0 ? (
        <Reveal delay={0.1} className="mx-auto mt-8 max-w-sm text-brown">
          <p>Jadilah yang pertama menyampaikan ucapan.</p>
        </Reveal>
      ) : (
        <Reveal delay={0.1} className="relative mx-auto mt-8 max-w-[16rem]">
          {/*
            A fixed-height window rather than the full list: with fifty
            wishes the page becomes mostly wall, and everything below it
            (kehadiran, the hashtag) falls off the end of a long scroll.

            Sized to match the reference card the design follows
            (kadkahwinmy.com/invite/26761/drsyazni-ariff), measured off the
            live page rather than eyeballed: a 258x236px scroll window,
            14.4px/20px body text, a 12.6px uppercase name 4px under it, and
            20px between one wish and the next.

            The BOX follows the reference; the TYPE deliberately does not.
            The reference sets its wishes in the body sans, but the italic
            Cormorant is what makes these read as quoted voices rather than
            interface text, and it is the choice this card was asked for.
            Size comes up from the reference's 14.4px to 16px to compensate:
            Cormorant has a small x-height, so at 14px it would be markedly
            harder to read than the sans it replaces.

            No edge fade, as the reference has none: it hard-clips, so a
            wish is cut mid-line at the bottom, which is what tells you the
            list continues.
          */}
          <div
            ref={scrollRef}
            tabIndex={0}
            role="region"
            aria-label="Ucapan daripada tetamu"
            className="no-scrollbar max-h-[14.75rem] overflow-y-auto"
          >
            <div className="flex flex-col gap-6 py-2 text-center">
              {wishes.map((wish, index) => (
                <div key={`${wish.name}-${wish.createdAt}-${index}`}>
                  <p className="font-serif text-base leading-7 text-brown-deep italic">
                    &ldquo;{wish.message}&rdquo;
                  </p>
                  <p className="mt-1.5 text-[0.7rem] font-medium tracking-[0.15em] text-brown uppercase">
                    {wish.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}
    </section>
  );
}
