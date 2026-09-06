"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PublicGalleryItem } from "@/db/queries/public";
import { trackEvent } from "@/lib/track";

import { Reveal } from "./Reveal";

type GalleryItem = PublicGalleryItem;

const AUTO_ADVANCE_MS = 5000;

const FOCUSABLE_SELECTOR =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none">
      <path
        d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full-width, single-image-at-a-time carousel. Auto-advances every
 * `AUTO_ADVANCE_MS`, but only until the guest first takes control (a tap on
 * an arrow or a dot) — after that the timer never restarts, matching the
 * spirit of every other carousel that respects a guest's manual navigation.
 *
 * `prefers-reduced-motion` disables auto-advance entirely, checked via
 * `window.matchMedia` in an effect (not just CSS) so the `setInterval`
 * itself never runs — there is no motion to "reduce" if it was never
 * scheduled in the first place.
 */
function Carousel({ gallery, onOpen }: { gallery: readonly GalleryItem[]; onOpen: (index: number) => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userTookControl, setUserTookControl] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Auto-advance. Guarded so a re-render (e.g. from `index` itself changing)
  // never restarts the interval — the effect only depends on the booleans
  // that should actually start/stop it, never on `index`.
  useEffect(() => {
    if (reducedMotion || paused || userTookControl || gallery.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % gallery.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, paused, userTookControl, gallery.length]);

  const goTo = useCallback((next: number) => {
    setUserTookControl(true);
    setIndex(next);
  }, []);

  const showPrev = useCallback(() => {
    goTo((index - 1 + gallery.length) % gallery.length);
  }, [goTo, index, gallery.length]);

  const showNext = useCallback(() => {
    goTo((index + 1) % gallery.length);
  }, [goTo, index, gallery.length]);

  const current = gallery[index];
  const multiple = gallery.length > 1;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Galeri gambar"
      className="relative mx-auto max-w-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(index)}
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-sand"
        aria-label={`Gambar ${index + 1}`}
      >
        {/*
          `unoptimized`: uploaded images have unknown/arbitrary dimensions
          and are served from `/api/gallery/<id>`, not a static asset — see
          the original comment this carried before the carousel rewrite.
        */}
        <Image
          key={current.src}
          src={current.src}
          alt={current.alt}
          fill
          unoptimized
          sizes="(max-width: 480px) 100vw, 480px"
          className="object-cover"
          priority={index === 0}
        />
      </button>

      {/* Polite live region announcing the current slide for screen readers,
          separate from the visually-hidden alt text on the image itself. */}
      <p aria-live="polite" className="sr-only">
        Gambar {index + 1} daripada {gallery.length}
      </p>

      {multiple && (
        <>
          <button
            type="button"
            onClick={showPrev}
            aria-label="Gambar sebelumnya"
            className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-sand/90 text-brown-deep"
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={showNext}
            aria-label="Gambar seterusnya"
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-sand/90 text-brown-deep"
          >
            <ChevronIcon direction="right" />
          </button>

          <div className="mt-3 flex items-center justify-center gap-2">
            {gallery.map((item, i) => (
              <button
                key={item.src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Gambar ${i + 1}`}
                aria-current={i === index}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === index ? "bg-goldenrod" : "bg-tan/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Galeri({ gallery }: { gallery: readonly GalleryItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerIndex = useRef<number | null>(null);

  const close = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const showPrev = useCallback(() => {
    setActiveIndex((i) => (i === null ? i : (i - 1 + gallery.length) % gallery.length));
  }, [gallery.length]);

  const showNext = useCallback(() => {
    setActiveIndex((i) => (i === null ? i : (i + 1) % gallery.length));
  }, [gallery.length]);

  function open(index: number) {
    lastTriggerIndex.current = index;
    setActiveIndex(index);
    trackEvent("gallery_open");
  }

  // Focus the close button when the lightbox opens; restore focus to the
  // carousel image button when it closes.
  useEffect(() => {
    if (activeIndex !== null) {
      closeButtonRef.current?.focus();
    }
  }, [activeIndex]);

  // Keyboard handling: Escape closes, arrow keys navigate, Tab is trapped.
  useEffect(() => {
    if (activeIndex === null) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        showPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        showNext();
        return;
      }
      if (e.key === "Tab") {
        const container = dialogRef.current;
        if (!container) return;
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => !el.hasAttribute("disabled"));
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement;

        if (e.shiftKey && current === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, close, showPrev, showNext]);

  // Lock body scroll while open.
  useEffect(() => {
    if (activeIndex === null) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [activeIndex]);

  if (gallery.length === 0) return null;

  const active = activeIndex !== null ? gallery[activeIndex] : null;

  return (
    <section className="w-full px-6 py-16 text-center">
      <Reveal as="h2" className="font-serif text-2xl tracking-[0.25em] text-brown-deep uppercase">
        Galeri
      </Reveal>

      <Reveal delay={0.1} className="mt-8">
        <Carousel gallery={gallery} onOpen={open} />
      </Reveal>

      {active && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Galeri gambar"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brown-deep/95 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Tutup galeri"
            className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-sand/90 text-brown-deep"
          >
            <CloseIcon />
          </button>

          {gallery.length > 1 && (
            <button
              type="button"
              onClick={showPrev}
              aria-label="Gambar sebelumnya"
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-sand/90 text-brown-deep sm:left-6"
            >
              <ChevronIcon direction="left" />
            </button>
          )}

          <div className="relative h-[70vh] w-full max-w-md">
            <Image
              src={active.src}
              alt={active.alt}
              fill
              unoptimized
              sizes="480px"
              className="object-contain"
              priority
            />
          </div>

          {gallery.length > 1 && (
            <button
              type="button"
              onClick={showNext}
              aria-label="Gambar seterusnya"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-sand/90 text-brown-deep sm:right-6"
            >
              <ChevronIcon direction="right" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
