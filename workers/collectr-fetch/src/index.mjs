// Raw Signal Collectr fetch worker (2026-08-29). api-v2.getcollectr.com sits behind an
// AWS CloudFront WAF that rejects Workers egress (403) and non-browser clients, so the
// full-collection pagination runs inside a real headless Chrome session via the Browser
// Rendering binding. Two things earn admission: a real-Chrome User-Agent (Browser
// Rendering otherwise sends "Cloudflare-Workers", an obvious bot signature), and running
// the calls as same-site *credentialed* XHRs from the loaded showcase page — exactly
// what the SPA does. The WAF is IP-warming: a cold edge IP is blocked, then admitted for
// a window, so each attempt re-navigates (re-running the SPA auth warms the IP) and the
// whole thing retries a few rounds before giving up. The main raw-signal Workers call
// this one with a bearer token; the response is the list of raw showcase API page bodies,
// parsed downstream by core/collectr.ts.
import puppeteer from "@cloudflare/puppeteer";

const SHOWCASE_ORIGIN = "https://app.getcollectr.com";
const API_ORIGIN = "https://api-v2.getcollectr.com";
const REAL_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const PAGE_SIZE = 30; // the API rejects larger limits with a 401
const WAVE_SIZE = 4; // concurrent page-context fetches per wave
const WAVE_GAP_MS = 250; // pause between waves so a big collection paginates politely
const RATE_WINDOW_MS = 60000;
// Default limits (restore these to loosen back up): global 15/min, per-profile 4/min.
// Exported so they're preserved as the documented originals (and not flagged as unused).
export const ORIGINAL_GLOBAL_LIMIT = 15;
export const ORIGINAL_HANDLE_LIMIT = 4;
// Temporarily tightened 2026-08-30 to minimize load on Collectr while the feature settles.
// Revert by setting these back to ORIGINAL_GLOBAL_LIMIT / ORIGINAL_HANDLE_LIMIT.
const GLOBAL_LIMIT = 5; // account-wide imports per minute
const HANDLE_LIMIT = 1; // imports of any single profile per minute

// Sliding-window rate limiter held in ONE Durable Object instance, so the counters are
// global and consistent across every caller. Budget is only consumed when ALL checks in a
// call pass, so a per-handle rejection never eats the global allowance. In-memory state is
// fine here: a rare DO eviction just resets the window (fails open briefly), which for a
// politeness throttle is acceptable.
export class RateLimiter {
  constructor() { this.hits = new Map(); }
  async fetch(request) {
    const { checks, windowMs } = await request.json();
    const now = Date.now();
    const evaluated = checks.map(({ key, limit }) => {
      const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
      return { key, recent, ok: recent.length < limit };
    });
    const allowed = evaluated.every((entry) => entry.ok);
    if (allowed) for (const entry of evaluated) { entry.recent.push(now); this.hits.set(entry.key, entry.recent); }
    return Response.json({ allowed, blockedBy: allowed ? null : evaluated.find((entry) => !entry.ok).key });
  }
}

// Ask the limiter whether an import for `handle` may proceed (consuming budget if so).
async function allowImport(env, handle) {
  if (!env.LIMITER) return { allowed: true };
  const stub = env.LIMITER.get(env.LIMITER.idFromName("collectr-global"));
  const response = await stub.fetch("https://limiter/limit", {
    method: "POST",
    body: JSON.stringify({ windowMs: RATE_WINDOW_MS, checks: [{ key: "global", limit: GLOBAL_LIMIT }, { key: `handle:${handle}`, limit: HANDLE_LIMIT }] }),
  });
  return response.json();
}
const DEFAULT_MAX_PRODUCTS = 6000;
const HARD_MAX_PRODUCTS = 12000;
const PAGINATION_BUDGET_MS = 45000; // keeps the whole request chain under edge response timeouts
const MAX_ROUNDS = 4; // fresh navigations to warm the WAF's per-IP clearance
const SETTLE_MS = 1800; // let the SPA boot + authenticate before the first credentialed XHR

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const message = (error) => (error instanceof Error ? error.message : String(error));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One warm-up-and-paginate pass in the page context. Returns { pages, complete, failure }.
async function paginate(page, handle, maxProducts, budgetMs) {
  return page.evaluate(
    async ({ apiOrigin, handle, pageSize, waveSize, maxProducts, budgetMs, waveGapMs }) => {
      const started = Date.now();
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const getPage = async (offset) => fetch(`${apiOrigin}/data/showcase/${encodeURIComponent(handle)}?limit=${pageSize}&offset=${offset}`, {
        credentials: "include",
        headers: { accept: "application/json, text/plain, */*" },
      });
      let warm, warmError = null;
      try {
        const response = await getPage(0);
        if (response.ok) warm = await response.json();
        else warmError = `HTTP ${response.status}`;
      } catch (error) { warmError = error && error.message ? error.message : String(error); }
      if (!warm) return { pages: [], complete: false, failure: warmError, elapsedMs: Date.now() - started };

      const pages = [warm];
      let complete = (Array.isArray(warm.products) ? warm.products.length : 0) < pageSize;
      let failure = null;
      for (let base = pageSize; base < maxProducts && !complete && !failure; base += pageSize * waveSize) {
        if (Date.now() - started > budgetMs) { failure = "time budget exhausted"; break; }
        if (base > pageSize && waveGapMs) await wait(waveGapMs); // space out waves so a large collection doesn't burst
        const offsets = [];
        for (let step = 0; step < waveSize; step += 1) {
          const offset = base + step * pageSize;
          if (offset < maxProducts) offsets.push(offset);
        }
        const wave = await Promise.all(offsets.map(async (offset) => {
          try {
            const response = await getPage(offset);
            if (!response.ok) return { error: `HTTP ${response.status} at offset ${offset}` };
            return { data: await response.json() };
          } catch (error) { return { error: `${error && error.message ? error.message : error} at offset ${offset}` }; }
        }));
        for (const entry of wave) {
          if (entry.error) { failure = entry.error; break; }
          pages.push(entry.data);
          if ((Array.isArray(entry.data.products) ? entry.data.products.length : 0) < pageSize) { complete = true; break; }
        }
      }
      return { pages, complete, failure, elapsedMs: Date.now() - started };
    },
    { apiOrigin: API_ORIGIN, handle, pageSize: PAGE_SIZE, waveSize: WAVE_SIZE, maxProducts, budgetMs, waveGapMs: WAVE_GAP_MS },
  );
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET") return json({ error: "GET only" }, 405);
    if (!env.IMPORT_TOKEN || request.headers.get("authorization") !== `Bearer ${env.IMPORT_TOKEN}`) {
      return json({ error: "unauthorized" }, 401);
    }
    const url = new URL(request.url);
    const handle = (url.searchParams.get("profile") ?? "").trim().toLowerCase();
    if (!/^[a-z0-9_.-]{2,64}$/.test(handle)) return json({ error: "invalid profile handle" }, 400);
    const maxProducts = Math.min(Math.max(Number(url.searchParams.get("max")) || DEFAULT_MAX_PRODUCTS, PAGE_SIZE), HARD_MAX_PRODUCTS);

    // Global politeness gate BEFORE spending a browser session: an account-wide cap on
    // imports per minute, plus a tighter per-profile cap, so a stuck retry loop or a burst
    // of clicks can never hammer Collectr. Exceeding it is a soft 429 the caller degrades
    // to the top-30 page import.
    try {
      const gate = await allowImport(env, handle);
      if (!gate.allowed) {
        return json({ error: gate.blockedBy === "global" ? "import rate limit reached — try again in a minute" : "this profile was imported too many times just now — try again shortly" }, 429);
      }
    } catch { /* limiter unavailable: fail open rather than block imports */ }

    let browser;
    try {
      browser = await puppeteer.launch(env.BROWSER);
    } catch (error) {
      return json({ error: `browser launch failed: ${message(error)}` }, 502);
    }
    try {
      const page = await browser.newPage();
      try {
        await page.setUserAgent(REAL_UA);
        await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
      } catch { /* non-fatal: try anyway */ }

      const overallStart = Date.now();
      let lastFailure = "no attempt ran";
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        if (Date.now() - overallStart > PAGINATION_BUDGET_MS) { lastFailure = "time budget exhausted"; break; }
        // Re-navigate each round: a fresh SPA boot re-runs the auth handshake, which is
        // what warms the WAF's per-IP clearance.
        const landing = await page.goto(`${SHOWCASE_ORIGIN}/showcase/profile/@${handle}`, { waitUntil: "domcontentloaded", timeout: 25000 });
        if (landing && landing.status() === 404) return json({ error: "showcase not found" }, 404);
        await sleep(SETTLE_MS);
        const budgetLeft = PAGINATION_BUDGET_MS - (Date.now() - overallStart);
        const result = await paginate(page, handle, maxProducts, Math.max(5000, budgetLeft));
        if (result.pages.length) return json({ ...result, rounds: round + 1 });
        lastFailure = result.failure || "unknown";
        await sleep(500);
      }
      return json({ error: `showcase API blocked pagination: ${lastFailure}` }, 502);
    } catch (error) {
      return json({ error: message(error) }, 502);
    } finally {
      try { await browser.close(); } catch { /* session already torn down */ }
    }
  },
};
