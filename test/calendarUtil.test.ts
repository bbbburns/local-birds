import { describe, it, expect } from 'vitest';
import { buildWeekGrid, todayEastern } from '../src/calendarUtil';

describe('todayEastern', () => {
  it('returns a valid ISO date string', () => {
    expect(todayEastern()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('buildWeekGrid', () => {
  // Anchor: 2026-04-07 (Tuesday). Start: 2026-04-01. Same month → simple label.
  const anchor = '2026-04-07';
  const sightedDates = new Set(['2026-04-02', '2026-04-05', '2026-04-07']);
  const grid = buildWeekGrid(anchor, sightedDates);

  it('produces exactly 7 cells', () => {
    expect(grid.cells).toHaveLength(7);
  });

  it('starts 6 days before anchor and ends on anchor', () => {
    expect(grid.cells[0].date).toBe('2026-04-01');
    expect(grid.cells[6].date).toBe('2026-04-07');
  });

  it('sets prevAnchor 7 days before anchor', () => {
    expect(grid.prevAnchor).toBe('2026-03-31');
  });

  it('sets nextAnchor 7 days after anchor', () => {
    expect(grid.nextAnchor).toBe('2026-04-14');
  });

  it('marks hasData correctly from sightedDates', () => {
    const byDate = Object.fromEntries(grid.cells.map((c) => [c.date, c]));
    expect(byDate['2026-04-01'].hasData).toBe(false);
    expect(byDate['2026-04-02'].hasData).toBe(true);
    expect(byDate['2026-04-05'].hasData).toBe(true);
    expect(byDate['2026-04-07'].hasData).toBe(true);
  });

  it('marks isFuture for dates after today', () => {
    // All cells are in the past (anchor is 2026-04-07, today ≥ 2026-04-14)
    grid.cells.forEach((c) => expect(c.isFuture).toBe(false));
  });

  it('produces a same-month label', () => {
    expect(grid.label).toBe('April 2026');
  });

  it('produces a cross-month label when window spans two months', () => {
    // Anchor 2026-04-03 → start 2026-03-28 → spans March and April
    const crossGrid = buildWeekGrid('2026-04-03', new Set());
    expect(crossGrid.label).toBe('Mar – Apr 2026');
  });

  it('disables canGoNext when next anchor would be in the future', () => {
    const today = todayEastern();
    const gridAtToday = buildWeekGrid(today, new Set());
    expect(gridAtToday.canGoNext).toBe(false);
  });

  it('enables canGoNext for an anchor in the past with room to advance', () => {
    // 2026-04-07 + 7 = 2026-04-14, which is today — canGoNext uses <=
    // so it should be true (next anchor equals today, not after it)
    expect(grid.canGoNext).toBe(true);
  });
});
