import { env } from 'cloudflare:test';
import { beforeAll } from 'vitest';

// Apply schema to the fresh in-memory D1 instance that the Workers pool
// provides for each test file. CREATE TABLE IF NOT EXISTS is idempotent.
beforeAll(async () => {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sighting_days (
        obs_date TEXT PRIMARY KEY,
        polled_at TEXT NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sightings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        obs_date TEXT NOT NULL,
        species_code TEXT NOT NULL,
        common_name TEXT NOT NULL,
        sci_name TEXT NOT NULL,
        location_name TEXT,
        how_many INTEGER,
        obs_valid INTEGER NOT NULL,
        obs_reviewed INTEGER NOT NULL,
        sub_id TEXT,
        notable INTEGER NOT NULL DEFAULT 0,
        UNIQUE(obs_date, species_code)
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS species (
        species_code TEXT PRIMARY KEY,
        thumbnail_url TEXT,
        fetched_at TEXT NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS poll_status (
        id INTEGER PRIMARY KEY,
        polled_at TEXT NOT NULL,
        success INTEGER NOT NULL,
        count INTEGER NOT NULL
      )
    `),
  ]);
});
