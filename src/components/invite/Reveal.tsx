"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ComponentType, ElementType, ReactNode } from "react";

/**
 * `motion.create()` returns a NEW component type on every call. Calling it
 * during render therefore hands React a different type each time, so React
 * unmounts and remounts the whole subtree — which replays the reveal
 * animation on every single re-render.
 *
 * That was invisible for static sections but very visible in the countdown,
 * which re-renders once a second: the numbers appeared to flicker because
 * the entire grid was being torn down and faded back in every tick.
 *
 * Caching by element type means each tag gets exactly one stable component
 * for the life of the module.
 */
const motionComponentCache = new Map<ElementType, ComponentType<Record<string, unknown>>>();

function getMotionComponent(component: ElementType) {
  const cached = motionComponentCache.get(component);
  if (cached) return cached;
  const created = motion.create(component) as ComponentType<Record<string, unknown>>;
  motionComponentCache.set(component, created);
  return created;
}

/**
 * Fade + small translate-y reveal, triggered once when the element scrolls
 * into view. Respects `prefers-reduced-motion` by skipping the transform
 * (and shortening the transition) entirely.
 *
 * TWO ROBUSTNESS NOTES, both learned the hard way:
 *
 * 1. `data-reveal` pairs with a `<noscript>` rule in the root layout that
 *    forces these elements visible. The server-rendered HTML carries an
 *    inline `opacity:0`, so without that override a guest whose JavaScript
 *    fails to load — a flaky connection, a locked-down in-app browser —
 *    would see a blank invitation. This card gets forwarded around
 *    WhatsApp to relatives on all sorts of devices; a blank card is the
 *    worst failure it could have.
 *
 * 2. `amount` is deliberately low (0.15, not 0.3). A tall section on a
 *    short phone screen may never have 30% of itself visible at once, in
 *    which case the reveal would never fire and the content would stay
 *    invisible while the guest scrolled straight past it.
 */
export function Reveal({
  children,
  as: Component = "div",
  className,
  delay = 0,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const MotionComponent = getMotionComponent(Component);

  return (
    <MotionComponent
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: prefersReducedMotion ? 0.01 : 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </MotionComponent>
  );
}
