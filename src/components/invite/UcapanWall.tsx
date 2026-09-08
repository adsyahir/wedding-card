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

    // Nothing to drift through if everything already fits.
    if (el.scrollHeight <= el.clientHeight + 4) return;

    /*
     * NOT `scroll-smooth`. CSS `scroll-behavior: smooth` turns every
     * `scrollTop` write into its own animated scroll, so writing once per
     * frame queues sixty overlapping animations a second that fight each
     * other — measured as accelerating to ~120px/s, stalling for seconds,
     * then jumping backwards. Programmatic per-frame scrolling needs the
     * default instant behaviour.
     */
    let frame = 0;
    let lastTs = 0;
    let pausedUntil = 0;
    let resumeAt = 0;
    let cancelled = false;

    /*
     * Any interaction stops the drift and holds it for RESUME_AFTER_MS. The
     * guest reading a particular wish should never have it slide out from
     * under them — the drift exists to show that there ARE more wishes, not
     * to fight whoever is reading them.
     */
    const hold = () => {
      resumeAt = performance.now() + RESUME_AFTER_MS;
    };

    const step = (ts: number) => {
      // `cancelled` as well as cancelAnimationFrame: under dev fast-refresh
      // an already-queued callback can still fire after cleanup, and each
      // one reschedules itself. Left unguarded they accumulate, and the
      // drift measurably ran away from 15px/s to ~300px/s.
      if (cancelled) return;
      frame = requestAnimationFrame(step);

      // Clamp the frame delta. A backgrounded tab or a long main-thread
      // stall produces a delta of seconds, which would otherwise be applied
      // as one enormous jump the moment the page becomes visible again.
      const raw = lastTs ? ts - lastTs : 0;
      const delta = Math.min(raw, 50);
      lastTs = ts;

      if (ts < pausedUntil || ts < resumeAt) return;

      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;

      // `scrollTop` is fractional-capable, so a sub-pixel-per-frame rate
      // accumulates smoothly instead of stuttering one whole pixel at a time.
      const next = el.scrollTop + (DRIFT_PX_PER_SECOND * delta) / 1000;

      if (next >= max) {
        el.scrollTop = max;
        pausedUntil = ts + EDGE_PAUSE_MS;
        // Back to the top rather than reversing: a list that scrolls
        // backwards reads as broken.
        window.setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = 0;
        }, EDGE_PAUSE_MS);
        return;
      }

      el.scrollTop = next;
    };

    frame = requestAnimationFrame(step);

    const events: (keyof HTMLElementEventMap)[] = [
      "pointerdown",
      "pointermove",
      "wheel",
      "touchstart",
      "touchmove",
      "keydown",
      "focusin",
    ];
    for (const name of events) el.addEventListener(name, hold, { passive: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
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
        <Reveal delay={0.1} className="relative mx-auto mt-8 max-w-md">
          {/*
            A fixed-height window rather than the full list: with fifty
            wishes the page becomes mostly wall, and everything below it
            (kehadiran, the hashtag) falls off the end of a long scroll.

            20rem shows two or three wishes at a time. Taller reads as the
            whole page being the wall; shorter and the drift has nothing to
            reveal. The edge fade shrinks with it, since 2rem at each end of
            a 20rem box eats a fifth of the readable area.
          */}
          <div
            ref={scrollRef}
            tabIndex={0}
            role="region"
            aria-label="Ucapan daripada tetamu"
            className="no-scrollbar fade-edges max-h-[20rem] overflow-y-auto px-1 [--fade:1.5rem]"
          >
            <div className="flex flex-col gap-6 py-2 text-center">
              {wishes.map((wish, index) => (
                <div key={`${wish.name}-${wish.createdAt}-${index}`} className="px-2">
                  <p className="font-serif text-base leading-7 text-brown-deep italic">
                    &ldquo;{wish.message}&rdquo;
                  </p>
                  <p className="mt-2 text-xs font-medium tracking-[0.15em] text-brown uppercase">
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
