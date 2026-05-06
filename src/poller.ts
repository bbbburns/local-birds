import type { Env } from './types';
import {
  upsertSightings,
  updatePollStatus,
  getSpeciesMissingThumbnails,
  getStaleThumbnails,
  upsertSpeciesThumbnail,
  getKnownChecklistIds,
  upsertChecklistComment,
} from './db';

const LAT = 36.000538;
const LNG = -78.900216;
const DIST_KM = 2;
const EBIRD_URL = 'https://api.ebird.org/v2/data/obs/geo/recent';
const EBIRD_NOTABLE_URL = 'https://api.ebird.org/v2/data/obs/geo/recent/notable';
const MACAULAY_SEARCH_URL = 'https://search.macaulaylibrary.org/api/v1/search';
const MACAULAY_ASSET_BASE = 'https://cdn.download.ams.birds.cornell.edu/api/v1/asset';
const EBIRD_CHECKLIST_URL = 'https://api.ebird.org/v2/product/checklist/view';

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
  speciesCodes: Set<string>,
  log: (...a: unknown[]) => void
): Promise<void> {
  try {
    const missing = Array.from(await getSpeciesMissingThumbnails(db, Array.from(speciesCodes)));
    if (missing.length > 0) {
      log(`Fetching thumbnails for ${missing.length} new species`);
      const urls = await Promise.all(missing.map(fetchThumbnail));
      await Promise.all(missing.map((code, i) => upsertSpeciesThumbnail(db, code, urls[i])));
    }
  } catch (err) {
    console.error('Thumbnail fetch failed — sightings unaffected', err);
  }

  try {
    const stale = await getStaleThumbnails(db);
    if (stale.length > 0) {
      log(`Refreshing ${stale.length} stale thumbnails`);
      const urls = await Promise.all(stale.map(fetchThumbnail));
      await Promise.all(
        stale.map((code, i) =>
          urls[i] !== null ? upsertSpeciesThumbnail(db, code, urls[i]) : Promise.resolve()
        )
      );
    }
  } catch (err) {
    console.error('Stale thumbnail refresh failed', err);
  }
}

async function fetchChecklistComments(
  db: D1Database,
  records: { sub_id: string | null; obs_date: string }[],
  apiKey: string,
  log: (...a: unknown[]) => void
): Promise<void> {
  const subIdToDate = new Map<string, string>();
  for (const r of records) {
    if (r.sub_id && !subIdToDate.has(r.sub_id)) subIdToDate.set(r.sub_id, r.obs_date);
  }
  if (subIdToDate.size === 0) return;

  try {
    const allSubIds = Array.from(subIdToDate.keys());
    const knownIds = await getKnownChecklistIds(db, allSubIds);
    const newSubIds = allSubIds.filter((id) => !knownIds.has(id));
    if (newSubIds.length === 0) return;

    const now = new Date().toISOString();
    let saved = 0;

    await Promise.all(newSubIds.map(async (subId) => {
      try {
        const resp = await fetch(`${EBIRD_CHECKLIST_URL}/${subId}`, {
          headers: { 'x-ebirdapitoken': apiKey },
        });
        if (resp.status === 429) {
          console.error(`eBird checklist API rate limited for ${subId}`);
          return;
        }
        if (!resp.ok) {
          console.error(`eBird checklist ${subId}: HTTP ${resp.status}`);
          return;
        }
        const data = await resp.json() as { comments?: string; userDisplayName?: string };
        const text = data.comments?.trim();
        log(`Checklist ${subId}: comment=${JSON.stringify(text ?? null)}, observer=${data.userDisplayName ?? null}`);
        if (!text) return;
        await upsertChecklistComment(db, {
          sub_id: subId,
          obs_date: subIdToDate.get(subId)!,
          observer_name: data.userDisplayName ?? null,
          comment_text: text,
          fetched_at: now,
        });
        saved++;
      } catch {
        console.error(`Failed to fetch checklist comment for ${subId}`);
      }
    }));
    console.log(`Checklist comments: ${saved} saved of ${newSubIds.length} fetched`);
  } catch (err) {
    console.error('Checklist comment fetch failed — sightings unaffected', err);
  }
}

export async function runPoll(env: Env, opts: { verbose?: boolean } = {}): Promise<void> {
  const log = opts.verbose ? console.log.bind(console) : () => {};
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

    log(`eBird response: HTTP ${obsResp.status}`);

    if (obsResp.status === 429) {
      console.error('eBird API rate limited (429) — will retry next interval');
      await updatePollStatus(env.DB, now, false, 0);
      return;
    }

    if (!obsResp.ok) throw new Error(`eBird HTTP ${obsResp.status}`);
    const obsJson = await obsResp.json();
    if (!Array.isArray(obsJson)) throw new Error('eBird response was not an array');
    observations = obsJson;
    log(`eBird returned ${observations.length} observations`);

    if (notableResp.ok) {
      notableKeys = new Set<string>();
      const notableObs = await notableResp.json() as { obsDt: string; speciesCode: string }[];
      for (const obs of notableObs) {
        notableKeys.add(`${obs.obsDt.slice(0, 10)}:${obs.speciesCode}`);
      }
      if (notableKeys.size > 0) log(`eBird notable: ${notableKeys.size} rare species`);
    } else {
      // Don't fall back to empty set — that would mark all new records as non-notable.
      // Leave notableKeys null so the upsert preserves existing notable values in DB.
      console.error('Notable endpoint failed — skipping notable update this cycle');
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
  await fetchThumbnails(env.DB, seenCodes, log);

  // --- Checklist comments (failures cannot affect poll_status written above) ---
  await fetchChecklistComments(env.DB, records, env.EBIRD_API_KEY, log);
}
