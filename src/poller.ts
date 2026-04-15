import type { Env } from './types';
import {
  upsertSightings,
  updatePollStatus,
  getSpeciesMissingThumbnails,
  getStaleThumbnails,
  upsertSpeciesThumbnail,
} from './db';

const LAT = 36.000538;
const LNG = -78.900216;
const DIST_KM = 2;
const EBIRD_URL = 'https://api.ebird.org/v2/data/obs/geo/recent';
const EBIRD_NOTABLE_URL = 'https://api.ebird.org/v2/data/obs/geo/recent/notable';
const MACAULAY_SEARCH_URL = 'https://search.macaulaylibrary.org/api/v1/search';
const MACAULAY_ASSET_BASE = 'https://cdn.download.ams.birds.cornell.edu/api/v1/asset';

async function fetchThumbnail(speciesCode: string): Promise<string | null> {
  try {
    const url = new URL(MACAULAY_SEARCH_URL);
    url.searchParams.set('taxonCode', speciesCode);
    url.searchParams.set('count', '1');
    url.searchParams.set('mediaType', 'Photo');
    url.searchParams.set('sort', 'rating_rank_desc');
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json() as { results?: { content?: { assetId?: string }[] } };
    const assetId = data.results?.content?.[0]?.assetId;
    if (assetId) return `${MACAULAY_ASSET_BASE}/${assetId}/320`;
  } catch {
    console.warn(`Could not fetch thumbnail for ${speciesCode}`);
  }
  return null;
}

async function fetchThumbnails(
  db: D1Database,
  speciesCodes: Set<string>
): Promise<void> {
  // New species: fetch thumbnails for codes not yet in the species table.
  try {
    const missing = Array.from(await getSpeciesMissingThumbnails(db, Array.from(speciesCodes)));
    if (missing.length > 0) {
      console.log(`Fetching thumbnails for ${missing.length} new species`);
      const urls = await Promise.all(missing.map(fetchThumbnail));
      await Promise.all(missing.map((code, i) => upsertSpeciesThumbnail(db, code, urls[i])));
    }
  } catch (err) {
    // Thumbnail failures must not overwrite a successful poll_status.
    console.warn('Thumbnail fetch failed — sightings unaffected', err);
  }

  // Stale species: refresh thumbnails older than 30 days (capped at 20 per poll).
  try {
    const stale = await getStaleThumbnails(db);
    if (stale.length > 0) {
      console.log(`Refreshing ${stale.length} stale thumbnails`);
      const urls = await Promise.all(stale.map(fetchThumbnail));
      // Preserve original indices when filtering so codes stay aligned with urls.
      await Promise.all(
        stale.map((code, i) =>
          urls[i] !== null ? upsertSpeciesThumbnail(db, code, urls[i]) : Promise.resolve()
        )
      );
    }
  } catch (err) {
    console.warn('Stale thumbnail refresh failed', err);
  }
}

export async function runPoll(env: Env): Promise<void> {
  console.log('Polling eBird API...');
  const now = new Date().toISOString();
  const ebirdHeaders = { 'x-ebirdapitoken': env.EBIRD_API_KEY };
  const commonParams = new URLSearchParams({
    lat: String(LAT),
    lng: String(LNG),
    dist: String(DIST_KM),
    back: '3',
  });

  // --- Main observations + notable (parallel) ---
  let observations: unknown[];
  let notableKeys: Set<string> | null;

  try {
    const obsUrl = new URL(EBIRD_URL);
    obsUrl.searchParams.set('includeProvisional', 'true');
    obsUrl.searchParams.set('detail', 'full');
    obsUrl.searchParams.set('fmt', 'json');
    commonParams.forEach((v, k) => obsUrl.searchParams.set(k, v));

    const notableUrl = new URL(EBIRD_NOTABLE_URL);
    commonParams.forEach((v, k) => notableUrl.searchParams.set(k, v));

    const [obsResp, notableResp] = await Promise.all([
      fetch(obsUrl, { headers: ebirdHeaders }),
      fetch(notableUrl, { headers: ebirdHeaders }),
    ]);

    console.log(`eBird response: HTTP ${obsResp.status}`);

    if (obsResp.status === 429) {
      console.warn('eBird API rate limited (429) — will retry next interval');
      await updatePollStatus(env.DB, now, false, 0);
      return;
    }

    if (!obsResp.ok) throw new Error(`eBird HTTP ${obsResp.status}`);
    const obsJson = await obsResp.json();
    if (!Array.isArray(obsJson)) throw new Error('eBird response was not an array');
    observations = obsJson;
    console.log(`eBird returned ${observations.length} observations`);

    if (notableResp.ok) {
      notableKeys = new Set<string>();
      const notableObs = await notableResp.json() as { obsDt: string; speciesCode: string }[];
      for (const obs of notableObs) {
        notableKeys.add(`${obs.obsDt.slice(0, 10)}:${obs.speciesCode}`);
      }
      if (notableKeys.size > 0) console.log(`eBird notable: ${notableKeys.size} rare species`);
    } else {
      // Don't fall back to empty set — that would mark all new records as non-notable.
      // Leave notableKeys null so the upsert preserves existing notable values in DB.
      console.warn('Notable endpoint failed — skipping notable update this cycle');
      notableKeys = null;
    }
  } catch (err) {
    console.error('Failed to fetch eBird data', err);
    await updatePollStatus(env.DB, now, false, 0);
    return;
  }

  // --- Build records and upsert ---
  type EBirdObs = {
    obsDt: string; speciesCode: string; comName: string; sciName: string;
    locName?: string; howMany?: number; obsValid?: boolean; obsReviewed?: boolean; subId?: string;
  };

  const records = (observations as EBirdObs[]).map((obs) => ({
    obs_date: obs.obsDt.slice(0, 10),
    species_code: obs.speciesCode,
    common_name: obs.comName,
    sci_name: obs.sciName,
    location_name: obs.locName ?? null,
    how_many: obs.howMany ?? null,
    obs_valid: obs.obsValid !== false ? 1 : 0,
    obs_reviewed: obs.obsReviewed ? 1 : 0,
    sub_id: obs.subId ?? null,
    notable: notableKeys?.has(`${obs.obsDt.slice(0, 10)}:${obs.speciesCode}`) ? 1 : 0,
  }));

  // When notable endpoint failed, use INSERT OR IGNORE so existing notable values
  // in the DB are preserved rather than overwritten with 0.
  await upsertSightings(env.DB, records, { preserveExisting: notableKeys === null });
  const dates = [...new Set(records.map((r) => r.obs_date))].join(', ');
  console.log(`Stored ${records.length} sightings across ${dates}`);
  await updatePollStatus(env.DB, now, true, records.length);

  // --- Thumbnails (failures cannot affect poll_status written above) ---
  const seenCodes = new Set(records.map((r) => r.species_code));
  await fetchThumbnails(env.DB, seenCodes);
}
