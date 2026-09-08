"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";

import type { AdminDict } from "@/lib/i18n/admin-dict";

/** One city marker, positioned as a fraction of the map's own box. */
export type MapMarker = {
  key: string;
  /** 0..1 across the map. */
  fx: number;
  /** 0..1 down the map. */
  fy: number;
  /** Radius in CSS pixels, constant regardless of zoom. */
  r: number;
  label: string;
};

/**
 * Zoom and pan for the analytics map.
 *
 * The map itself stays a SERVER component: its 115KB of country geometry is
 * passed in as `children` and rendered to HTML, never to JavaScript. This
 * wrapper only owns three numbers and a CSS transform, so adding
 * interaction costs the browser a couple of hundred bytes rather than the
 * whole world.
 *
 * A CSS transform rather than a moving `viewBox`, for the same reason: the
 * viewBox lives on server-rendered markup this component never re-renders.
 * The browser also composites a transform on the GPU, so dragging stays
 * smooth on a phone where re-projecting 173 country paths would not.
 *
 * CITY MARKERS ARE NOT INSIDE THAT TRANSFORM. A transform scales everything
 * under it, so at 8x the dots were eight times wider too and swallowed the
 * country they were marking. Every real map keeps markers at a constant
 * screen size and scales only the geography. So the markers live in an
 * unscaled overlay, and their POSITIONS are computed through the same
 * transform by hand — one multiply and one add each, for a couple of dozen
 * points.
 */

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const STEP = 1.6;

export function MapViewport({
  dict,
  markers,
  children,
}: {
  dict: AdminDict;
  markers: MapMarker[];
  children: ReactNode;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  /*
   * Panning is clamped so the map cannot be dragged off its own frame and
   * lost. At scale 1 there is nothing to pan, so the allowance is zero and
   * the map snaps back to centre — which also means zooming out always
   * returns to a sane view without a separate reset.
   */
  function clamp(next: { x: number; y: number }, atScale: number) {
    const frame = frameRef.current;
    if (!frame) return next;
    const maxX = (frame.clientWidth * (atScale - 1)) / 2;
    const maxY = (frame.clientHeight * (atScale - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function zoomTo(nextScale: number) {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    setScale(clamped);
    setOffset((current) => clamp(current, clamped));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (scale === 1) return;
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset(
      clamp(
        { x: drag.ox + (event.clientX - drag.x), y: drag.oy + (event.clientY - drag.y) },
        scale,
      ),
    );
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const zoomed = scale > 1;

  return (
    <div className="relative">
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // No wheel handler: hijacking the wheel on a page you scroll with
        // the wheel makes the dashboard feel broken. Zoom is the buttons.
        className={`overflow-hidden rounded-lg ${
          zoomed ? "cursor-grab active:cursor-grabbing touch-none" : ""
        }`}
      >
        <div
          className="relative"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center",
            transition: dragRef.current ? "none" : "transform 200ms ease-out",
          }}
        >
          {children}
        </div>

        {/*
          The same transform, applied to POSITIONS only. A point at fraction
          `f` of the box lands at `0.5 + (f - 0.5) * scale` once scaled about
          the centre, then shifts by the pan offset. `pointer-events-none` so
          the layer never intercepts a drag; each marker re-enables them for
          its own tooltip.
        */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {markers.map((marker) => (
            <span
              key={marker.key}
              title={marker.label}
              className="pointer-events-auto absolute rounded-full bg-brown-deep/60 ring-2 ring-cream/70"
              style={{
                left: `calc(${(0.5 + (marker.fx - 0.5) * scale) * 100}% + ${offset.x}px)`,
                top: `calc(${(0.5 + (marker.fy - 0.5) * scale) * 100}% + ${offset.y}px)`,
                width: marker.r * 2,
                height: marker.r * 2,
                marginLeft: -marker.r,
                marginTop: -marker.r,
                transition: dragRef.current ? "none" : "left 200ms ease-out, top 200ms ease-out",
              }}
            />
          ))}
        </div>
      </div>

      <div className="absolute top-2 right-2 flex flex-col overflow-hidden rounded-lg border border-tan/50 bg-cream/95 shadow-sm">
        <button
          type="button"
          onClick={() => zoomTo(scale * STEP)}
          disabled={scale >= MAX_SCALE}
          aria-label={dict.analytics_mapZoomIn}
          className="flex h-8 w-8 cursor-pointer items-center justify-center text-lg leading-none text-brown-deep transition hover:bg-tan/20 disabled:opacity-30"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomTo(scale / STEP)}
          disabled={scale <= MIN_SCALE}
          aria-label={dict.analytics_mapZoomOut}
          className="flex h-8 w-8 cursor-pointer items-center justify-center border-t border-tan/40 text-lg leading-none text-brown-deep transition hover:bg-tan/20 disabled:opacity-30"
        >
          −
        </button>
        {zoomed && (
          <button
            type="button"
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
            aria-label={dict.analytics_mapReset}
            className="flex h-8 w-8 cursor-pointer items-center justify-center border-t border-tan/40 text-brown-deep transition hover:bg-tan/20"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
