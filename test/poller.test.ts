import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { fetchThumbnails } from '../src/poller';
import { getSpeciesMissingThumbnails } from '../src/db';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}

const db = () => env.DB;
const noopLog = () => {};

beforeEach(async () => {
  await db().prepare('DELETE FROM species').run();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchThumbnails', () => {
  it('does not record a row for a species whose fetch fails, leaving it retry-eligible', async () => {
    // Simulate the Anubis bot-block: HTTP 200 with an HTML challenge page
    // instead of JSON, so resp.json() throws inside fetchThumbnail.
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response('<!doctype html>...', { status: 200 })
    ));

    await fetchThumbnails(db(), new Set(['amegfi']), noopLog);

    const missing = await getSpeciesMissingThumbnails(db(), ['amegfi']);
    expect(missing.has('amegfi')).toBe(true);

    const row = await db().prepare('SELECT * FROM species WHERE species_code = ?').bind('amegfi').first();
    expect(row).toBeNull();
  });

  it('records the thumbnail URL for a species whose fetch succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify([{ assetId: '123456' }]), { status: 200 })
    ));

    await fetchThumbnails(db(), new Set(['norcar']), noopLog);

    const missing = await getSpeciesMissingThumbnails(db(), ['norcar']);
    expect(missing.has('norcar')).toBe(false);

    const row = await db().prepare('SELECT thumbnail_url FROM species WHERE species_code = ?').bind('norcar').first<{ thumbnail_url: string }>();
    expect(row?.thumbnail_url).toContain('123456');
  });
});
