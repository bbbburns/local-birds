import { anubisFetch, CookieJar } from "./anubis.js";

const MACAULAY_SEARCH_URL = "https://search.macaulaylibrary.org/api/v2/search";
const MACAULAY_ASSET_BASE = "https://cdn.download.ams.birds.cornell.edu/api/v1/asset";

export async function fetchThumbnail(speciesCode: string, jar: CookieJar): Promise<string | null> {
  const url = new URL(MACAULAY_SEARCH_URL);
  url.searchParams.set("taxonCode", speciesCode);
  url.searchParams.set("count", "1");
  url.searchParams.set("mediaType", "photo");
  url.searchParams.set("sort", "rating_rank_desc");

  const resp = await anubisFetch(url.toString(), jar);
  if (!resp.ok) {
    throw new Error(`Macaulay search returned ${resp.status} for ${speciesCode}`);
  }
  const contentType = resp.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Macaulay search returned unexpected content-type "${contentType}" for ${speciesCode} (Anubis challenge unsolved?)`,
    );
  }
  const data = (await resp.json()) as { assetId?: string }[];
  const assetId = data[0]?.assetId;
  return assetId ? `${MACAULAY_ASSET_BASE}/${assetId}/320` : null;
}

async function main() {
  const speciesCode = process.argv[2];
  if (!speciesCode) {
    console.error("Usage: node dist/fetchThumbnail.js <speciesCode>");
    process.exit(1);
  }

  try {
    const jar = new CookieJar();
    const thumbnailUrl = await fetchThumbnail(speciesCode, jar);
    console.log(thumbnailUrl ?? "null");
  } catch (err) {
    console.error(`Failed to fetch thumbnail for ${speciesCode}:`, err);
    process.exit(1);
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
