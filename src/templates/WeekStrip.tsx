import type { WeekGrid } from '../types';

function dayAbbr(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(isoDate + 'T00:00:00Z')
  );
}

function dayNum(isoDate: string): number {
  return new Date(isoDate + 'T00:00:00Z').getUTCDate();
}

export function WeekStrip({
  weekGrid,
  selectedDate,
}: {
  weekGrid: WeekGrid;
  selectedDate?: string;
}) {
  const isCurrentWeek = weekGrid.cells.some((c) => c.isToday);

  return (
    <>
      <div class="week-nav">
        <button
          class="nav-btn"
          aria-label="Previous week"
          {...{
            'hx-get': `/week/${weekGrid.prevAnchor}`,
            'hx-target': '#week-strip-container',
            'hx-swap': 'innerHTML',
          }}
        >
          ←
        </button>
        <span class="week-label">{weekGrid.label}</span>
        <div class="nav-right">
          {!isCurrentWeek && (
            <a href="/" class="nav-btn today-btn">Today</a>
          )}
          {weekGrid.canGoNext ? (
            <button
              class="nav-btn"
              aria-label="Next week"
              {...{
                'hx-get': `/week/${weekGrid.nextAnchor}`,
                'hx-target': '#week-strip-container',
                'hx-swap': 'innerHTML',
              }}
            >
              →
            </button>
          ) : (
            <button class="nav-btn" disabled aria-label="Next week">→</button>
          )}
        </div>
      </div>
      <div class="week-cells">
        {weekGrid.cells.map((cell) => {
          const classes = [
            'week-day',
            cell.hasData && 'has-data',
            cell.isToday && 'is-today',
            cell.isFuture && 'is-future',
            cell.date === selectedDate && 'is-selected',
          ]
            .filter(Boolean)
            .join(' ');

          const htmxProps = cell.hasData
            ? {
                'hx-get': `/day/${cell.date}`,
                'hx-target': '#day-detail',
                'hx-swap': 'innerHTML',
                'hx-indicator': '#day-loading',
                'hx-on::before-request':
                  "document.querySelectorAll('.week-day.is-selected').forEach(function(el){el.classList.remove('is-selected')}); this.classList.add('is-selected')",
              }
            : {};

          return (
            <div class={classes} {...htmxProps}>
              <span class="week-day-name">
                <span class="day-full">{dayAbbr(cell.date)}</span>
                <span class="day-short">{dayAbbr(cell.date).slice(0, 1)}</span>
              </span>
              <span class="week-day-num">{dayNum(cell.date)}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
