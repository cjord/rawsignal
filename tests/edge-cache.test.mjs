import assert from "node:assert/strict";
import test from "node:test";
import { EDGE_MAX_AGE_SECONDS, PAGE_EDGE_MAX_AGE_SECONDS, edgeCacheClass, edgeCacheKey, edgeCacheableRequest, edgeCacheableResponse, edgeStoreSeconds, sharedMaxAge, withEdgeCache } from "../worker/edge-cache.ts";

// The Worker's colo cache for its own API and feed responses. The fake cache records puts
// and serves matches; the fake context collects waitUntil promises so the test can await them.

const ctx = () => { const pending = []; return { waitUntil: p => pending.push(p), pending }; };
const fakeCache = () => { const store = new Map(); return { store, async match(request) { return store.get(request.url); }, async put(request, response) { store.set(request.url, response); } }; };
const json = (body, cacheControl) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", ...(cacheControl ? { "Cache-Control": cacheControl } : {}) } });

test("shared max-age reads s-maxage and refuses private or uncacheable responses", () => {
  assert.equal(sharedMaxAge("public, max-age=60, s-maxage=300, stale-while-revalidate=3600"), 300);
  assert.equal(sharedMaxAge("public, max-age=60"), 0);
  assert.equal(sharedMaxAge("private, s-maxage=300"), 0);
  assert.equal(sharedMaxAge("no-store"), 0);
  assert.equal(sharedMaxAge(null), 0);
});

test("GET requests under /api/, /data/, and the public pages are candidates; only 200s with a shared lifetime are stored", () => {
  assert.equal(edgeCacheableRequest(new Request("https://rawsignal.cards/api/signals?side=buy")), true);
  assert.equal(edgeCacheableRequest(new Request("https://rawsignal.cards/data/pokemon-ultra-rares.json")), true);
  assert.equal(edgeCacheableRequest(new Request("https://rawsignal.cards/sets")), true);
  assert.equal(edgeCacheableRequest(new Request("https://rawsignal.cards/import")), false);
  assert.equal(edgeCacheableRequest(new Request("https://rawsignal.cards/metrics")), false);
  assert.equal(edgeCacheableRequest(new Request("https://rawsignal.cards/__ops/staging-jobs")), false);
  assert.equal(edgeCacheableRequest(new Request("https://rawsignal.cards/api/collectr", { method: "POST" })), false);
  assert.equal(edgeCacheableResponse(json({ ok: 1 }, "public, s-maxage=300")), true);
  assert.equal(edgeCacheableResponse(json({ ok: 1 }, "public, max-age=60")), false);
  assert.equal(edgeCacheableResponse(new Response("nope", { status: 503, headers: { "Cache-Control": "public, s-maxage=300" } })), false);
  const withCookie = json({ ok: 1 }, "public, s-maxage=300"); withCookie.headers.set("Set-Cookie", "a=b");
  assert.equal(edgeCacheableResponse(withCookie), false);
});

test("a miss produces, serves, and stores a copy; the next request is a hit without producing", async () => {
  const cache = fakeCache(), context = ctx(); let produced = 0;
  const request = new Request("https://rawsignal.cards/api/signals?kind=single&market=pokemon&side=buy&strictness=balanced");
  const first = await withEdgeCache(request, context, async () => { produced++; return json({ records: [1, 2] }, "public, max-age=60, s-maxage=300"); }, cache);
  assert.equal(first.headers.get("X-Raw-Signal-Edge"), "MISS");
  assert.deepEqual(await first.json(), { records: [1, 2] });
  await Promise.all(context.pending);
  assert.equal(cache.store.size, 1);
  // The stored copy's lifetime is capped so a daily publish is never hidden for the route's full hour.
  assert.equal([...cache.store.values()][0].headers.get("Cache-Control"), `public, s-maxage=${Math.min(300, EDGE_MAX_AGE_SECONDS)}`);
  const second = await withEdgeCache(request, context, async () => { produced++; return json({ records: [] }, "public, s-maxage=300"); }, cache);
  assert.equal(second.headers.get("X-Raw-Signal-Edge"), "HIT");
  assert.deepEqual(await second.json(), { records: [1, 2] });
  assert.equal(produced, 1);
});

test("a long s-maxage is capped at the edge ceiling in the stored copy while the client keeps the route's header", async () => {
  const cache = fakeCache(), context = ctx();
  const request = new Request("https://rawsignal.cards/api/signals?side=sell");
  const response = await withEdgeCache(request, context, async () => json({ records: [] }, "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"), cache);
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  await Promise.all(context.pending);
  assert.equal([...cache.store.values()][0].headers.get("Cache-Control"), `public, s-maxage=${EDGE_MAX_AGE_SECONDS}`);
});

test("responses without a shared lifetime, non-200s, and non-candidate paths bypass the cache", async () => {
  const cache = fakeCache(), context = ctx();
  const transient = await withEdgeCache(new Request("https://rawsignal.cards/api/signals"), context, async () => json({ ready: false }, "public, max-age=15"), cache);
  assert.equal(transient.headers.get("X-Raw-Signal-Edge"), null);
  const failed = await withEdgeCache(new Request("https://rawsignal.cards/api/metrics"), context, async () => new Response("down", { status: 503, headers: { "Cache-Control": "public, s-maxage=300" } }), cache);
  assert.equal(failed.status, 503);
  const page = await withEdgeCache(new Request("https://rawsignal.cards/sets"), context, async () => new Response("<html>", { status: 200, headers: { "Cache-Control": "public, s-maxage=300" } }), cache);
  assert.equal(page.headers.get("X-Raw-Signal-Edge"), null);
  await Promise.all(context.pending);
  assert.equal(cache.store.size, 0);
});

test("pages are keyed by URL plus vinext's negotiation headers, so HTML and RSC payloads stay apart", () => {
  const html = new Request("https://rawsignal.cards/sets/pokemon/sv-prismatic-evolutions", { headers: { accept: "text/html" } });
  const rsc = new Request("https://rawsignal.cards/sets/pokemon/sv-prismatic-evolutions", { headers: { accept: "text/x-component", rsc: "1", "next-router-state-tree": "%5B%22%22%5D" } });
  assert.equal(edgeCacheClass(html), "page");
  assert.equal(edgeCacheClass(new Request("https://rawsignal.cards/sealed/12?market=scalping")), "page");
  assert.equal(edgeCacheClass(new Request("https://rawsignal.cards/settings")), null);
  assert.equal(edgeCacheClass(new Request("https://rawsignal.cards/")), null);
  const htmlKey = edgeCacheKey(html).url, rscKey = edgeCacheKey(rsc).url;
  assert.notEqual(htmlKey, rscKey);
  assert.equal(htmlKey, edgeCacheKey(new Request(html.url, { headers: { accept: "text/html" } })).url, "the same negotiation yields the same key");
  assert.match(htmlKey, /[?&]__edge=[0-9a-f]+$/);
  // The sealed detail's ?market= stays in the key: the two markets are different pages.
  assert.notEqual(edgeCacheKey(new Request("https://rawsignal.cards/sealed/12?market=scalping")).url, edgeCacheKey(new Request("https://rawsignal.cards/sealed/12")).url);
  // Routes keep their plain URL key.
  assert.equal(edgeCacheKey(new Request("https://rawsignal.cards/api/signals?side=buy")).url, "https://rawsignal.cards/api/signals?side=buy");
});

test("page responses are stored for the page lifetime regardless of the no-store vinext stamps on them; only HTML/RSC bodies qualify", async () => {
  const page = new Response("<html>", { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, must-revalidate" } });
  assert.equal(edgeStoreSeconds(page, "page"), PAGE_EDGE_MAX_AGE_SECONDS);
  assert.equal(edgeStoreSeconds(new Response("x", { status: 200, headers: { "Content-Type": "text/x-component" } }), "page"), PAGE_EDGE_MAX_AGE_SECONDS);
  assert.equal(edgeStoreSeconds(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }), "page"), 0);
  assert.equal(edgeStoreSeconds(new Response("nope", { status: 404, headers: { "Content-Type": "text/html" } }), "page"), 0);
  const cache = fakeCache(), context = ctx(); let produced = 0;
  const request = new Request("https://rawsignal.cards/sets", { headers: { accept: "text/html" } });
  const first = await withEdgeCache(request, context, async () => { produced++; return new Response("<html>sets</html>", { status: 200, headers: { "Content-Type": "text/html", "Cache-Control": "no-store, must-revalidate" } }); }, cache);
  assert.equal(first.headers.get("X-Raw-Signal-Edge"), "MISS");
  assert.equal(await first.text(), "<html>sets</html>");
  await Promise.all(context.pending);
  assert.equal([...cache.store.values()][0].headers.get("Cache-Control"), `public, s-maxage=${PAGE_EDGE_MAX_AGE_SECONDS}`);
  const second = await withEdgeCache(request, context, async () => { produced++; return new Response("fresh"); }, cache);
  assert.equal(second.headers.get("X-Raw-Signal-Edge"), "HIT");
  assert.equal(await second.text(), "<html>sets</html>");
  assert.equal(produced, 1);
});

test("without a Cache API the request is simply produced", async () => {
  let produced = 0;
  const response = await withEdgeCache(new Request("https://rawsignal.cards/api/signals"), ctx(), async () => { produced++; return json({}, "public, s-maxage=300"); }, null);
  assert.equal(response.status, 200);
  assert.equal(produced, 1);
});
