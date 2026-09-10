export interface ThumbnailUpdate {
  species_code: string;
  thumbnail_url: string;
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
    },
    body: JSON.stringify({ updates: [update] }),
  });
  if (!resp.ok) {
    throw new Error(`Push to ${targetUrl} failed: ${resp.status} ${await resp.text()}`);
  }
}
