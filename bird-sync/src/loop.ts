import { fetchThumbnail } from "./fetchThumbnail.js";
import { CookieJar } from "./anubis.js";
import { pushThumbnail } from "./push.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} must be set`);
    process.exit(1);
  }
  return value;
}

function speciesCodesFromEnv(): string[] {
  return requireEnv("THUMBNAIL_SPECIES_CODES")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce(speciesCodes: string[], targetUrl: string, secret: string, jar: CookieJar): Promise<void> {
  for (const speciesCode of speciesCodes) {
    try {
      const thumbnailUrl = await fetchThumbnail(speciesCode, jar);
      if (!thumbnailUrl) {
        console.log(`${speciesCode}: no thumbnail found, skipping`);
        continue;
      }
      await pushThumbnail(targetUrl, secret, { species_code: speciesCode, thumbnail_url: thumbnailUrl });
      console.log(`${speciesCode}: pushed ${thumbnailUrl}`);
    } catch (err) {
      // Failures for one species must not stop the rest of the batch or crash the loop.
      console.error(`${speciesCode}: failed —`, err);
    }
  }
}

async function main() {
  const speciesCodes = speciesCodesFromEnv();
  const targetUrl = requireEnv("THUMBNAIL_PUSH_URL");
  const secret = requireEnv("THUMBNAIL_PUSH_SECRET");
  const intervalMinutes = Number(process.env.THUMBNAIL_POLL_INTERVAL_MINUTES ?? "60");
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`bird-sync starting: ${speciesCodes.length} species, every ${intervalMinutes}m, target ${targetUrl}`);

  let running = true;
  const shutdown = () => {
    console.log("shutting down");
    running = false;
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Cookie jar persists across loop ticks: only the first tick pays the
  // proof-of-work solve cost, later ticks reuse the auth cookie.
  const jar = new CookieJar();

  while (running) {
    await runOnce(speciesCodes, targetUrl, secret, jar);
    if (!running) break;
    await sleep(intervalMs);
  }
}

main();
