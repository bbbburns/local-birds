export function pendingUrl(workerUrl: string): string {
  return `${workerUrl.replace(/\/+$/, "")}/admin/thumbnails/pending`;
}

export function pushUrl(workerUrl: string): string {
  return `${workerUrl.replace(/\/+$/, "")}/admin/thumbnails`;
}
