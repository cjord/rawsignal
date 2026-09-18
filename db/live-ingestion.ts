import type { Card, SealedProduct } from "../core/domain/types.ts";
import { supplementalSingles } from "../core/domain/supplemental-singles.ts";
import { normalizeSinglesGroup, type SinglesPriceRow, type SinglesSourceProduct } from "../core/normalize/singles.ts";
import { normalizeJapaneseSealedProduct, normalizeOnePieceSealedProduct, normalizePokemonSealedProduct, normalizeRiftboundSealedProduct, preferredSealedPrice, sealedIdentity, type SealedPriceRow } from "../core/normalize/sealed.ts";
import { JAPANESE_SEALED_SINCE, type SealedSourceProduct } from "../core/sealed-product-utils.ts";
import { summarizeGroupRarities, type GroupRarityStat } from "../core/normalize/rarity-stats.ts";
import { persistRecord } from "./daily-ingestion.ts";
import { writeSetRarityStats } from "./rarity-stats.ts";
import { clampBatchSize, markIngestionFailed, parseStatsJson, resumeCheckpoint } from "./ingestion-batch.ts";
import { checkpointIngestion, completeIngestion, failIngestion, startIngestion, type D1DatabaseLike } from "./repository.ts";

export type TcgcsvGroup = { groupId: number; name: string; publishedOn: string };
export type TcgcsvClient = {
  groups(categoryId: number): Promise<TcgcsvGroup[]>;
  products(categoryId: number, groupId: number): Promise<Record<string, unknown>[]>;
  prices(categoryId: number, groupId: number): Promise<Record<string, unknown>[]>;
};
export type LiveSyncDeps = {
  client: TcgcsvClient;
  // Published-MSRP records keyed by productId; fetched lazily, only when a Pokémon group is processed.
  fetchMsrp(): Promise<Map<number, unknown>>;
  // The bundled feeds ride along as pseudo-groups after the walked categories so every
  // catalog row stays stamped with the current run: riftbound merges curated MSRPs and
  // keeps curated-only products alive; onepiece (walked since 2026-08-31, todo L2) keeps
  // the bundled feed as the deploy-fallback safety net — first-occurrence dedupe means
  // walked rows always win.
  loadBundledSealed(market: "riftbound" | "onepiece"): Promise<SealedProduct[]>;
};

type WorkEntry =
  | { type: "tcgcsv"; categoryId: number; game: "pokemon" | "riftbound"; group: TcgcsvGroup; fixedSection?: [string, string] }
  | { type: "tcgcsv-sealed"; categoryId: number; game: "onepiece" | "pokemon"; group: TcgcsvGroup }
  | { type: "bundled"; market: "riftbound" | "onepiece" }
  | { type: "supplemental-singles" };
type LiveStats = { recordsWritten?: number; duplicateDecisions?: number; rejected?: Record<string, number> };

const categories = [{ id: 3, game: "pokemon" as const }, { id: 89, game: "riftbound" as const }];
// Japanese Pokémon (TCGCSV category 85, audit Phase E): only the promo groups for now —
// the stated priority — as one fixed section; the full JP catalog is a later decision.
export const JAPANESE_CATEGORY_ID = 85;
export const JAPANESE_PROMOS_SECTION: [string, string] = ["japanese-promos", "Japanese Promos"];
const japanesePromoGroup = (group: TcgcsvGroup) => /promo/i.test(group.name);
// Sealed-only categories (todo L1/L2): the walk keeps sealed rows and never runs the
// singles normalizer — One Piece singles are a separate, curated-rarity phase, and the
// JP promo groups keep their own singles-only fixed-section entries (skipGroup below
// prevents double-walking them; their handful of sealed-shaped items stays out).
const sealedOnlyCategories: { id: number; game: "onepiece" | "pokemon"; publishedSince?: string; skipGroup?: (group: TcgcsvGroup) => boolean }[] = [
  { id: 68, game: "onepiece" },
  { id: JAPANESE_CATEGORY_ID, game: "pokemon", publishedSince: JAPANESE_SEALED_SINCE, skipGroup: japanesePromoGroup },
];
// Sealed-only groups yield ~1 record each, so the singles-calibrated group cap wasted
// ticks walking them (todo M3) — they count against their own, higher cap. Worst-case
// straddling tick: 12×2 + 40×2 ≈ 104 subrequests of the 1,000-per-invocation allowance.
export const SEALED_GROUP_FETCH_CAP = 40;
const parseCursor = (value: string | null | undefined) => { const match = /^(\d+):(\d+)$/.exec(value ?? ""); return match ? { group: Number(match[1]), offset: Number(match[2]) } : { group: 0, offset: 0 }; };

// Upcoming sets list on TCGCSV with a FUTURE publishedOn while their presale sealed
// (and later presale singles) already carry live prices — Delta Reign proved the old
// `publishedOn <= now` filter silently excluded a set's entire presale window (todo
// P7 dynamic EVE needs those pre-order prices). Walk groups up to this far ahead;
// truly empty future groups cost ~2 requests each and yield nothing.
const PRESALE_HORIZON_DAYS = 120;
async function buildWorkList(client: TcgcsvClient, now: Date): Promise<WorkEntry[]> {
  const horizon = new Date(now.getTime() + PRESALE_HORIZON_DAYS * 86400000);
  const entries: WorkEntry[] = [];
  for (const category of categories) {
    const groups = (await client.groups(category.id)).filter(group => new Date(group.publishedOn) <= horizon);
    groups.sort((a, b) => a.groupId - b.groupId);
    for (const group of groups) entries.push({ type: "tcgcsv", categoryId: category.id, game: category.game, group });
  }
  const japaneseGroups = (await client.groups(JAPANESE_CATEGORY_ID)).filter(group => japanesePromoGroup(group) && new Date(group.publishedOn) <= horizon);
  japaneseGroups.sort((a, b) => a.groupId - b.groupId);
  for (const group of japaneseGroups) entries.push({ type: "tcgcsv", categoryId: JAPANESE_CATEGORY_ID, game: "pokemon", group, fixedSection: JAPANESE_PROMOS_SECTION });
  for (const category of sealedOnlyCategories) {
    const since = category.publishedSince ? new Date(category.publishedSince) : null;
    const groups = (await client.groups(category.id)).filter(group => {
      const published = new Date(group.publishedOn);
      return published <= horizon && (!since || published >= since) && !category.skipGroup?.(group);
    });
    groups.sort((a, b) => a.groupId - b.groupId);
    for (const group of groups) entries.push({ type: "tcgcsv-sealed", categoryId: category.id, game: category.game, group });
  }
  entries.push({ type: "bundled", market: "riftbound" }, { type: "bundled", market: "onepiece" });
  entries.push({ type: "supplemental-singles" });
  return entries;
}

type EntryLoad = { records: (Card | SealedProduct)[]; rarityStats: GroupRarityStat[] };

async function loadEntryRecords(entry: WorkEntry, deps: LiveSyncDeps, msrp: () => Promise<Map<number, unknown>>, curatedRiftbound: () => Promise<Map<number, SealedProduct>>, rejected: Record<string, number>): Promise<EntryLoad> {
  if (entry.type === "supplemental-singles") return { records: [...supplementalSingles], rarityStats: [] };
  return loadSourceEntryRecords(entry,deps,msrp,curatedRiftbound,rejected);
}

async function loadSourceEntryRecords(entry: Exclude<WorkEntry,{type:"supplemental-singles"}>, deps: LiveSyncDeps, msrp: () => Promise<Map<number, unknown>>, curatedRiftbound: () => Promise<Map<number, SealedProduct>>, rejected: Record<string, number>): Promise<EntryLoad> {
  if (entry.type === "bundled") return { records: await deps.loadBundledSealed(entry.market), rarityStats: [] };
  const [products, prices] = await Promise.all([deps.client.products(entry.categoryId, entry.group.groupId), deps.client.prices(entry.categoryId, entry.group.groupId)]);
  // Per-tier aggregate over EVERY card in a singles group (todo J2): the bulk tiers the
  // catalog never keeps are priced here, from the files this walk already fetched.
  // Fixed-section groups (Japanese promos) have no rarity taxonomy and are skipped.
  const rarityStats = entry.type === "tcgcsv" && !entry.fixedSection ? summarizeGroupRarities({ game: entry.game, products: products as SinglesSourceProduct[], prices: prices as SinglesPriceRow[] }) : [];
  if (entry.type === "tcgcsv-sealed") {
    const pricesById = new Map<number, Record<string, unknown>[]>();
    for (const row of prices) { const id = Number(row.productId); const rows = pricesById.get(id) ?? []; rows.push(row); pricesById.set(id, rows); }
    const sealed: SealedProduct[] = [], seenIdentity = new Set<string>();
    for (const raw of products) {
      const product = raw as SealedSourceProduct & { name: string };
      const price = preferredSealedPrice(pricesById.get(Number(product.productId)) as SealedPriceRow[] | undefined);
      const normalized = entry.game === "onepiece"
        ? normalizeOnePieceSealedProduct(product, entry.group, price)
        : normalizeJapaneseSealedProduct(product, entry.group, price);
      if (!normalized) continue;
      const identity = sealedIdentity(product, entry.group);
      if (seenIdentity.has(identity)) continue;
      seenIdentity.add(identity);
      sealed.push(normalized);
    }
    return { records: sealed.sort((a, b) => a.productId - b.productId), rarityStats };
  }
  // Wire rows narrow once at this boundary; everything downstream is typed.
  const normalized = normalizeSinglesGroup({ game: entry.game, group: entry.group, products: products as SinglesSourceProduct[], prices: prices as SinglesPriceRow[], fixedSection: entry.fixedSection ?? null });
  for (const [reason, count] of Object.entries(normalized.rejected)) rejected[reason] = (rejected[reason] ?? 0) + count;
  const records: (Card | SealedProduct)[] = [...normalized.cards].sort((a, b) => a.productId - b.productId);
  // Fixed-section categories (Japanese promos) contribute singles only — their sealed
  // products are out of scope and must not slip into the English sealed catalog.
  if (entry.fixedSection) return { records, rarityStats };
  const pricesByProduct = new Map<number, Record<string, unknown>[]>();
  for (const row of prices) { const id = Number(row.productId); const rows = pricesByProduct.get(id) ?? []; rows.push(row); pricesByProduct.set(id, rows); }
  // Sealed normalizes from the same group walk as singles. Pokémon MSRPs come from the
  // published-MSRP feed; Riftbound MSRPs merge from the curated bundled feed (which still
  // rides along afterward — first-occurrence dedupe keeps these walked rows and lets
  // curated-only products land).
  const sealed: SealedProduct[] = [], seenIdentity = new Set<string>();
  const msrpById = entry.game === "pokemon" ? await msrp() : null;
  const curatedById = entry.game === "riftbound" ? await curatedRiftbound() : null;
  for (const raw of products) {
    const product = raw as SealedSourceProduct & { name: string };
    const price = preferredSealedPrice(pricesByProduct.get(Number(product.productId)) as SealedPriceRow[] | undefined);
    const normalizedSealed = entry.game === "pokemon"
      ? normalizePokemonSealedProduct(product, entry.group, price, msrpById?.get(Number(product.productId)) as { msrp?: unknown } | undefined)
      : normalizeRiftboundSealedProduct(product, entry.group, price, curatedById?.get(Number(product.productId)));
    if (!normalizedSealed) continue;
    const identity = sealedIdentity(product, entry.group);
    if (seenIdentity.has(identity)) continue;
    seenIdentity.add(identity);
    sealed.push(normalizedSealed);
  }
  records.push(...sealed.sort((a, b) => a.productId - b.productId));
  return { records, rarityStats };
}

// Cross-group duplicates (promo cards reprinted across sets) follow the local sync's rules:
// cards keep the higher market price, sealed keeps the first occurrence. One query per slice
// reads what this run already stamped.
async function existingRunRows(db: D1DatabaseLike, runId: string, ids: number[]) {
  const rows = new Map<number, { kind: string; marketCents: number | null }>();
  const unique = [...new Set(ids)];
  for (let offset = 0; offset < unique.length; offset += 80) {
    const slice = unique.slice(offset, offset + 80);
    const results = (await db.prepare(`select p.product_id as productId,p.kind,cp.market_cents as marketCents from catalog_products p
      left join current_prices cp on cp.product_id=p.product_id
      where p.ingestion_run_id=? and p.product_id in (${slice.map(() => "?").join(",")})`).bind(runId, ...slice).all<{ productId: number; kind: string; marketCents: number | null }>()).results ?? [];
    for (const row of results) rows.set(row.productId, { kind: row.kind, marketCents: row.marketCents });
  }
  return rows;
}

export async function runLiveDailyIngestionBatch(db: D1DatabaseLike, deps: LiveSyncDeps, options: { sourceUpdatedAt: string; batchSize?: number; groupFetchCap?: number; minimumRecords?: number; now?: Date }) {
  const budgetTotal = clampBatchSize(options.batchSize, 80, 100);
  // Not clampBatchSize: the cap is a loop bound, and the historical clamp never floored.
  const groupFetchCap = Math.max(1, Math.min(20, options.groupFetchCap ?? 12));
  const minimumRecords = options.minimumRecords ?? 10000;
  const now = options.now ?? new Date(), observedAt = now.toISOString(), asOfDate = observedAt.slice(0, 10);
  const runId = `live-daily:${options.sourceUpdatedAt.slice(0, 10)}`;
  const resume = await resumeCheckpoint(db, "live-daily-progress", runId);
  const resumed = resume.resumed;
  let { group: groupIndex, offset: recordOffset } = parseCursor(resume.cursor);
  const prior = parseStatsJson<LiveStats>(resume.statsJson);
  let recordsWritten = prior.recordsWritten ?? 0, duplicateDecisions = prior.duplicateDecisions ?? 0;
  const rejected: Record<string, number> = { ...(prior.rejected ?? {}) };
  if (!resumed) await startIngestion(db, runId, "tcgcsv-live", observedAt, { sourceUpdatedAt: options.sourceUpdatedAt, stats: { rejected: {} } });
  let msrpPromise: Promise<Map<number, unknown>> | null = null;
  const msrp = () => msrpPromise ??= deps.fetchMsrp();
  let curatedRiftboundPromise: Promise<Map<number, SealedProduct>> | null = null;
  const curatedRiftbound = () => curatedRiftboundPromise ??= deps.loadBundledSealed("riftbound").then(items => new Map(items.map(item => [item.productId, item])));
  try {
    const workList = await buildWorkList(deps.client, now);
    let remaining = budgetTotal, groupFetches = 0, sealedGroupFetches = 0, processed = 0;
    while (remaining > 0 && groupIndex < workList.length) {
      const entry = workList[groupIndex];
      const sealedOnly = entry.type === "tcgcsv-sealed";
      if (sealedOnly ? sealedGroupFetches >= SEALED_GROUP_FETCH_CAP : groupFetches >= groupFetchCap) break;
      if (sealedOnly) sealedGroupFetches++; else groupFetches++;
      const { records, rarityStats } = await loadEntryRecords(entry, deps, msrp, curatedRiftbound, rejected);
      // The tier aggregate lands once per group per run, with the group's first slice.
      if (recordOffset === 0 && rarityStats.length && entry.type === "tcgcsv") await writeSetRarityStats(db, entry.game, entry.group.name, rarityStats, observedAt, runId);
      const slice = records.slice(recordOffset, recordOffset + remaining);
      const existing = slice.length ? await existingRunRows(db, runId, slice.map(record => record.productId)) : new Map<number, { kind: string; marketCents: number | null }>();
      for (const record of slice) {
        const current = existing.get(record.productId);
        const isCard = "printing" in record;
        if (current) {
          const keepExisting = !isCard || record.marketPrice == null || (current.marketCents != null && record.marketPrice * 100 <= current.marketCents);
          duplicateDecisions++;
          if (keepExisting) continue;
        }
        await persistRecord(db, record, observedAt, asOfDate, runId);
        if (!current) recordsWritten++;
      }
      processed += slice.length;
      if (recordOffset + slice.length >= records.length) { groupIndex++; recordOffset = 0; } else recordOffset += slice.length;
      remaining -= slice.length;
    }
    const done = groupIndex >= workList.length;
    const stats = { totalEntries: workList.length, recordsWritten, duplicateDecisions, rejected };
    if (done) {
      // The truncation guard judges the day by what the database holds for this run, not by
      // the checkpointed counter (R4, 2026-09-05): overlapping ticks clobbered that counter to
      // half the true total, the guard reset a complete walk, and the re-walk — every row
      // already stamped, so nothing "written" — could never satisfy it again.
      const stamped = (await db.prepare("select count(*) as n from catalog_products where ingestion_run_id=?").bind(runId).first<{ n: number }>())?.n ?? 0;
      if (stamped < minimumRecords) {
        // A truncated upstream day must never publish: reset the walk and surface the failure.
        await checkpointIngestion(db, runId, "live-daily-progress", workList.length, recordsWritten, "0:0", stats);
        await failIngestion(db, runId, new Date().toISOString(), `Live snapshot below minimum records: ${stamped} < ${minimumRecords}`);
        throw new Error(`Live snapshot below minimum records: ${stamped} < ${minimumRecords}`);
      }
      await checkpointIngestion(db, runId, "live-daily-progress", workList.length, recordsWritten, `${groupIndex}:${recordOffset}`, stats);
      await completeIngestion(db, runId, "daily-market", new Date().toISOString(), workList.length, stamped, Object.values(rejected).reduce((sum, count) => sum + count, 0), duplicateDecisions, { ...stats, stamped });
      return { runId, cursor: `${groupIndex}:${recordOffset}`, entries: workList.length, entryIndex: groupIndex, done, processed, recordsWritten: stamped, duplicateDecisions };
    }
    await checkpointIngestion(db, runId, "live-daily-progress", workList.length, recordsWritten, `${groupIndex}:${recordOffset}`, stats);
    return { runId, cursor: `${groupIndex}:${recordOffset}`, entries: workList.length, entryIndex: groupIndex, done, processed, recordsWritten, duplicateDecisions };
  } catch (error) {
    // The minimum-records guard already failed the run itself; everything else fails here.
    if (!(error instanceof Error && error.message.startsWith("Live snapshot below minimum records"))) {
      await markIngestionFailed(db, runId, error, "Unknown live ingestion failure");
    }
    throw error;
  }
}
