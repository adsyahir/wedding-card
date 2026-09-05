"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/** Botanical corner flourish used on the envelope doors. */
function CornerOrnament({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      width="64"
      height="64"
      role="presentation"
      aria-hidden="true"
      className={`text-goldenrod/40 ${className}`}
    >
      <path
        d="M4 4 C 30 4, 30 20, 20 24 C 34 20, 40 30, 40 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4 4 C 4 30, 20 30, 24 20 C 20 34, 30 40, 40 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="4" cy="4" r="3" fill="currentColor" />
    </svg>
  );
}

export function Envelope({
  groomShortName,
  brideShortName,
  onOpen,
}: {
  groomShortName: string;
  brideShortName: string;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const html = document.documentElement;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = "";
    };
  }, []);

  function handleOpen() {
    if (open) return;
    setOpen(true);
    onOpen();
    const durationMs = prefersReducedMotion ? 50 : 1150;
    window.setTimeout(() => {
      document.documentElement.style.overflow = "";
      setMounted(false);
    }, durationMs);
  }

  if (!mounted) return null;

  const doorTransition = prefersReducedMotion
    ? { duration: 0.05 }
    : { duration: 1.1, ease: [0.65, 0, 0.35, 1] as const };

  return (
    <AnimatePresence>
      {mounted && (
        <motion.div
          className="fixed inset-0 z-50 overflow-hidden bg-sand"
          aria-hidden={open || undefined}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Left door */}
          <motion.div
            className="absolute inset-y-0 left-0 w-1/2 bg-sand border-r border-goldenrod/30 flex items-center justify-end"
            animate={open ? { x: "-100%" } : { x: 0 }}
            transition={doorTransition}
          >
            <CornerOrnament className="absolute top-4 left-4" />
            <CornerOrnament className="absolute bottom-4 left-4 rotate-90" />
          </motion.div>

          {/* Right door */}
          <motion.div
            className="absolute inset-y-0 right-0 w-1/2 bg-sand border-l border-goldenrod/30 flex items-center justify-start"
            animate={open ? { x: "100%" } : { x: 0 }}
            transition={doorTransition}
          >
            <CornerOrnament className="absolute top-4 right-4 rotate-90 scale-x-[-1]" />
            <CornerOrnament className="absolute bottom-4 right-4 rotate-180 scale-x-[-1]" />
          </motion.div>

          {/* Wax seal */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ opacity: open ? 0 : 1 }}
            transition={{ duration: prefersReducedMotion ? 0.05 : 0.4 }}
          >
            <button
              type="button"
              onClick={handleOpen}
              disabled={open}
              className="group flex h-40 w-40 flex-col items-center justify-center gap-1 rounded-full border-2 border-goldenrod bg-tan text-brown-deep shadow-lg transition-transform hover:scale-105 focus-visible:scale-105"
              aria-label={`Buka jemputan perkahwinan ${groomShortName} & ${brideShortName}`}
            >
              <span className="font-script text-2xl leading-none">
                {groomShortName} &amp; {brideShortName}
              </span>
              <span className="mt-2 text-[11px] font-sans font-medium tracking-[0.3em]">
                BUKA
              </span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
