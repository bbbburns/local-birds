import type { Sighting, PollStatus, WeekGrid } from '../types';
import { Base } from './Base';
import { WeekStrip } from './WeekStrip';
import { DayDetail } from './DayDetail';
import { SpeciesSummaryBar } from './SpeciesSummaryBar';

const EASTERN_DT_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const EASTERN_TIME_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatEastern(isoString: string): string {
  return EASTERN_DT_FMT.format(new Date(isoString));
}

function nextPollTime(): string {
  const now = Date.now();
  const nextHour = new Date(Math.ceil((now + 1) / 3_600_000) * 3_600_000);
  return EASTERN_TIME_FMT.format(nextHour);
}

function PollFooter({ pollStatus }: { pollStatus: PollStatus }) {
  const polledAt = formatEastern(pollStatus.polled_at);
  const next = nextPollTime();
  return (
    <div class="poll-status">
      {pollStatus.success ? (
        <span class="poll-ok">
          ✓ Last poll {polledAt} — {pollStatus.count} observations
        </span>
      ) : (
        <span class="poll-fail">✗ Last poll {polledAt} failed</span>
      )}
      {' · '}Next poll ~{next}
    </div>
  );
}

export function IndexPage({
  weekGrid,
  sightings,
  initialDate,
  displayDate,
  pollStatus,
  latest,
  speciesCount,
}: {
  weekGrid: WeekGrid;
  sightings: Sighting[] | null;
  initialDate: string | null;
  displayDate: string | null;
  pollStatus: PollStatus | null;
  latest: string | null;
  speciesCount: number;
}) {
  const footerExtra = pollStatus ? <PollFooter pollStatus={pollStatus} /> : undefined;

  return (
    <Base footerExtra={footerExtra}>
      {!latest && (
        <p class="banner">
          Data collection has just started — check back in a moment for today's sightings.
        </p>
      )}
      <div id="week-strip-container">
        <WeekStrip weekGrid={weekGrid} selectedDate={initialDate ?? undefined} />
        <SpeciesSummaryBar weekGrid={weekGrid} speciesCount={speciesCount} />
      </div>
      <div id="htmx-error" class="error-banner">
        Something went wrong loading data. Please try again or refresh the page.
      </div>
      <div style="position:relative;">
        <div id="day-loading" class="loading-spinner htmx-indicator">Loading…</div>
        <div id="day-detail">
          {sightings != null && displayDate != null ? (
            <DayDetail sightings={sightings} displayDate={displayDate} />
          ) : (
            <p class="no-sightings">Tap a highlighted date to see sightings.</p>
          )}
        </div>
      </div>
    </Base>
  );
}
