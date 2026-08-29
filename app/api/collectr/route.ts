import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { normalizeCollectrCsv, normalizeCollectrHandle, normalizeCollectrProducts, parseShowcaseHtml, parseShowcasePage, pickCsvMatch, type CollectrCard, type CollectrProfile, type CollectrRawProduct } from "../../../core/collectr.ts";
import type { Card, SinglesMarket } from "../../../core/domain/types.ts";
import { readCardsByIds, readCardsByNames } from "../../../db/catalog-repository.ts";
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
const MAX_PRODUCTS = 6000;
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

const toMatch = (match: Card): CollectrMatch => ({
  name: match.name,
  set: match.set,
  game: match.game,
  section: match.section,
  rarity: match.rarity,
  marketPrice: match.marketPrice,
  image: match.image || null,
  detailPath: `/cards/${match.productId}`,
});

async function fetchApiPages(handle: string): Promise<CollectrRawProduct[] | null> {
  const collected: CollectrRawProduct[] = [];
  for (let offset = 0; offset < MAX_PRODUCTS; offset += PAGE_SIZE) {
    let response: Response;
    try {
      response = await fetch(`${API_ORIGIN}/data/showcase/${encodeURIComponent(handle)}?limit=${PAGE_SIZE}&offset=${offset}`, {
        headers: { ...BROWSER_HEADERS, Accept: "application/json, text/plain, */*" },
      });
    } catch { return null; }
    if (!response.ok) return offset === 0 ? null : collected;
    let page: unknown;
    try { page = await response.json(); } catch { return offset === 0 ? null : collected; }
    const { raw } = parseShowcasePage(page as Parameters<typeof parseShowcasePage>[0]);
    collected.push(...raw);
    if (raw.length < PAGE_SIZE) break;
  }
  return collected;
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
  const assets = (env as unknown as { ASSETS?: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> } }).ASSETS;
  const repository = await createFeedCatalogRepository(new URL(request.url).origin, assets ? assets.fetch.bind(assets) : fetch);
  const matches = new Map<number, Card>();
  for (const market of ["pokemon", "riftbound"] as SinglesMarket[]) {
    const page = await repository.querySingles({ market, sections: [], query: "", sets: [], minPrice: "", maxPrice: "", up7: false, down7: false, up30: false, down30: false, signal: "leaderboard", strictness: "balanced", sort: "market", direction: "desc", page: 1, perPage: 50 });
    for (const card of page.allItems) matches.set(card.productId, card);
  }
  return matches;
}

// CSV rows without a TCGplayer id resolve by exact (case-insensitive) name, then
// number/set disambiguation. Only the published D1 catalog supports this; the bundled
// feed fallback stays id-only.
async function matchCsvByName(cards: CollectrCard[]): Promise<Map<number, Card>> {
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
  let fullError: string | null = null;
  if (full) {
    const browsed = await fetchBrowserPages(handle);
    if ("error" in browsed) fullError = browsed.error;
    else if (browsed.raw.length >= parsed.raw.length) { raw = browsed.raw; source = "browser"; browserComplete = browsed.complete; }
    else fullError = `the browser walk returned ${browsed.raw.length} cards, fewer than the showcase page itself`;
  }
  if (source === "page") {
    const apiRaw = await fetchApiPages(handle);
    if (apiRaw && apiRaw.length >= parsed.raw.length) { raw = apiRaw; source = "api"; }
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
  const matches = await matchCards(request, cards.map(card => card.productId));
  const withMatches: CollectrImportCard[] = cards.map(card => {
    const match = matches.get(card.productId);
    return { ...card, matched: match ? toMatch(match) : null };
  });
  const payload: CollectrImportPayload = {
    profile: parsed.profile,
    importedAt: new Date().toISOString(),
    partial: source === "browser" ? !browserComplete : source === "page" && parsed.profile.totalCards > parsed.raw.length,
    source,
    fullError,
    skippedGraded,
    skippedSealed,
    cards: withMatches,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": CACHE_TIERS.transient } });
}

export async function POST(request: Request) {
  let body: { csv?: unknown; filename?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Send the export as { csv } JSON" }, { status: 400 }); }
  const csv = typeof body.csv === "string" ? body.csv : "";
  if (!csv.trim()) return NextResponse.json({ error: "The CSV file is empty" }, { status: 400 });
  if (csv.length > MAX_CSV_BYTES) return NextResponse.json({ error: "That CSV is too large to import" }, { status: 413 });
  const parsedCsv = normalizeCollectrCsv(csv);
  if ("error" in parsedCsv) return NextResponse.json({ error: parsedCsv.error }, { status: 422 });
  const { cards, skippedGraded, skippedSealed } = parsedCsv;

  const matches = await matchCards(request, cards.filter(card => card.productId > 0).map(card => card.productId));
  const nameMatches = await matchCsvByName(cards.filter(card => !matches.has(card.productId)));
  const withMatches: CollectrImportCard[] = cards.map(card => {
    const match = matches.get(card.productId) ?? nameMatches.get(card.productId);
    if (!match) return { ...card, matched: null };
    // Name-resolved rows adopt the catalog id so signals, history, and favorites line up.
    return { ...card, productId: match.productId, matched: toMatch(match) };
  });
  const filename = typeof body.filename === "string" ? body.filename.replace(/\.csv$/i, "").trim() : "";
  const collectrValue = cards.reduce((sum, card) => sum + (card.collectrPrice ?? 0) * card.quantity, 0);
  const payload: CollectrImportPayload = {
    profile: {
      handle: "csv",
      name: filename || "Collectr CSV export",
      totalCards: cards.length,
      totalSealed: skippedSealed,
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
