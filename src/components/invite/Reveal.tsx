"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ElementType, ReactNode } from "react";

/**
 * Fade + small translate-y reveal, triggered once when the element scrolls
 * into view. Respects `prefers-reduced-motion` by skipping the transform
 * (and shortening the transition) entirely.
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
  const MotionComponent = motion.create(Component);

  return (
    <MotionComponent
      className={className}
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: prefersReducedMotion ? 0.01 : 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </MotionComponent>
  );
}
