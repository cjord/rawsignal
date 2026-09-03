import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { firstNameToken, normalizeCollectrCsv, normalizeCollectrHandle, normalizeCollectrProducts, parseShowcaseHtml, parseShowcasePage, pickCsvMatch, pickFuzzyMatch, type CollectrCard, type CollectrProfile, type CollectrRawProduct, type MatchTier } from "../../../core/collectr.ts";
import type { Card, SealedProduct, SinglesMarket } from "../../../core/domain/types.ts";
import { logImportMatches, readCardsByIds, readCardsByNames, readSealedByIds, readSealedByNames, readSinglesByNamePrefix, readSealedByNamePrefix, type ImportMatchLogEntry } from "../../../db/catalog-repository.ts";
import { publishedIngestion, type D1DatabaseLike } from "../../../db/repository.ts";
import { createFeedCatalogRepository } from "../../data/feed-catalog-repository.ts";
import { CACHE_TIERS } from "../cache.ts";

// Collectr showcase import (2026-08-29). Layered fetch strategy: the SSR page is
// reachable from anywhere and carries the profile plus the 30 most valuable products
// WITH condition/printing; the paginated api-v2 endpoint carries the FULL set (minus
// condition fields) but sits behind a browser-fingerprinting WAF that rejects Workers
// egress. mode=full relays through the raw-signal-collectr Browser Rendering worker,
// whose real-Chrome session passes the WAF; without it (or when it fails) the layered
// fallback yields an honest partial import, never an error. POST imports a Collectr
// Pro CSV export instead — no scraping at all.
const SHOWCASE_ORIGIN = "https://app.getcollectr.com";
const API_ORIGIN = "https://api-v2.getcollectr.com";
const PAGE_SIZE = 30;
// The direct API walk is bounded (review 2026-09-03): an unauthenticated request must not
// fan out into hundreds of upstream fetches. Showcases beyond the cap import in full through
// the rate-limited browser worker (`mode=full`); a capped or interrupted walk reports itself
// incomplete so the payload's `partial` flag stays honest.
const MAX_API_PAGES = 20;
const MAX_CSV_BYTES = 8_000_000;
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin": SHOWCASE_ORIGIN,
  "Referer": `${SHOWCASE_ORIGIN}/`,
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
};

export type CollectrMatch = {
  kind: "single" | "sealed";
  matchTier: MatchTier;
  name: string;
  set: string;
  game: string;
  section: string;
  rarity: string;
  marketPrice: number;
  image: string | null;
  detailPath: string;
};

export type CollectrImportCard = CollectrCard & { matched: CollectrMatch | null };

export type CollectrImportPayload = {
  profile: CollectrProfile;
  importedAt: string;
  partial: boolean;
  source: "api" | "page" | "browser" | "csv";
  fullError?: string | null;
  skippedGraded: number;
  skippedSealed: number;
  cards: CollectrImportCard[];
};

const toSingleMatch = (match: Card, matchTier: MatchTier): CollectrMatch => ({
  kind: "single",
  matchTier,
  name: match.name,
  set: match.set,
  game: match.game,
  section: match.section,
  rarity: match.rarity,
  marketPrice: match.marketPrice,
  image: match.image || null,
  detailPath: `/cards/${match.productId}`,
});

const toSealedMatch = (match: SealedProduct, matchTier: MatchTier): CollectrMatch => ({
  kind: "sealed",
  matchTier,
  name: match.name,
  set: match.set,
  game: match.game,
  section: "Sealed",
  rarity: match.category,
  marketPrice: match.marketPrice ?? 0,
  image: match.image || null,
  detailPath: `/sealed/${match.productId}`,
});

async function fetchApiPages(handle: string): Promise<{ raw: CollectrRawProduct[]; complete: boolean } | null> {
  const collected: CollectrRawProduct[] = [];
  for (let page = 0; page < MAX_API_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    let response: Response;
    try {
      response = await fetch(`${API_ORIGIN}/data/showcase/${encodeURIComponent(handle)}?limit=${PAGE_SIZE}&offset=${offset}`, {
        headers: { ...BROWSER_HEADERS, Accept: "application/json, text/plain, */*" },
      });
    } catch { return null; }
    if (!response.ok) return offset === 0 ? null : { raw: collected, complete: false };
    let body: unknown;
    try { body = await response.json(); } catch { return offset === 0 ? null : { raw: collected, complete: false }; }
    const { raw } = parseShowcasePage(body as Parameters<typeof parseShowcasePage>[0]);
    collected.push(...raw);
    if (raw.length < PAGE_SIZE) return { raw: collected, complete: true };
  }
  return { raw: collected, complete: false };
}

// Full pagination relayed through the Browser Rendering worker (its real-Chrome
// page-context fetches pass the WAF). Reached via the COLLECTR_FETCH service binding — a
// same-account workers.dev fetch 404s, so a binding is required. COLLECTR_FETCH_TOKEN is
// the shared bearer the worker gates on; COLLECTR_FETCH_URL is only a local-dev fallback.
type FetchLike = { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
async function fetchBrowserPages(handle: string): Promise<{ raw: CollectrRawProduct[]; complete: boolean } | { error: string }> {
  const { COLLECTR_FETCH: binding, COLLECTR_FETCH_URL: fetchUrl, COLLECTR_FETCH_TOKEN: fetchToken } = env as unknown as { COLLECTR_FETCH?: FetchLike; COLLECTR_FETCH_URL?: string; COLLECTR_FETCH_TOKEN?: string };
  if (!fetchToken || (!binding && !fetchUrl)) return { error: "the full-import worker isn't configured on this deployment" };
  const target = `https://collectr-fetch/?profile=${encodeURIComponent(handle)}`;
  const init: RequestInit = { headers: { Authorization: `Bearer ${fetchToken}` } };
  let response: Response;
  try {
    response = binding ? await binding.fetch(target, init) : await fetch(`${fetchUrl}?profile=${encodeURIComponent(handle)}`, init);
  } catch { return { error: "the full-import worker is unreachable" }; }
  let body: { pages?: unknown[]; complete?: boolean; failure?: string | null; error?: string };
  try { body = await response.json() as typeof body; } catch { return { error: `the full-import worker returned HTTP ${response.status}` }; }
  if (!response.ok || body.error) return { error: body.error ?? `the full-import worker returned HTTP ${response.status}` };
  const raw: CollectrRawProduct[] = [];
  for (const page of body.pages ?? []) raw.push(...parseShowcasePage(page as Parameters<typeof parseShowcasePage>[0]).raw);
  return { raw, complete: body.complete === true && !body.failure };
}

async function matchCards(request: Request, ids: number[]): Promise<Map<number, Card>> {
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  if (db) {
    try {
      if (await publishedIngestion(db)) {
        return new Map((await readCardsByIds(db, ids)).map(card => [card.productId, card]));
      }
    } catch { /* fall through to the bundled feeds */ }
  }
  // Development-only fallback (no published D1 run): the bundled feeds answer with each
  // market's top 50 — enough for local import demos, never the production matching path.
  const assets = (env as unknown as { ASSETS?: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> } }).ASSETS;
  const repository = await createFeedCatalogRepository(new URL(request.url).origin, assets ? assets.fetch.bind(assets) : fetch);
  const matches = new Map<number, Card>();
  for (const market of ["pokemon", "riftbound"] as SinglesMarket[]) {
    const page = await repository.querySingles({ market, sections: [], query: "", sets: [], regimes: [], minPrice: "", maxPrice: "", up7: false, down7: false, up30: false, down30: false, signal: "leaderboard", strictness: "balanced", sort: "market", direction: "desc", page: 1, perPage: 50 });
    for (const card of page.allItems) matches.set(card.productId, card);
  }
  return matches;
}

// Sealed matching is D1-only (the published catalog): the bundled-feed fallback would need
// the full sealed query surface for a dev-only path, so sealed rows simply stay unmatched
// when D1 isn't published (a rare, transient window).
async function matchSealed(ids: number[]): Promise<Map<number, SealedProduct>> {
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  if (!db || !ids.length) return new Map();
  try {
    if (await publishedIngestion(db)) return new Map((await readSealedByIds(db, ids)).map(product => [product.productId, product]));
  } catch { /* no D1 sealed matches this window */ }
  return new Map();
}

// Name fallback for items an id-join missed — CSV rows without a TCGplayer id AND showcase
// items Collectr filed under its own synthetic id (10,000,000+) for a product we hold under
// its real TCGplayer id (e.g. a retailer "case" variant). Exact (case-insensitive) name,
// then number/set disambiguation. Only the published D1 catalog supports this.
async function matchSinglesByName(cards: CollectrCard[]): Promise<Map<number, Card>> {
  const matches = new Map<number, Card>();
  if (!cards.length) return matches;
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  if (!db) return matches;
  try { if (!(await publishedIngestion(db))) return matches; } catch { return matches; }
  const candidates = await readCardsByNames(db, cards.map(card => card.name));
  const byName = new Map<string, Card[]>();
  for (const candidate of candidates) {
    const key = candidate.name.toLowerCase();
    const bucket = byName.get(key);
    if (bucket) bucket.push(candidate); else byName.set(key, [candidate]);
  }
  for (const card of cards) {
    const pick = pickCsvMatch(card, byName.get(card.name.toLowerCase()) ?? []);
    if (pick) matches.set(card.productId, pick);
  }
  return matches;
}

// Sealed name fallback (CSV rows without an id, and showcase synthetic-id items): name,
// then set. D1-only.
async function matchSealedByName(cards: CollectrCard[]): Promise<Map<number, SealedProduct>> {
  const matches = new Map<number, SealedProduct>();
  if (!cards.length) return matches;
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  if (!db) return matches;
  try { if (!(await publishedIngestion(db))) return matches; } catch { return matches; }
  const candidates = await readSealedByNames(db, cards.map(card => card.name));
  const byName = new Map<string, SealedProduct[]>();
  for (const candidate of candidates) {
    const key = candidate.name.toLowerCase();
    const bucket = byName.get(key);
    if (bucket) bucket.push(candidate); else byName.set(key, [candidate]);
  }
  for (const card of cards) {
    const pool = byName.get(card.name.toLowerCase()) ?? [];
    // number is empty for sealed, so pickCsvMatch falls through to the set match.
    const pick = pickCsvMatch(card, pool.map(product => ({ ...product, number: "" })));
    if (pick) matches.set(card.productId, pick as unknown as SealedProduct);
  }
  return matches;
}

// Fuzzy tier (D1-only): for items no id- or name-join reached, pull a bounded candidate
// pool by first-name-token prefix and pick the best normalized/fuzzy match in JS.
type FuzzyHit<T> = { product: T; tier: "normalized" | "fuzzy"; score: number };
async function fuzzyMatch<T extends { productId: number; name: string; number?: string; set?: string }>(
  cards: CollectrCard[],
  fetchPool: (db: D1DatabaseLike, prefixes: string[]) => Promise<T[]>,
): Promise<Map<number, FuzzyHit<T>>> {
  const out = new Map<number, FuzzyHit<T>>();
  if (!cards.length) return out;
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  if (!db) return out;
  try { if (!(await publishedIngestion(db))) return out; } catch { return out; }
  const pool = (await fetchPool(db, cards.map(card => firstNameToken(card.name)))).map(product => ({ product, token: firstNameToken(product.name) }));
  for (const card of cards) {
    const token = firstNameToken(card.name);
    if (!token) continue;
    const candidates = pool.filter(entry => entry.token === token).map(entry => entry.product);
    const hit = pickFuzzyMatch({ name: card.name, number: card.number, set: card.set }, candidates);
    if (hit) out.set(card.productId, hit);
  }
  return out;
}

// Resolve every normalized item to a catalog match through three tiers — id-join, then
// exact name, then normalized/fuzzy — for singles and sealed alike. Name/fuzzy-resolved
// rows adopt the catalog id so signals, history, and favorites line up, and each carries
// its matchTier. Returns the log entries for every non-id (fallback) match so the caller
// can record them for manual review. Shared by the showcase (GET) and CSV (POST) paths.
async function resolveMatches(request: Request, cards: CollectrCard[]): Promise<{ withMatches: CollectrImportCard[]; logEntries: ImportMatchLogEntry[] }> {
  const singles = cards.filter(card => card.kind === "single");
  const sealed = cards.filter(card => card.kind === "sealed");
  const [singleIds, sealedIds] = await Promise.all([
    matchCards(request, singles.filter(card => card.productId > 0).map(card => card.productId)),
    matchSealed(sealed.filter(card => card.productId > 0).map(card => card.productId)),
  ]);
  const [singleNames, sealedNames] = await Promise.all([
    matchSinglesByName(singles.filter(card => !singleIds.has(card.productId))),
    matchSealedByName(sealed.filter(card => !sealedIds.has(card.productId))),
  ]);
  const [singleFuzzy, sealedFuzzy] = await Promise.all([
    fuzzyMatch<Card>(singles.filter(card => !singleIds.has(card.productId) && !singleNames.has(card.productId)), readSinglesByNamePrefix),
    fuzzyMatch<SealedProduct>(sealed.filter(card => !sealedIds.has(card.productId) && !sealedNames.has(card.productId)), readSealedByNamePrefix),
  ]);

  const logEntries: ImportMatchLogEntry[] = [];
  const withMatches = cards.map<CollectrImportCard>(card => {
    if (card.kind === "sealed") {
      if (sealedIds.has(card.productId)) return { ...card, matched: toSealedMatch(sealedIds.get(card.productId)!, "id") };
      const named = sealedNames.get(card.productId); const fuzzy = named ? null : sealedFuzzy.get(card.productId);
      const product = named ?? fuzzy?.product; const tier: MatchTier | null = named ? "name" : fuzzy ? fuzzy.tier : null;
      if (!product || !tier) return { ...card, matched: null };
      logEntries.push({ collectrProductId: card.productId, matchedProductId: product.productId, kind: "sealed", matchTier: tier as "name" | "normalized" | "fuzzy", score: fuzzy ? fuzzy.score : null, collectrName: card.name, collectrSet: card.set, matchedName: product.name });
      return { ...card, productId: product.productId, matched: toSealedMatch(product, tier) };
    }
    if (singleIds.has(card.productId)) return { ...card, matched: toSingleMatch(singleIds.get(card.productId)!, "id") };
    const named = singleNames.get(card.productId); const fuzzy = named ? null : singleFuzzy.get(card.productId);
    const product = named ?? fuzzy?.product; const tier: MatchTier | null = named ? "name" : fuzzy ? fuzzy.tier : null;
    if (!product || !tier) return { ...card, matched: null };
    logEntries.push({ collectrProductId: card.productId, matchedProductId: product.productId, kind: "single", matchTier: tier as "name" | "normalized" | "fuzzy", score: fuzzy ? fuzzy.score : null, collectrName: card.name, collectrSet: card.set, matchedName: product.name });
    return { ...card, productId: product.productId, matched: toSingleMatch(product, tier) };
  });
  return { withMatches, logEntries };
}

// Persist the fallback-match log for later review; never let it break an import.
async function recordMatchLog(entries: ImportMatchLogEntry[]): Promise<void> {
  if (!entries.length) return;
  const db = env.DB as unknown as D1DatabaseLike | undefined;
  if (!db) return;
  try { await logImportMatches(db, entries, new Date().toISOString()); } catch { /* audit is best-effort */ }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const handle = normalizeCollectrHandle(url.searchParams.get("profile") ?? "");
  const full = url.searchParams.get("mode") === "full";
  if (!handle) return NextResponse.json({ error: "Enter a Collectr showcase link or @handle" }, { status: 400 });
  let pageResponse: Response;
  try {
    pageResponse = await fetch(`${SHOWCASE_ORIGIN}/showcase/profile/@${handle}`, {
      headers: { "User-Agent": BROWSER_HEADERS["User-Agent"], Accept: "text/html,application/xhtml+xml" },
    });
  } catch {
    return NextResponse.json({ error: "Collectr is unreachable right now" }, { status: 502 });
  }
  if (pageResponse.status === 404) return NextResponse.json({ error: "No Collectr showcase found for that handle" }, { status: 404 });
  if (!pageResponse.ok) return NextResponse.json({ error: `Collectr returned HTTP ${pageResponse.status}` }, { status: 502 });
  const parsed = parseShowcaseHtml(await pageResponse.text());
  if (!parsed) return NextResponse.json({ error: "Could not read that showcase — is it public?" }, { status: 502 });

  let raw = parsed.raw;
  let source: CollectrImportPayload["source"] = "page";
  let browserComplete = false;
  let apiComplete = true;
  let fullError: string | null = null;
  if (full) {
    const browsed = await fetchBrowserPages(handle);
    if ("error" in browsed) fullError = browsed.error;
    else if (browsed.raw.length >= parsed.raw.length) { raw = browsed.raw; source = "browser"; browserComplete = browsed.complete; }
    else fullError = `the browser walk returned ${browsed.raw.length} cards, fewer than the showcase page itself`;
  }
  if (source === "page") {
    const api = await fetchApiPages(handle);
    if (api && api.raw.length >= parsed.raw.length) { raw = api.raw; source = "api"; apiComplete = api.complete; }
  }
  if (source !== "page") {
    // Page records carry condition/printing the API omits: enrich API records where ids meet.
    const enrichment = new Map(parsed.raw.map(record => [String(record.product_id), record]));
    raw = raw.map(record => {
      const enriched = enrichment.get(String(record.product_id));
      return enriched ? { ...record, card_condition: record.card_condition ?? enriched.card_condition, product_sub_type: record.product_sub_type ?? enriched.product_sub_type } : record;
    });
  }
  const { cards, skippedGraded, skippedSealed } = normalizeCollectrProducts(raw);
  const { withMatches, logEntries } = await resolveMatches(request, cards);
  await recordMatchLog(logEntries);
  const payload: CollectrImportPayload = {
    profile: parsed.profile,
    importedAt: new Date().toISOString(),
    partial: source === "browser" ? !browserComplete : source === "api" ? !apiComplete : parsed.profile.totalCards > parsed.raw.length,
    source,
    fullError,
    skippedGraded,
    skippedSealed,
    cards: withMatches,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": CACHE_TIERS.transient } });
}

export async function POST(request: Request) {
  // Reject an oversized upload before buffering it; the post-parse length check below still
  // covers requests that omit or understate the header.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_CSV_BYTES) return NextResponse.json({ error: "That CSV is too large to import" }, { status: 413 });
  let body: { csv?: unknown; filename?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Send the export as { csv } JSON" }, { status: 400 }); }
  const csv = typeof body.csv === "string" ? body.csv : "";
  if (!csv.trim()) return NextResponse.json({ error: "The CSV file is empty" }, { status: 400 });
  if (csv.length > MAX_CSV_BYTES) return NextResponse.json({ error: "That CSV is too large to import" }, { status: 413 });
  const parsedCsv = normalizeCollectrCsv(csv);
  if ("error" in parsedCsv) return NextResponse.json({ error: parsedCsv.error }, { status: 422 });
  const { cards, skippedGraded, skippedSealed } = parsedCsv;

  const { withMatches, logEntries } = await resolveMatches(request, cards);
  await recordMatchLog(logEntries);
  const singles = cards.filter(card => card.kind === "single");
  const sealed = cards.filter(card => card.kind === "sealed");
  const filename = typeof body.filename === "string" ? body.filename.replace(/\.csv$/i, "").trim() : "";
  const collectrValue = cards.reduce((sum, card) => sum + (card.collectrPrice ?? 0) * card.quantity, 0);
  const payload: CollectrImportPayload = {
    profile: {
      handle: "csv",
      name: filename || "Collectr CSV export",
      totalCards: singles.length,
      totalSealed: sealed.length,
      totalGraded: skippedGraded,
      collectrValue: collectrValue > 0 ? Math.round(collectrValue * 100) / 100 : null,
    },
    importedAt: new Date().toISOString(),
    partial: false,
    source: "csv",
    fullError: null,
    skippedGraded,
    skippedSealed,
    cards: withMatches,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": CACHE_TIERS.transient } });
}
