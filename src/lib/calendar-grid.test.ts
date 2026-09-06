import { describe, expect, it } from "vitest";

import { buildCalendarGrid } from "./calendar-grid";

describe("buildCalendarGrid", () => {
  it("builds a month starting on a Sunday with no leading blanks (Nov 2026)", () => {
    const weeks = buildCalendarGrid(2026, 11, { year: 2026, month: 11, day: 1 });
    expect(weeks[0][0]).toEqual({ day: 1, inMonth: true, isEvent: true });
    // Every cell in the first week is in-month since the month starts on Sunday.
    expect(weeks[0].every((c) => c.inMonth)).toBe(true);
    expect(weeks.flat().filter((c) => c.inMonth).length).toBe(30);
  });

  it("builds a month starting on a Saturday with 6 leading blanks (Aug 2026)", () => {
    const weeks = buildCalendarGrid(2026, 8, { year: 2026, month: 8, day: 1 });
    const firstWeek = weeks[0];
    expect(firstWeek.slice(0, 6).every((c) => !c.inMonth)).toBe(true);
    expect(firstWeek[6]).toEqual({ day: 1, inMonth: true, isEvent: true });
    expect(weeks.flat().filter((c) => c.inMonth).length).toBe(31);
  });

  it("handles a leap February correctly (2028)", () => {
    const weeks = buildCalendarGrid(2028, 2, null);
    const inMonthDays = weeks.flat().filter((c) => c.inMonth);
    expect(inMonthDays.length).toBe(29);
    expect(inMonthDays[inMonthDays.length - 1].day).toBe(29);
  });

  it("highlights only the correct day, and never a stray day when the event is in a different month", () => {
    const weeks = buildCalendarGrid(2026, 11, { year: 2026, month: 11, day: 15 });
    const highlighted = weeks.flat().filter((c) => c.isEvent);
    expect(highlighted).toEqual([{ day: 15, inMonth: true, isEvent: true }]);

    const otherMonth = buildCalendarGrid(2026, 12, { year: 2026, month: 11, day: 15 });
    expect(otherMonth.flat().some((c) => c.isEvent)).toBe(false);
  });

  it("every week has exactly 7 cells, and adjacent-month days are greyed out (not isEvent)", () => {
    const weeks = buildCalendarGrid(2026, 8, { year: 2026, month: 8, day: 1 });
    for (const week of weeks) {
      expect(week.length).toBe(7);
    }
    const outOfMonth = weeks.flat().filter((c) => !c.inMonth);
    expect(outOfMonth.every((c) => !c.isEvent)).toBe(true);
  });

  it("is independent of the host timezone", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati"; // UTC+14
      const a = buildCalendarGrid(2026, 11, { year: 2026, month: 11, day: 1 });
      process.env.TZ = "Pacific/Midway"; // UTC-11
      const b = buildCalendarGrid(2026, 11, { year: 2026, month: 11, day: 1 });
      expect(a).toEqual(b);

      process.env.TZ = "Pacific/Kiritimati";
      const c1 = buildCalendarGrid(2026, 8, { year: 2026, month: 8, day: 1 });
      process.env.TZ = "Pacific/Midway";
      const c2 = buildCalendarGrid(2026, 8, { year: 2026, month: 8, day: 1 });
      expect(c1).toEqual(c2);
    } finally {
      process.env.TZ = original;
    }
  });
});
