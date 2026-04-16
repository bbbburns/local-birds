import type { WeekGrid } from '../types';

function fmtUtc(isoDate: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(
    new Date(isoDate + 'T00:00:00Z')
  );
}

function formatWeekRange(startDate: string, endDate: string): string {
  const startMonth = fmtUtc(startDate, { month: 'short' });
  const endMonth = fmtUtc(endDate, { month: 'short' });
  const startDay = fmtUtc(startDate, { day: 'numeric' });
  const endDay = fmtUtc(endDate, { day: 'numeric' });

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}\u2013${endDay}`;
  }
  return `${startMonth} ${startDay} \u2013 ${endMonth} ${endDay}`;
}

export function SpeciesSummaryBar({
  weekGrid,
  speciesCount,
}: {
  weekGrid: WeekGrid;
  speciesCount: number;
}) {
  const startDate = weekGrid.cells[0].date;
  const endDate = weekGrid.cells[6].date;
  const range = formatWeekRange(startDate, endDate);
  const label = speciesCount === 1 ? '1 species' : `${speciesCount} species`;

  return (
    <div class="species-summary">
      {range} · {label}
    </div>
  );
}
