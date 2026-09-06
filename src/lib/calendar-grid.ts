/**
 * Pure calendar-grid builder for the Kalendar sheet's static month grid
 * (`src/components/invite/KalendarSheet.tsx`).
 *
 * Built entirely from `Date.UTC` on literal (year, month, day) integers, so
 * the result depends only on the calendar itself — NEVER on the timezone of
 * whichever machine (server, guest's phone, CI) happens to evaluate it. See
 * `src/lib/datetime-my.ts`'s `malayDayName` for the same pattern, and
 * `calendar-grid.test.ts`, which asserts this under `TZ=Pacific/Kiritimati`
 * and `TZ=Pacific/Midway`.
 */

export type CalendarCell = {
  /** Day-of-month number (1-31 for the shown month; may belong to an
   *  adjacent month when `inMonth` is false). */
  day: number;
  /** False for the greyed-out leading/trailing days of adjacent months. */
  inMonth: boolean;
  /** True only for the single cell that is the wedding day itself. */
  isEvent: boolean;
};

export type CalendarEventDate = { year: number; month: number; day: number };

/**
 * Builds the weeks (each exactly 7 cells, Sunday-first) for `gridYear`/
 * `gridMonth` (1-12), highlighting `event` if it falls inside this month.
 * `event` is `null`/omitted, or simply a different month, in which case no
 * cell is ever marked `isEvent` — a guest paging away from the wedding
 * month must never see a stray highlighted day.
 */
export function buildCalendarGrid(
  gridYear: number,
  gridMonth: number,
  event?: CalendarEventDate | null,
): CalendarCell[][] {
  const firstOfMonth = new Date(Date.UTC(gridYear, gridMonth - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(gridYear, gridMonth, 0)).getUTCDate();
  const daysInPrevMonth = new Date(Date.UTC(gridYear, gridMonth - 1, 0)).getUTCDate();

  const isEventDay = (day: number) =>
    Boolean(event && event.year === gridYear && event.month === gridMonth && event.day === day);

  const cells: CalendarCell[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inMonth: false, isEvent: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, inMonth: true, isEvent: isEventDay(day) });
  }

  let trailingDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: trailingDay, inMonth: false, isEvent: false });
    trailingDay++;
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
