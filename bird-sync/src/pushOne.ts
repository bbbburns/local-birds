import { fetchThumbnail } from "./fetchThumbnail.js";
import { CookieJar } from "./anubis.js";
import { pushThumbnail } from "./push.js";

async function main() {
  const speciesCode = process.argv[2];
  if (!speciesCode) {
    console.error("Usage: THUMBNAIL_PUSH_URL=... THUMBNAIL_PUSH_SECRET=... node dist/pushOne.js <speciesCode>");
    process.exit(1);
  }

  const targetUrl = process.env.THUMBNAIL_PUSH_URL;
  const secret = process.env.THUMBNAIL_PUSH_SECRET;
  if (!targetUrl || !secret) {
    console.error("THUMBNAIL_PUSH_URL and THUMBNAIL_PUSH_SECRET must be set");
    process.exit(1);
  }

  try {
    const jar = new CookieJar();
    const thumbnailUrl = await fetchThumbnail(speciesCode, jar);
    if (!thumbnailUrl) {
      console.log(`${speciesCode}: no thumbnail found, not pushing`);
      return;
    }
    console.log(`${speciesCode}: fetched ${thumbnailUrl}, pushing to ${targetUrl}`);
    await pushThumbnail(targetUrl, secret, { species_code: speciesCode, thumbnail_url: thumbnailUrl });
    console.log(`${speciesCode}: pushed`);
  } catch (err) {
    console.error(`${speciesCode}: failed —`, err);
    process.exit(1);
  }
}

main();
