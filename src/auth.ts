// Bearer-token check for the /admin/* routes.
//
// Fails closed when the secret is unset or empty, so a missing Worker secret
// can never be matched by "Bearer undefined" or "Bearer ". Compares SHA-256
// digests with crypto.subtle.timingSafeEqual, so neither the secret's
// contents nor its length leak through response timing.
const encoder = new TextEncoder();

async function digest(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', encoder.encode(value));
}

export async function checkBearer(
  header: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret || !header) return false;
  const [given, expected] = await Promise.all([digest(header), digest(`Bearer ${secret}`)]);
  return crypto.subtle.timingSafeEqual(given, expected);
}
