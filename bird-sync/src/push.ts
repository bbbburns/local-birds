export interface ThumbnailUpdate {
  species_code: string;
  thumbnail_url: string;
}

// Cloudflare Access Service Token headers, sent only when both env vars are
// set. No Access app fronts /admin/* today (see CLAUDE.md), so prod leaves
// them blank; this stays for the case where one is added later.
function accessHeaders(): Record<string, string> {
  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (!id || !secret) return {};
  return { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret };
}

export async function fetchPendingSpecies(pendingUrl: string, secret: string): Promise<string[]> {
  const resp = await fetch(pendingUrl, {
    headers: { Authorization: `Bearer ${secret}`, ...accessHeaders() },
  });
  if (!resp.ok) {
    throw new Error(`Fetch pending from ${pendingUrl} failed: ${resp.status} ${await resp.text()}`);
  }
  const data = (await resp.json()) as { species_codes: string[] };
  return data.species_codes;
}

export async function pushThumbnail(
  targetUrl: string,
  secret: string,
  update: ThumbnailUpdate,
): Promise<void> {
  const resp = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
      ...accessHeaders(),
    },
    body: JSON.stringify({ updates: [update] }),
  });
  if (!resp.ok) {
    throw new Error(`Push to ${targetUrl} failed: ${resp.status} ${await resp.text()}`);
  }
}
