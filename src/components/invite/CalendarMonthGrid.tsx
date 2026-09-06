"use client";

import { useState } from "react";

import { buildCalendarGrid, type CalendarEventDate } from "@/lib/calendar-grid";
import { MALAY_DAYS_SHORT, MALAY_MONTHS_SHORT } from "@/lib/datetime-my";

/**
 * Static month grid shown inside the Kalendar sheet, gated on
 * `sections.kalendarGrid` (default on) by the caller. Purely presentational
 * — all the calendar-math lives in `src/lib/calendar-grid.ts`, unit-tested
 * there independently of the host timezone.
 */
export function CalendarMonthGrid({ event }: { event: CalendarEventDate }) {
  const [viewYear, setViewYear] = useState(event.year);
  const [viewMonth, setViewMonth] = useState(event.month); // 1-12

  function pageMonth(delta: -1 | 1) {
    setViewMonth((prevMonth) => {
      let nextMonth = prevMonth + delta;
      let nextYear = viewYear;
      if (nextMonth < 1) {
        nextMonth = 12;
        nextYear -= 1;
      } else if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      setViewYear(nextYear);
      return nextMonth;
    });
  }

  const weeks = buildCalendarGrid(viewYear, viewMonth, event);
  const headerLabel = `${MALAY_MONTHS_SHORT[viewMonth - 1]} ${viewYear}`;

  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => pageMonth(-1)}
          aria-label="Bulan sebelumnya"
          className="flex h-8 w-8 items-center justify-center rounded-full text-brown-deep hover:bg-tan/30"
        >
          ‹
        </button>
        <p className="font-serif text-sm font-medium tracking-[0.1em] text-brown-deep uppercase">
          {headerLabel}
        </p>
        <button
          type="button"
          onClick={() => pageMonth(1)}
          aria-label="Bulan seterusnya"
          className="flex h-8 w-8 items-center justify-center rounded-full text-brown-deep hover:bg-tan/30"
        >
          ›
        </button>
      </div>

      <div role="grid" aria-label={headerLabel} className="mt-2">
        <div role="row" className="grid grid-cols-7 gap-y-1 text-center">
          {MALAY_DAYS_SHORT.map((d) => (
            <span key={d} role="columnheader" className="text-[11px] font-medium text-brown/60">
              {d}
            </span>
          ))}
        </div>

        {weeks.map((week, i) => (
          <div key={i} role="row" className="grid grid-cols-7 gap-y-1 text-center">
            {week.map((cell, j) => (
              <div key={j} role="gridcell" className="flex items-center justify-center py-0.5">
                <span
                  aria-current={cell.isEvent ? "date" : undefined}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                    cell.isEvent
                      ? "bg-goldenrod font-semibold text-cream"
                      : cell.inMonth
                        ? "text-brown-deep"
                        : "text-brown/30"
                  }`}
                >
                  {cell.day}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
