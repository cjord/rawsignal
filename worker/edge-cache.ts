// Edge cache for the Worker's own GET responses (review §14 F7). Cloudflare does not put
// Worker-generated responses in its CDN cache by itself: the `s-maxage` the API routes and
// live feeds already send only reaches browsers and intermediaries. Storing those responses
// in the colo's Cache API means repeat requests for the same URL — hover prefetch, bots, the
// leaderboard's section feeds, the signal boards — never reach D1 again until the copy
// expires. The cache is per colo and shared by every isolate in it.
//
// Two classes of request are cached:
// - `/api/*` and `/data/*`: for the shared lifetime the route itself declares (`s-maxage`),
//   capped below.
// - the public D1-heavy pages (`/sets`, `/sets/…`, `/cards/…`, `/sealed/…`): for a fixed
//   ten minutes. vinext's own ISR (`export const revalidate`) was tried first and never wrote
//   an entry in production — it flags these renders as dynamic, and its store is per isolate
//   — so the Worker caches the finished response itself. Pages are identical for every
//   visitor (preferences live in localStorage; no cookies), and HTML and RSC payloads are
//   kept apart by folding vinext's `Vary` request headers into the cache key.

type CacheLike = { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> };
type WaitUntil = { waitUntil(promise: Promise<unknown>): void };

const ROUTE_CACHED_PREFIXES = ["/api/", "/data/"];
const PAGE_CACHED_PATTERN = /^\/(sets|cards|sealed)(\/|$)/;
// Upper bound on how long a colo keeps a route copy, whatever the route's own s-maxage says:
// the data changes once a day when the live run publishes (~05:00Z), and a board that stayed
// on yesterday's numbers for the signals route's full hour would be visible.
export const EDGE_MAX_AGE_SECONDS = 600;
export const PAGE_EDGE_MAX_AGE_SECONDS = 600;
// The request headers vinext varies page responses on (its responses list them in `Vary`).
const PAGE_VARY_HEADERS = ["rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url", "x-vinext-interception-context", "x-vinext-mounted-slots", "x-vinext-rsc-render-mode", "accept"];

export type EdgeCacheClass = "route" | "page" | null;

// The shared-cache lifetime the response asked for, in seconds; 0 when it must not be shared.
export function sharedMaxAge(cacheControl: string | null): number {
  if (!cacheControl) return 0;
  const lower = cacheControl.toLowerCase();
  if (/\b(no-store|private|no-cache)\b/.test(lower)) return 0;
  const match = lower.match(/\bs-maxage\s*=\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function edgeCacheClass(request: Request): EdgeCacheClass {
  if (request.method !== "GET") return null;
  const { pathname } = new URL(request.url);
  if (ROUTE_CACHED_PREFIXES.some(prefix => pathname.startsWith(prefix))) return "route";
  if (PAGE_CACHED_PATTERN.test(pathname)) return "page";
  return null;
}

export const edgeCacheableRequest = (request: Request) => edgeCacheClass(request) !== null;

// FNV-1a over the vary-header values: short, stable, and enough to keep variants apart.
function varyDigest(request: Request): string {
  let hash = 0x811c9dc5;
  for (const name of PAGE_VARY_HEADERS) {
    const text = `${name}=${request.headers.get(name) ?? ""};`;
    for (let index = 0; index < text.length; index++) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193) >>> 0; }
  }
  return hash.toString(16);
}

// Routes are keyed by their URL; pages by URL plus a digest of the negotiation headers.
export function edgeCacheKey(request: Request, kind: EdgeCacheClass = edgeCacheClass(request)): Request {
  if (kind !== "page") return new Request(request.url, { method: "GET" });
  const url = new URL(request.url);
  url.searchParams.set("__edge", varyDigest(request));
  return new Request(url.toString(), { method: "GET" });
}

// How long the colo may keep this response, in seconds; 0 when it must not be stored.
export function edgeStoreSeconds(response: Response, kind: EdgeCacheClass): number {
  if (response.status !== 200 || response.headers.has("Set-Cookie")) return 0;
  if (kind === "route") return Math.min(sharedMaxAge(response.headers.get("Cache-Control")), EDGE_MAX_AGE_SECONDS);
  if (kind === "page") {
    const type = response.headers.get("Content-Type") ?? "";
    return /text\/html|text\/x-component/.test(type) ? PAGE_EDGE_MAX_AGE_SECONDS : 0;
  }
  return 0;
}

export const edgeCacheableResponse = (response: Response, kind: EdgeCacheClass = "route") => edgeStoreSeconds(response, kind) > 0;

function edgeCache(): CacheLike | null {
  const storage = (globalThis as { caches?: { default?: CacheLike } }).caches;
  return storage?.default ?? null;
}

// Serve from the colo cache when present; otherwise produce, and store a copy in the
// background when the response may be shared. Any cache failure falls through to the
// produced response — the cache is an accelerator, never a dependency.
export async function withEdgeCache(request: Request, ctx: WaitUntil, produce: () => Promise<Response>, cache: CacheLike | null = edgeCache()): Promise<Response> {
  const kind = edgeCacheClass(request);
  if (!cache || !kind) return produce();
  const key = edgeCacheKey(request, kind);
  const cached = await cache.match(key).catch(() => undefined);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("X-Raw-Signal-Edge", "HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }
  const response = await produce();
  const seconds = edgeStoreSeconds(response, kind);
  if (!seconds) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Raw-Signal-Edge", "MISS");
  const served = new Response(response.body, { status: response.status, headers });
  const [toClient, toCache] = served.body ? served.body.tee() : [null, null];
  if (toCache) {
    const stored = new Headers(response.headers);
    stored.set("Cache-Control", `public, s-maxage=${seconds}`);
    const copy = new Response(toCache, { status: served.status, headers: stored });
    ctx.waitUntil(cache.put(key, copy).catch(() => undefined));
  }
  return new Response(toClient, { status: served.status, headers });
}
