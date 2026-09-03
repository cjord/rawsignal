// Edge cache for the Worker's own GET responses (review §14 F7). Cloudflare does not put
// Worker-generated responses in its CDN cache by itself: the `s-maxage` the API routes and
// live feeds already send only reaches browsers and intermediaries. Storing those responses
// in the colo's Cache API means repeat requests for the same URL — hover prefetch, bots, the
// leaderboard's section feeds, the signal boards — never reach D1 again until `s-maxage`
// expires. Pages (HTML + RSC payloads) are left to vinext's own ISR (`export const revalidate`),
// which keys its variants correctly; this layer only touches `/api/*` and `/data/*`.

type CacheLike = { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> };
type WaitUntil = { waitUntil(promise: Promise<unknown>): void };

const EDGE_CACHED_PREFIXES = ["/api/", "/data/"];
// Upper bound on how long a colo keeps a copy, whatever the route's own s-maxage says: the
// data changes once a day when the live run publishes (~05:00Z), and a board that stayed on
// yesterday's numbers for the signals route's full hour would be visible. Ten minutes matches
// the pages' ISR window; browsers still follow the route's own max-age.
export const EDGE_MAX_AGE_SECONDS = 600;

// The shared-cache lifetime the response asked for, in seconds; 0 when it must not be shared.
export function sharedMaxAge(cacheControl: string | null): number {
  if (!cacheControl) return 0;
  const lower = cacheControl.toLowerCase();
  if (/\b(no-store|private|no-cache)\b/.test(lower)) return 0;
  const match = lower.match(/\bs-maxage\s*=\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function edgeCacheableRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  const { pathname } = new URL(request.url);
  return EDGE_CACHED_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

export function edgeCacheableResponse(response: Response): boolean {
  if (response.status !== 200) return false;
  if (response.headers.has("Set-Cookie")) return false;
  return sharedMaxAge(response.headers.get("Cache-Control")) > 0;
}

function edgeCache(): CacheLike | null {
  const storage = (globalThis as { caches?: { default?: CacheLike } }).caches;
  return storage?.default ?? null;
}

// Serve from the colo cache when present; otherwise produce, and store a copy in the
// background when the response says it may be shared. Any cache failure falls through to
// the produced response — the cache is an accelerator, never a dependency.
export async function withEdgeCache(request: Request, ctx: WaitUntil, produce: () => Promise<Response>, cache: CacheLike | null = edgeCache()): Promise<Response> {
  if (!cache || !edgeCacheableRequest(request)) return produce();
  const cached = await cache.match(request).catch(() => undefined);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("X-Raw-Signal-Edge", "HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }
  const response = await produce();
  if (!edgeCacheableResponse(response)) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Raw-Signal-Edge", "MISS");
  const served = new Response(response.body, { status: response.status, headers });
  const [toClient, toCache] = served.body ? served.body.tee() : [null, null];
  if (toCache) {
    const stored = new Headers(response.headers);
    stored.set("Cache-Control", `public, s-maxage=${Math.min(sharedMaxAge(response.headers.get("Cache-Control")), EDGE_MAX_AGE_SECONDS)}`);
    const copy = new Response(toCache, { status: served.status, headers: stored });
    ctx.waitUntil(cache.put(request, copy).catch(() => undefined));
  }
  return new Response(toClient, { status: served.status, headers });
}
