import { fetchThumbnail } from "./fetchThumbnail.js";
import { CookieJar } from "./anubis.js";
import { fetchPendingSpecies, pushThumbnail } from "./push.js";
import { pendingUrl, pushUrl } from "./urls.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} must be set`);
    process.exit(1);
  }
  return value;
}

// Resolves early if `signal` aborts, so a sleep spanning most of the poll
// interval (the common case at the default 60m) doesn't block shutdown —
// otherwise SIGTERM would sit unhandled until Docker's stop grace period
// expires and force-kills the container.
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

async function runOnce(
  workerUrl: string,
  secret: string,
  jar: CookieJar,
): Promise<void> {
  let speciesCodes: string[];
  try {
    speciesCodes = await fetchPendingSpecies(pendingUrl(workerUrl), secret);
  } catch (err) {
    console.error("failed to fetch pending species list —", err);
    return;
  }

  console.log(`${speciesCodes.length} species pending`);
  for (const speciesCode of speciesCodes) {
    try {
      const thumbnailUrl = await fetchThumbnail(speciesCode, jar);
      if (!thumbnailUrl) {
        console.log(`${speciesCode}: no thumbnail found, skipping`);
        continue;
      }
      await pushThumbnail(pushUrl(workerUrl), secret, { species_code: speciesCode, thumbnail_url: thumbnailUrl });
      console.log(`${speciesCode}: pushed ${thumbnailUrl}`);
    } catch (err) {
      // Failures for one species must not stop the rest of the batch or crash the loop.
      console.error(`${speciesCode}: failed —`, err);
    }
  }
}

async function main() {
  const workerUrl = requireEnv("THUMBNAIL_WORKER_URL");
  const secret = requireEnv("THUMBNAIL_PUSH_SECRET");
  const intervalMinutes = Number(process.env.THUMBNAIL_POLL_INTERVAL_MINUTES ?? "60");
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`bird-sync starting: every ${intervalMinutes}m, worker ${workerUrl}`);

  let running = true;
  // Recreated each time we enter sleep, so SIGUSR1 can cut short just the
  // current wait (triggering an immediate re-poll) without also tearing
  // down the process the way SIGTERM/SIGINT do.
  let sleepAbort = new AbortController();
  const shutdown = () => {
    console.log("shutting down");
    running = false;
    sleepAbort.abort();
  };
  const triggerNow = () => {
    console.log("SIGUSR1 received, polling now");
    sleepAbort.abort();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGUSR1", triggerNow);

  // Cookie jar persists across loop ticks: only the first tick pays the
  // proof-of-work solve cost, later ticks reuse the auth cookie.
  const jar = new CookieJar();

  while (running) {
    await runOnce(workerUrl, secret, jar);
    if (!running) break;
    sleepAbort = new AbortController();
    await sleep(intervalMs, sleepAbort.signal);
  }
}

main();
