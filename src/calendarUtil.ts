import type { WeekGrid, WeekCell } from './types';

// Returns today's date in America/New_York as YYYY-MM-DD.
export function todayEastern(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

// Adds (or subtracts) days from an ISO date string without timezone drift.
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Format a date string with the given Intl options, always in UTC so the
// calendar date matches the ISO string exactly.
function fmt(isoDate: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(
    new Date(isoDate + 'T00:00:00Z')
  );
}

// Earliest date for which data exists; prevents back-navigation before this.
export const EARLIEST_DATE = '2025-04-04';

// Port of calendar_util.py:build_week_grid.
// anchor is the rightmost (most recent) day in the 7-cell strip; it must be
// <= today. sightedDates is a set of ISO date strings from getSightedDatesInRange.
export function buildWeekGrid(anchor: string, sightedDates: Set<string>): WeekGrid {
  const today = todayEastern();
  const start = addDays(anchor, -6);

  const cells: WeekCell[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    cells.push({
      date,
      hasData: sightedDates.has(date),
      isToday: date === today,
      isFuture: date > today,
    });
  }

  const prevAnchor = addDays(anchor, -7);
  const nextAnchor = addDays(anchor, 7);

  // "April 2026" for same-month windows, "Mar – Apr 2026" for cross-month.
  const label =
    start.slice(0, 7) === anchor.slice(0, 7)
      ? fmt(start, { month: 'long', year: 'numeric' })
      : `${fmt(start, { month: 'short' })} \u2013 ${fmt(anchor, { month: 'short', year: 'numeric' })}`;

  return {
    cells,
    prevAnchor,
    nextAnchor,
    canGoPrev: addDays(prevAnchor, -6) >= EARLIEST_DATE,
    canGoNext: nextAnchor <= today,
    label,
  };
}
