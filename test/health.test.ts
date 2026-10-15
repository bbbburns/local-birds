import { describe, it, expect } from 'vitest';
import { buildPipelineHealth, EBIRD_STALE_MINUTES, SYNC_STALE_MINUTES } from '../src/health';
import type { PollStatus, SyncStatus } from '../src/types';

const NOW = Date.parse('2026-10-15T12:00:00.000Z');
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

const poll = (successMin: number, success = 1): PollStatus => ({
  id: 1, polled_at: ago(0), success, count: 12, last_success_at: ago(successMin),
});
const sync = (seenMin: number, pushMin: number | null = null): SyncStatus => ({
  id: 1, last_seen_at: ago(seenMin), last_push_at: pushMin === null ? null : ago(pushMin),
});
const coverage = { total: 40, missing: 3 };

describe('buildPipelineHealth', () => {
  it('reports ages, results and coverage', () => {
    expect(buildPipelineHealth(poll(10), sync(5, 180), coverage, NOW)).toEqual({
      ok: true,
      ebird_ok: true,
      ebird_last_success_min: 10,
      ebird_last_result: 'ok',
      ebird_last_count: 12,
      sync_ok: true,
      sync_last_seen_min: 5,
      sync_last_push_hours: 3,
      species_total: 40,
      species_missing_thumbnails: 3,
    });
  });

  it('stays ok through one failed poll while the last success is fresh', () => {
    const h = buildPipelineHealth(poll(65, 0), sync(5), coverage, NOW);
    expect(h.ok).toBe(true);
    expect(h.ebird_last_result).toBe('error');
  });

  it('flips each loop independently at its staleness threshold', () => {
    const ebirdStale = buildPipelineHealth(poll(EBIRD_STALE_MINUTES), sync(5), coverage, NOW);
    expect([ebirdStale.ok, ebirdStale.ebird_ok, ebirdStale.sync_ok]).toEqual([false, false, true]);
    const syncStale = buildPipelineHealth(poll(5), sync(SYNC_STALE_MINUTES), coverage, NOW);
    expect([syncStale.ok, syncStale.ebird_ok, syncStale.sync_ok]).toEqual([false, true, false]);
  });

  it('treats a missing push as null, not unhealthy', () => {
    const h = buildPipelineHealth(poll(5), sync(5, null), coverage, NOW);
    expect(h.ok).toBe(true);
    expect(h.sync_last_push_hours).toBeNull();
  });

  it('is not ok with no data at all', () => {
    const h = buildPipelineHealth(null, null, { total: 0, missing: 0 }, NOW);
    expect(h.ok).toBe(false);
    expect(h.ebird_last_success_min).toBeNull();
    expect(h.ebird_last_result).toBeNull();
    expect(h.sync_last_seen_min).toBeNull();
  });
});
