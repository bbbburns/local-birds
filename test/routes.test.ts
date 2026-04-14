import { describe, it, expect, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { upsertSightings, updatePollStatus } from '../src/db';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}

const sighting = {
  obs_date: '2026-04-14',
  species_code: 'norcar',
  common_name: 'Northern Cardinal',
  sci_name: 'Cardinalis cardinalis',
  location_name: 'Durham Central Park',
  how_many: 2,
  obs_valid: 1,
  obs_reviewed: 1,
  sub_id: 'S999',
  notable: 0,
};

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sightings'),
    env.DB.prepare('DELETE FROM sighting_days'),
    env.DB.prepare('DELETE FROM species'),
    env.DB.prepare('DELETE FROM poll_status'),
  ]);
});

describe('GET /', () => {
  it('returns 200 with HTML', async () => {
    const res = await SELF.fetch('http://localhost/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('<!DOCTYPE html>');
    expect(body).toContain('Durham Central Park');
  });

  it('includes the no-data banner when DB is empty', async () => {
    const res = await SELF.fetch('http://localhost/');
    const body = await res.text();
    expect(body).toContain('Data collection has just started');
  });

  it('shows today sightings when data exists', async () => {
    await upsertSightings(env.DB, [sighting]);
    const res = await SELF.fetch('http://localhost/');
    const body = await res.text();
    expect(body).toContain('Northern Cardinal');
  });
});

describe('GET /week/:anchor', () => {
  it('returns 200 with a week strip fragment (no DOCTYPE)', async () => {
    const res = await SELF.fetch('http://localhost/week/2026-04-07');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain('<!DOCTYPE html>');
    expect(body).toContain('week-nav');
    expect(body).toContain('week-cells');
  });

  it('highlights dates that have sightings', async () => {
    await upsertSightings(env.DB, [{ ...sighting, obs_date: '2026-04-05' }]);
    const res = await SELF.fetch('http://localhost/week/2026-04-07');
    const body = await res.text();
    expect(body).toContain('has-data');
  });
});

describe('GET /day/:obsDate', () => {
  it('returns 200 with a day detail fragment (no DOCTYPE)', async () => {
    await upsertSightings(env.DB, [{ ...sighting, obs_date: '2026-04-10' }]);
    const res = await SELF.fetch('http://localhost/day/2026-04-10');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain('<!DOCTYPE html>');
    expect(body).toContain('Northern Cardinal');
  });

  it('returns no-sightings message for an empty date', async () => {
    const res = await SELF.fetch('http://localhost/day/2026-01-01');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('No birds were spotted');
  });
});

describe('POST /admin/poll', () => {
  it('returns 401 with no auth header', async () => {
    const res = await SELF.fetch('http://localhost/admin/poll', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const res = await SELF.fetch('http://localhost/admin/poll', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /how-it-works', () => {
  it('returns 200 with full page HTML', async () => {
    const res = await SELF.fetch('http://localhost/how-it-works');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<!DOCTYPE html>');
    expect(body).toContain('How It Works');
  });
});

describe('GET /how-to-contribute', () => {
  it('returns 200 with full page HTML', async () => {
    const res = await SELF.fetch('http://localhost/how-to-contribute');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<!DOCTYPE html>');
    expect(body).toContain('How to Contribute');
  });
});

describe('poll status footer', () => {
  it('shows poll status in index when poll_status row exists', async () => {
    await updatePollStatus(env.DB, new Date().toISOString(), true, 7);
    const res = await SELF.fetch('http://localhost/');
    const body = await res.text();
    expect(body).toContain('poll-status');
    expect(body).toContain('7 observations');
  });
});
