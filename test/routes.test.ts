import { describe, it, expect, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { upsertSightings, updatePollStatus } from '../src/db';
import { todayEastern } from '../src/calendarUtil';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}

const TODAY = todayEastern();

const sighting = {
  obs_date: TODAY,
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

describe('GET /health', () => {
  it('returns 200 with ok status', async () => {
    const res = await SELF.fetch('http://localhost/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
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

  it('today is clickable even with no sightings yet', async () => {
    // anchor on today — DB is empty, so today has no sighting_days entry
    const res = await SELF.fetch(`http://localhost/week/${TODAY}`);
    const body = await res.text();
    // today's cell should carry hx-get even without sightings data
    expect(body).toContain(`hx-get="/day/${TODAY}"`);
  });

  it('returns 400 for a malformed anchor date', async () => {
    const res = await SELF.fetch('http://localhost/week/notadate');
    expect(res.status).toBe(400);
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

  it('returns 400 for a malformed obs date', async () => {
    const res = await SELF.fetch('http://localhost/day/notadate');
    expect(res.status).toBe(400);
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

describe('GET /admin/thumbnails/pending', () => {
  it('returns 401 with no auth header', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails/pending');
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails/pending', {
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    expect(res.status).toBe(401);
  });

  it('returns species missing a thumbnail', async () => {
    await upsertSightings(env.DB, [sighting]);
    const res = await SELF.fetch('http://localhost/admin/thumbnails/pending', {
      headers: { Authorization: `Bearer ${env.THUMBNAIL_PUSH_SECRET}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ species_codes: string[] }>();
    expect(body.species_codes).toContain('norcar');
  });
});

const validUpdate = {
  species_code: 'norcar',
  thumbnail_url: 'https://cdn.download.ams.birds.cornell.edu/api/v1/asset/123456/320',
};

describe('POST /admin/thumbnails', () => {
  it('returns 401 with no auth header', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails', {
      method: 'POST',
      body: JSON.stringify({ updates: [validUpdate] }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret (POLL_SECRET no longer works here)', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.POLL_SECRET}` },
      body: JSON.stringify({ updates: [validUpdate] }),
    });
    expect(res.status).toBe(401);
  });

  it('writes a valid update and returns the count', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.THUMBNAIL_PUSH_SECRET}` },
      body: JSON.stringify({ updates: [validUpdate] }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 1 });
    const row = await env.DB.prepare('SELECT thumbnail_url FROM species WHERE species_code = ?')
      .bind('norcar').first<{ thumbnail_url: string }>();
    expect(row?.thumbnail_url).toBe(validUpdate.thumbnail_url);
  });

  it('rejects invalid JSON', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.THUMBNAIL_PUSH_SECRET}` },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a missing updates field', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.THUMBNAIL_PUSH_SECRET}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an empty updates array', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.THUMBNAIL_PUSH_SECRET}` },
      body: JSON.stringify({ updates: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects more than 200 updates', async () => {
    const updates = Array.from({ length: 201 }, () => validUpdate);
    const res = await SELF.fetch('http://localhost/admin/thumbnails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.THUMBNAIL_PUSH_SECRET}` },
      body: JSON.stringify({ updates }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed species_code', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.THUMBNAIL_PUSH_SECRET}` },
      body: JSON.stringify({ updates: [{ ...validUpdate, species_code: 'NOT-VALID!' }] }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a thumbnail_url on the wrong host', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.THUMBNAIL_PUSH_SECRET}` },
      body: JSON.stringify({ updates: [{ ...validUpdate, thumbnail_url: 'https://evil.example.com/x.png' }] }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a non-https thumbnail_url', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.THUMBNAIL_PUSH_SECRET}` },
      body: JSON.stringify({
        updates: [{ ...validUpdate, thumbnail_url: validUpdate.thumbnail_url.replace('https:', 'http:') }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects when one entry in a batch is malformed', async () => {
    const res = await SELF.fetch('http://localhost/admin/thumbnails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.THUMBNAIL_PUSH_SECRET}` },
      body: JSON.stringify({ updates: [validUpdate, { species_code: 'ok', thumbnail_url: 'not-a-url' }] }),
    });
    expect(res.status).toBe(400);
    const row = await env.DB.prepare('SELECT * FROM species WHERE species_code = ?').bind('norcar').first();
    expect(row).toBeNull();
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
