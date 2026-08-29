import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { normalizeCollectrHandle, normalizeCollectrProducts, parseShowcaseHtml, parseShowcasePage, type CollectrCard, type CollectrProfile, type CollectrRawProduct } from "../../../core/collectr.ts";
import type { Card, SinglesMarket } from "../../../core/domain/types.ts";
import { readCardsByIds } from "../../../db/catalog-repository.ts";
import { publishedIngestion, type D1DatabaseLike } from "../../../db/repository.ts";
import { createFeedCatalogRepository } from "../../data/feed-catalog-repository.ts";
import { CACHE_TIERS } from "../cache.ts";

// Collectr showcase import (2026-08-29). Layered fetch strategy: the SSR page is
// reachable from anywhere and carries the profile plus the 30 most valuable products
// WITH condition/printing; the paginated api-v2 endpoint carries the FULL set (minus
// condition fields) but sits behind a browser-fingerprinting WAF that may or may not
// admit Workers egress. We always parse the page, then attempt the API for
// completeness — a blocked API yields an honest partial import, never an error.
const SHOWCASE_ORIGIN = "https://app.getcollectr.com";
const API_ORIGIN = "https://api-v2.getcollectr.com";
const PAGE_SIZE = 30;
const MAX_PRODUCTS = 6000;
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
  source: "api" | "page";
  skippedGraded: number;
  skippedSealed: number;
  cards: CollectrImportCard[];
};

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

export async function GET(request: Request) {
  const handle = normalizeCollectrHandle(new URL(request.url).searchParams.get("profile") ?? "");
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

  const apiRaw = await fetchApiPages(handle);
  // Page records carry condition/printing the API omits: enrich API records where ids meet.
  let raw = parsed.raw, source: CollectrImportPayload["source"] = "page";
  if (apiRaw && apiRaw.length >= parsed.raw.length) {
    const enrichment = new Map(parsed.raw.map(record => [String(record.product_id), record]));
    raw = apiRaw.map(record => {
      const enriched = enrichment.get(String(record.product_id));
      return enriched ? { ...record, card_condition: record.card_condition ?? enriched.card_condition, product_sub_type: record.product_sub_type ?? enriched.product_sub_type } : record;
    });
    source = "api";
  }
  const { cards, skippedGraded, skippedSealed } = normalizeCollectrProducts(raw);
  const matches = await matchCards(request, cards.map(card => card.productId));
  const withMatches: CollectrImportCard[] = cards.map(card => {
    const match = matches.get(card.productId);
    return {
      ...card,
      matched: match ? { name: match.name, set: match.set, game: match.game, section: match.section, rarity: match.rarity, marketPrice: match.marketPrice, image: match.image || null, detailPath: `/cards/${match.productId}` } : null,
    };
  });
  const payload: CollectrImportPayload = {
    profile: parsed.profile,
    importedAt: new Date().toISOString(),
    partial: source === "page" && parsed.profile.totalCards > parsed.raw.length,
    source,
    skippedGraded,
    skippedSealed,
    cards: withMatches,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": CACHE_TIERS.transient } });
}
