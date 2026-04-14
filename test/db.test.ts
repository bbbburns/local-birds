import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import {
  getSightingsForDate,
  getSightedDatesInRange,
  getLatestPolledDate,
  getPollStatus,
  upsertSightings,
  updatePollStatus,
  upsertSpeciesThumbnail,
  getSpeciesMissingThumbnails,
  getStaleThumbnails,
} from '../src/db';
import type { Env } from '../src/types';

// Give the test env the DB binding type.
declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}

const db = () => env.DB;

const sighting = {
  obs_date: '2026-04-10',
  species_code: 'norcar',
  common_name: 'Northern Cardinal',
  sci_name: 'Cardinalis cardinalis',
  location_name: 'Durham Central Park',
  how_many: 3,
  obs_valid: 1,
  obs_reviewed: 0,
  sub_id: 'S123',
  notable: 0,
};

beforeEach(async () => {
  await db().batch([
    db().prepare('DELETE FROM sightings'),
    db().prepare('DELETE FROM sighting_days'),
    db().prepare('DELETE FROM species'),
    db().prepare('DELETE FROM poll_status'),
  ]);
});

describe('upsertSightings / getSightingsForDate', () => {
  it('stores and retrieves a sighting', async () => {
    await upsertSightings(db(), [sighting]);
    const results = await getSightingsForDate(db(), '2026-04-10');
    expect(results).toHaveLength(1);
    expect(results[0].common_name).toBe('Northern Cardinal');
    expect(results[0].species_code).toBe('norcar');
  });

  it('returns empty array for a date with no sightings', async () => {
    const results = await getSightingsForDate(db(), '2026-01-01');
    expect(results).toHaveLength(0);
  });

  it('deduplicates by (obs_date, species_code)', async () => {
    await upsertSightings(db(), [sighting]);
    await upsertSightings(db(), [{ ...sighting, how_many: 5 }]);
    const results = await getSightingsForDate(db(), '2026-04-10');
    expect(results).toHaveLength(1);
    expect(results[0].how_many).toBe(5);
  });

  it('orders results: notable first, then by common_name', async () => {
    const rare = { ...sighting, species_code: 'zzz', common_name: 'Zebra Finch', notable: 1 };
    await upsertSightings(db(), [sighting, rare]);
    const results = await getSightingsForDate(db(), '2026-04-10');
    expect(results[0].notable).toBe(1);
    expect(results[1].notable).toBe(0);
  });
});

describe('getSightedDatesInRange', () => {
  it('returns only dates within the range', async () => {
    await upsertSightings(db(), [{ ...sighting, obs_date: '2026-04-08' }]);
    await upsertSightings(db(), [sighting]);
    await upsertSightings(db(), [{ ...sighting, obs_date: '2026-04-12' }]);

    const dates = await getSightedDatesInRange(db(), '2026-04-09', '2026-04-11');
    expect(dates.has('2026-04-10')).toBe(true);
    expect(dates.has('2026-04-08')).toBe(false);
    expect(dates.has('2026-04-12')).toBe(false);
  });

  it('returns empty set when no data in range', async () => {
    const dates = await getSightedDatesInRange(db(), '2026-04-01', '2026-04-07');
    expect(dates.size).toBe(0);
  });
});

describe('getLatestPolledDate', () => {
  it('returns null when no data exists', async () => {
    expect(await getLatestPolledDate(db())).toBeNull();
  });

  it('returns the most recent obs_date', async () => {
    await upsertSightings(db(), [{ ...sighting, obs_date: '2026-04-08' }]);
    await upsertSightings(db(), [sighting]);
    expect(await getLatestPolledDate(db())).toBe('2026-04-10');
  });
});

describe('updatePollStatus / getPollStatus', () => {
  it('returns null when no status exists', async () => {
    expect(await getPollStatus(db())).toBeNull();
  });

  it('stores and retrieves poll status', async () => {
    await updatePollStatus(db(), '2026-04-10T12:00:00.000Z', true, 42);
    const status = await getPollStatus(db());
    expect(status?.success).toBe(1);
    expect(status?.count).toBe(42);
  });

  it('overwrites previous status (only one row)', async () => {
    await updatePollStatus(db(), '2026-04-10T12:00:00.000Z', true, 10);
    await updatePollStatus(db(), '2026-04-10T13:00:00.000Z', false, 0);
    const status = await getPollStatus(db());
    expect(status?.success).toBe(0);
    expect(status?.count).toBe(0);
  });
});

describe('species thumbnails', () => {
  it('identifies missing thumbnails', async () => {
    const missing = await getSpeciesMissingThumbnails(db(), ['norcar', 'amerob']);
    expect(missing.has('norcar')).toBe(true);
    expect(missing.has('amerob')).toBe(true);
  });

  it('excludes species already in the table', async () => {
    await upsertSpeciesThumbnail(db(), 'norcar', 'https://example.com/norcar.jpg');
    const missing = await getSpeciesMissingThumbnails(db(), ['norcar', 'amerob']);
    expect(missing.has('norcar')).toBe(false);
    expect(missing.has('amerob')).toBe(true);
  });

  it('returns empty set for empty input', async () => {
    const missing = await getSpeciesMissingThumbnails(db(), []);
    expect(missing.size).toBe(0);
  });

  it('getStaleThumbnails returns codes fetched before the cutoff', async () => {
    // Insert a species with a very old fetched_at
    await db()
      .prepare(`INSERT INTO species (species_code, thumbnail_url, fetched_at) VALUES (?, ?, ?)`)
      .bind('norcar', 'https://example.com/norcar.jpg', '2025-01-01T00:00:00.000Z')
      .run();
    const stale = await getStaleThumbnails(db());
    expect(stale).toContain('norcar');
  });
});
