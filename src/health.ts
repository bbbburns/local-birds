import type { PollStatus, SyncStatus } from './types';

// Both loops run hourly (cron "0 * * * *"; bird-sync's default
// THUMBNAIL_POLL_INTERVAL_MINUTES=60). Allow one missed cycle plus slack, so a
// single failed poll or a long bird-sync cycle doesn't flip ok to false.
export const EBIRD_STALE_MINUTES = 150;
export const SYNC_STALE_MINUTES = 150;

export interface PipelineHealth {
  ok: boolean;
  ebird_ok: boolean;
  ebird_last_success_min: number | null;
  ebird_last_result: 'ok' | 'error' | null;
  ebird_last_count: number | null;
  sync_ok: boolean;
  sync_last_seen_min: number | null;
  sync_last_push_hours: number | null;
  species_total: number;
  species_missing_thumbnails: number;
}

function minutesSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((now - t) / 6000) / 10; // one decimal place
}

export function buildPipelineHealth(
  poll: PollStatus | null,
  sync: SyncStatus | null,
  coverage: { total: number; missing: number },
  now: number = Date.now()
): PipelineHealth {
  const ebirdAge = minutesSince(poll?.last_success_at, now);
  const syncAge = minutesSince(sync?.last_seen_at, now);
  const pushAge = minutesSince(sync?.last_push_at, now);
  const ebirdOk = ebirdAge !== null && ebirdAge < EBIRD_STALE_MINUTES;
  const syncOk = syncAge !== null && syncAge < SYNC_STALE_MINUTES;
  return {
    ok: ebirdOk && syncOk,
    ebird_ok: ebirdOk,
    ebird_last_success_min: ebirdAge,
    ebird_last_result: poll ? (poll.success ? 'ok' : 'error') : null,
    ebird_last_count: poll?.count ?? null,
    sync_ok: syncOk,
    sync_last_seen_min: syncAge,
    sync_last_push_hours: pushAge === null ? null : Math.round(pushAge / 6) / 10,
    species_total: coverage.total,
    species_missing_thumbnails: coverage.missing,
  };
}
