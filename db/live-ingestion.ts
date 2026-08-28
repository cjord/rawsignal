import type { Card, SealedProduct } from "../app/domain/types.ts";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- shared pure normalization stays in the .mjs modules the local sync scripts use
import { normalizeSinglesGroup } from "../scripts/normalize/singles.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { normalizePokemonSealedProduct, preferredSealedPrice, sealedIdentity } from "../scripts/normalize/sealed.mjs";
import { persistRecord } from "./daily-ingestion.ts";
import { checkpointIngestion, completeIngestion, failIngestion, readRefreshCursor, startIngestion, type D1DatabaseLike } from "./repository.ts";

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
  // Riftbound and One Piece sealed have no upstream sync — the bundled curated feeds ride
  // along as pseudo-groups so every catalog row stays stamped with the current run.
  loadBundledSealed(market: "riftbound" | "onepiece"): Promise<SealedProduct[]>;
};

type WorkEntry = { type: "tcgcsv"; categoryId: number; game: "pokemon" | "riftbound"; group: TcgcsvGroup } | { type: "bundled"; market: "riftbound" | "onepiece" };
type LiveStats = { recordsWritten?: number; duplicateDecisions?: number; rejected?: Record<string, number> };

const categories = [{ id: 3, game: "pokemon" as const }, { id: 89, game: "riftbound" as const }];
const parseStats = (value: string | null | undefined): LiveStats => { try { return value ? JSON.parse(value) as LiveStats : {}; } catch { return {}; } };
const parseCursor = (value: string | null | undefined) => { const match = /^(\d+):(\d+)$/.exec(value ?? ""); return match ? { group: Number(match[1]), offset: Number(match[2]) } : { group: 0, offset: 0 }; };

async function buildWorkList(client: TcgcsvClient, now: Date): Promise<WorkEntry[]> {
  const entries: WorkEntry[] = [];
  for (const category of categories) {
    const groups = (await client.groups(category.id)).filter(group => new Date(group.publishedOn) <= now);
    groups.sort((a, b) => a.groupId - b.groupId);
    for (const group of groups) entries.push({ type: "tcgcsv", categoryId: category.id, game: category.game, group });
  }
  entries.push({ type: "bundled", market: "riftbound" }, { type: "bundled", market: "onepiece" });
  return entries;
}

async function loadEntryRecords(entry: WorkEntry, deps: LiveSyncDeps, msrp: () => Promise<Map<number, unknown>>, rejected: Record<string, number>): Promise<(Card | SealedProduct)[]> {
  if (entry.type === "bundled") return deps.loadBundledSealed(entry.market);
  const [products, prices] = await Promise.all([deps.client.products(entry.categoryId, entry.group.groupId), deps.client.prices(entry.categoryId, entry.group.groupId)]);
  const normalized = normalizeSinglesGroup({ game: entry.game, group: entry.group, products, prices }) as { cards: Card[]; rejected: Record<string, number> };
  for (const [reason, count] of Object.entries(normalized.rejected)) rejected[reason] = (rejected[reason] ?? 0) + count;
  const records: (Card | SealedProduct)[] = [...normalized.cards].sort((a, b) => a.productId - b.productId);
  if (entry.game === "pokemon") {
    const msrpById = await msrp();
    const pricesByProduct = new Map<number, Record<string, unknown>[]>();
    for (const row of prices) { const id = Number(row.productId); const rows = pricesByProduct.get(id) ?? []; rows.push(row); pricesByProduct.set(id, rows); }
    const sealed: SealedProduct[] = [], seenIdentity = new Set<string>();
    for (const product of products) {
      const normalizedSealed = normalizePokemonSealedProduct(product, entry.group, preferredSealedPrice(pricesByProduct.get(Number(product.productId))), msrpById.get(Number(product.productId))) as SealedProduct | null;
      if (!normalizedSealed) continue;
      const identity = sealedIdentity(product, entry.group) as string;
      if (seenIdentity.has(identity)) continue;
      seenIdentity.add(identity);
      sealed.push(normalizedSealed);
    }
    records.push(...sealed.sort((a, b) => a.productId - b.productId));
  }
  return records;
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
  const budgetTotal = Math.max(1, Math.min(100, Math.floor(options.batchSize ?? 80)));
  const groupFetchCap = Math.max(1, Math.min(20, options.groupFetchCap ?? 12));
  const minimumRecords = options.minimumRecords ?? 10000;
  const now = options.now ?? new Date(), observedAt = now.toISOString(), asOfDate = observedAt.slice(0, 10);
  const runId = `live-daily:${options.sourceUpdatedAt.slice(0, 10)}`;
  const checkpoint = await readRefreshCursor(db, "live-daily-progress");
  const resumed = checkpoint?.ingestionRunId === runId;
  let { group: groupIndex, offset: recordOffset } = resumed ? parseCursor(checkpoint?.cursor) : { group: 0, offset: 0 };
  const prior = resumed ? parseStats(checkpoint?.statsJson) : {};
  let recordsWritten = prior.recordsWritten ?? 0, duplicateDecisions = prior.duplicateDecisions ?? 0;
  const rejected: Record<string, number> = { ...(prior.rejected ?? {}) };
  if (!resumed) await startIngestion(db, runId, "tcgcsv-live", observedAt, { sourceUpdatedAt: options.sourceUpdatedAt, stats: { rejected: {} } });
  let msrpPromise: Promise<Map<number, unknown>> | null = null;
  const msrp = () => msrpPromise ??= deps.fetchMsrp();
  try {
    const workList = await buildWorkList(deps.client, now);
    let remaining = budgetTotal, groupFetches = 0, processed = 0;
    while (remaining > 0 && groupIndex < workList.length && groupFetches < groupFetchCap) {
      const entry = workList[groupIndex];
      groupFetches++;
      const records = await loadEntryRecords(entry, deps, msrp, rejected);
      const slice = records.slice(recordOffset, recordOffset + remaining);
      const existing = slice.length ? await existingRunRows(db, runId, slice.map(record => record.productId)) : new Map<number, { kind: string; marketCents: number | null }>();
      for (const record of slice) {
        const current = existing.get(record.productId);
        const isCard = "printing" in record;
        if (current) {
          const keepExisting = !isCard || current.marketCents == null || (record as Card).marketPrice * 100 <= current.marketCents;
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
    if (done && recordsWritten < minimumRecords) {
      // A truncated upstream day must never publish: reset the walk and surface the failure.
      await checkpointIngestion(db, runId, "live-daily-progress", workList.length, recordsWritten, "0:0", stats);
      await failIngestion(db, runId, new Date().toISOString(), `Live snapshot below minimum records: ${recordsWritten} < ${minimumRecords}`);
      throw new Error(`Live snapshot below minimum records: ${recordsWritten} < ${minimumRecords}`);
    }
    await checkpointIngestion(db, runId, "live-daily-progress", workList.length, recordsWritten, `${groupIndex}:${recordOffset}`, stats);
    if (done) await completeIngestion(db, runId, "daily-market", new Date().toISOString(), workList.length, recordsWritten, Object.values(rejected).reduce((sum, count) => sum + count, 0), duplicateDecisions, stats);
    return { runId, cursor: `${groupIndex}:${recordOffset}`, entries: workList.length, entryIndex: groupIndex, done, processed, recordsWritten, duplicateDecisions };
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith("Live snapshot below minimum records"))) {
      await failIngestion(db, runId, new Date().toISOString(), error instanceof Error ? error.message : "Unknown live ingestion failure");
    }
    throw error;
  }
}
