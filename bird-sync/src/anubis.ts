import { createHash } from "node:crypto";

/**
 * Solves Anubis (github.com/TecharoHQ/anubis) proof-of-work bot challenges.
 * Algorithm and endpoint shape read directly from the site's own MIT-licensed
 * client JS (`main.mjs` / `worker/sha256-purejs.mjs`) — a documented,
 * client-solvable Hashcash-style puzzle any JS runtime is meant to pass.
 */

interface AnubisChallenge {
  rules: { algorithm: string; difficulty: number };
  challenge: { id: string; randomData: string };
}

function extractJsonScript(html: string, id: string): unknown {
  const re = new RegExp(`<script id="${id}"[^>]*>([^<]*)</script>`);
  const match = html.match(re);
  if (!match) return null;
  return JSON.parse(match[1]);
}

function isAnubisChallengePage(html: string): boolean {
  return html.includes('id="anubis_challenge"');
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function solveProofOfWork(randomData: string, difficulty: number): { nonce: number; hash: string } {
  const prefix = "0".repeat(difficulty);
  for (let nonce = 0; ; nonce++) {
    const hash = sha256Hex(randomData + nonce);
    if (hash.startsWith(prefix)) {
      return { nonce, hash };
    }
  }
}

class CookieJar {
  private cookies = new Map<string, string>();

  absorb(headers: Headers): void {
    for (const cookie of headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookies.set(name, value);
    }
  }

  header(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

/**
 * Fetches a URL that may be gated behind an Anubis bot-check, solving the
 * PoW challenge and re-requesting with the resulting auth cookie if so.
 * The cookie jar is per-call; pass one in to reuse a solved session across
 * multiple requests to the same origin.
 */
export async function anubisFetch(url: string, jar: CookieJar = new CookieJar()): Promise<Response> {
  let resp = await fetch(url, { headers: cookieHeaders(jar) });
  jar.absorb(resp.headers);

  const contentType = resp.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return resp;
  }

  const html = await resp.text();
  if (!isAnubisChallengePage(html)) {
    return new Response(html, { status: resp.status, headers: resp.headers });
  }

  const { challenge, rules } = extractJsonScript(html, "anubis_challenge") as AnubisChallenge;
  const basePrefix = (extractJsonScript(html, "anubis_base_prefix") as string) ?? "";

  const startedAt = Date.now();
  const { nonce, hash } = solveProofOfWork(challenge.randomData, rules.difficulty);
  const elapsedTime = Date.now() - startedAt;

  const passUrl = new URL(`${basePrefix}/.within.website/x/cmd/anubis/api/pass-challenge`, url);
  passUrl.searchParams.set("id", challenge.id);
  passUrl.searchParams.set("response", hash);
  passUrl.searchParams.set("nonce", String(nonce));
  passUrl.searchParams.set("redir", url);
  passUrl.searchParams.set("elapsedTime", String(elapsedTime));

  const passResp = await fetch(passUrl, { headers: cookieHeaders(jar), redirect: "manual" });
  jar.absorb(passResp.headers);

  resp = await fetch(url, { headers: cookieHeaders(jar) });
  jar.absorb(resp.headers);
  return resp;
}

function cookieHeaders(jar: CookieJar): Record<string, string> {
  const cookie = jar.header();
  return cookie ? { Cookie: cookie } : {};
}

export { CookieJar };
