import type { Sighting, PollStatus } from './types';

export async function getSightingsForDate(db: D1Database, obsDate: string): Promise<Sighting[]> {
  const { results } = await db.prepare(
    `SELECT s.*, sp.thumbnail_url
     FROM sightings s
     LEFT JOIN species sp ON s.species_code = sp.species_code
     WHERE s.obs_date = ?
     ORDER BY s.notable DESC, s.common_name`
  ).bind(obsDate).all<Sighting>();
  return results;
}

export async function getSightedDatesInRange(
  db: D1Database,
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  const { results } = await db.prepare(
    `SELECT obs_date FROM sighting_days WHERE obs_date >= ? AND obs_date <= ?`
  ).bind(startDate, endDate).all<{ obs_date: string }>();
  return new Set(results.map((r) => r.obs_date));
}

export async function getLatestPolledDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    `SELECT obs_date FROM sighting_days ORDER BY obs_date DESC LIMIT 1`
  ).first<{ obs_date: string }>();
  return row?.obs_date ?? null;
}

export async function getPollStatus(db: D1Database): Promise<PollStatus | null> {
  return db.prepare(`SELECT * FROM poll_status WHERE id = 1`).first<PollStatus>();
}

export async function countUniqueSpeciesInRange(
  db: D1Database,
  startDate: string,
  endDate: string
): Promise<number> {
  const row = await db.prepare(
    `SELECT COUNT(DISTINCT species_code) AS count
     FROM sightings WHERE obs_date >= ? AND obs_date <= ?`
  ).bind(startDate, endDate).first<{ count: number }>();
  return row?.count ?? 0;
}

export async function upsertSightings(
  db: D1Database,
  records: Omit<Sighting, 'id' | 'thumbnail_url'>[],
  opts: { preserveExisting?: boolean } = {}
): Promise<void> {
  if (records.length === 0) return;
  const now = new Date().toISOString();
  // INSERT OR IGNORE when notable data is unavailable — keeps existing notable
  // values intact. INSERT OR REPLACE otherwise (normal path).
  const sightingOp = opts.preserveExisting ? 'INSERT OR IGNORE' : 'INSERT OR REPLACE';
  // One sighting_days row per unique observation date (not per poll date) so
  // the week strip highlights the days birds were actually seen, not just the
  // day the poller happened to run.
  const uniqueDates = [...new Set(records.map((r) => r.obs_date))];
  const statements = [
    ...uniqueDates.map((date) =>
      db.prepare(
        `INSERT OR REPLACE INTO sighting_days (obs_date, polled_at) VALUES (?, ?)`
      ).bind(date, now)
    ),
    ...records.map((r) =>
      db.prepare(
        `${sightingOp} INTO sightings
         (obs_date, species_code, common_name, sci_name, location_name, how_many,
          obs_valid, obs_reviewed, sub_id, notable)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        r.obs_date, r.species_code, r.common_name, r.sci_name, r.location_name,
        r.how_many, r.obs_valid, r.obs_reviewed, r.sub_id, r.notable
      )
    ),
  ];
  // D1 hard limit is 100 statements per batch — chunk to stay safe.
  const BATCH_LIMIT = 100;
  for (let i = 0; i < statements.length; i += BATCH_LIMIT) {
    await db.batch(statements.slice(i, i + BATCH_LIMIT));
  }
}

export async function updatePollStatus(
  db: D1Database,
  polledAt: string,
  success: boolean,
  count: number
): Promise<void> {
  await db.prepare(
    `INSERT OR REPLACE INTO poll_status (id, polled_at, success, count) VALUES (1, ?, ?, ?)`
  ).bind(polledAt, success ? 1 : 0, count).run();
}

export async function getSpeciesMissingThumbnails(
  db: D1Database,
  speciesCodes: string[]
): Promise<Set<string>> {
  if (speciesCodes.length === 0) return new Set();
  const placeholders = speciesCodes.map(() => '?').join(', ');
  const { results } = await db.prepare(
    `SELECT species_code FROM species WHERE species_code IN (${placeholders})`
  ).bind(...speciesCodes).all<{ species_code: string }>();
  const alreadyFetched = new Set(results.map((r) => r.species_code));
  return new Set(speciesCodes.filter((c) => !alreadyFetched.has(c)));
}

export async function getStaleThumbnails(db: D1Database, maxAgeDays = 30, limit = 20): Promise<string[]> {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const { results } = await db.prepare(
    `SELECT species_code FROM species WHERE fetched_at < ? LIMIT ?`
  ).bind(cutoff, limit).all<{ species_code: string }>();
  return results.map((r) => r.species_code);
}

export async function upsertSpeciesThumbnail(
  db: D1Database,
  speciesCode: string,
  thumbnailUrl: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT OR REPLACE INTO species (species_code, thumbnail_url, fetched_at) VALUES (?, ?, ?)`
  ).bind(speciesCode, thumbnailUrl, now).run();
}
