import type { Sighting, PollStatus, WeekGrid } from '../types';
import { Base } from './Base';
import { WeekStrip } from './WeekStrip';
import { DayDetail } from './DayDetail';

function formatEastern(isoString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString));
}

function nextPollTime(): string {
  const now = Date.now();
  const nextHour = new Date(Math.ceil((now + 1) / 3_600_000) * 3_600_000);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(nextHour);
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
}: {
  weekGrid: WeekGrid;
  sightings: Sighting[] | null;
  initialDate: string | null;
  displayDate: string | null;
  pollStatus: PollStatus | null;
  latest: string | null;
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
      </div>
      <div id="htmx-error" class="error-banner">
        Something went wrong loading data. Please try again or refresh the page.
      </div>
      <div id="day-loading" class="loading-spinner htmx-indicator">Loading…</div>
      <div id="day-detail">
        {sightings != null && displayDate != null ? (
          <DayDetail sightings={sightings} displayDate={displayDate} />
        ) : (
          <p class="no-sightings">Tap a highlighted date to see sightings.</p>
        )}
      </div>
    </Base>
  );
}
