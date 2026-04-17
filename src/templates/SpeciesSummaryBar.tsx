import type { WeekGrid } from '../types';

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const DAY_NUM_FMT = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' });

function formatWeekRange(startDate: string, endDate: string): string {
  const startD = new Date(startDate + 'T00:00:00Z');
  const endD = new Date(endDate + 'T00:00:00Z');
  const startMonth = MONTH_FMT.format(startD);
  const endMonth = MONTH_FMT.format(endD);
  const startDay = DAY_NUM_FMT.format(startD);
  const endDay = DAY_NUM_FMT.format(endD);

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
