import type { GradedCardData } from "../core/domain/types.ts";
import { clampBatchSize, markIngestionFailed } from "./ingestion-batch.ts";
import { completeIngestion, startIngestion, type D1DatabaseLike } from "./repository.ts";

// One PokemonPriceTracker card lookup costs 2 credits; the free tier grants 100/day. The
// rotation refreshes the stalest slice of the top-value Pokémon singles each day, preferring
// cards never fetched, and stops early when the API reports its daily budget nearly spent.
export type GradedFetchResult = { status: number; creditsConsumed: number | null; dailyRemaining: number | null; payload: unknown };
export type GradedRotationDeps = {
  fetchCard(productId: number): Promise<GradedFetchResult>;
  wait?(ms: number): Promise<void>;
};

// The compaction lives in core/graded.ts (shared with scripts/graded/sync-graded.mjs);
// re-exported here for existing consumers.
import { compactGrades } from "../core/graded.ts";
export { compactGrades };

type PoolRow = { productId: number; updatedAt: string | null };

export async function runGradedRotationBatch(db: D1DatabaseLike, deps: GradedRotationDeps, options: { budget?: number; poolSize?: number; now?: Date } = {}) {
  const budget = clampBatchSize(options.budget, 90, 100, 2);
  // Research (audit Phase F): grading premiums matter for roughly the top 500-1,000 cards
  // by raw value. 600 keeps every card's refresh inside ~two weeks at 45 fetches/day.
  const poolSize = clampBatchSize(options.poolSize, 600, 1000);
  const now = options.now ?? new Date(), startedAt = now.toISOString(), today = startedAt.slice(0, 10);
  const runId = `graded-rotation:${today}`;
  const wait = deps.wait ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  await startIngestion(db, runId, "pokemonpricetracker", startedAt, { stats: { budget } });
  try {
    // Stalest first (never-fetched sorts ahead), then the higher market price.
    const pool = (await db.prepare(`select p.product_id as productId,g.updated_at as updatedAt
      from catalog_products p join current_prices cp on cp.product_id=p.product_id
      left join graded_prices g on g.product_id=p.product_id
      where p.kind='single' and p.game='pokemon' and cp.market_cents is not null
      order by cp.market_cents desc limit ?`).bind(poolSize).all<PoolRow>()).results ?? [];
    pool.sort((a, b) => (a.updatedAt ?? "").localeCompare(b.updatedAt ?? "") || 0);
    const targets = pool.slice(0, Math.floor(budget / 2));
    let spent = 0, updated = 0, consecutiveFailures = 0, stopped: string | null = null;
    for (const target of targets) {
      const result = await deps.fetchCard(target.productId);
      if (result.status === 429) { stopped = "rate-limited"; break; }
      if (result.status < 200 || result.status >= 300) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3 && updated === 0) throw new Error(`Graded rotation failing: HTTP ${result.status} after ${consecutiveFailures} attempts`);
        if (consecutiveFailures >= 5) { stopped = `http-${result.status}`; break; }
        continue;
      }
      consecutiveFailures = 0;
      spent += result.creditsConsumed ?? 2;
      const payload = result.payload as { data?: { ebay?: { salesByGrade?: unknown } } } | null;
      const grades = compactGrades(payload?.data?.ebay?.salesByGrade);
      if (Object.keys(grades).length) {
        await db.prepare(`insert into graded_prices (product_id,grades_json,updated_at) values (?,?,?)
          on conflict(product_id) do update set grades_json=excluded.grades_json,updated_at=excluded.updated_at`)
          .bind(target.productId, JSON.stringify(grades), today).run();
        updated++;
      }
      if (result.dailyRemaining != null && result.dailyRemaining < 2) { stopped = "budget-exhausted"; break; }
      await wait(1100);
    }
    const stats = { budget, targets: targets.length, updated, spent, stopped };
    await completeIngestion(db, runId, "graded-rotation", new Date().toISOString(), targets.length, updated, 0, 0, stats);
    return { runId, targets: targets.length, updated, spent, stopped, done: true };
  } catch (error) {
    await markIngestionFailed(db, runId, error, "Unknown graded rotation failure");
    throw error;
  }
}

export async function readGradedCard(db: D1DatabaseLike, productId: number): Promise<GradedCardData | null> {
  const row = await db.prepare("select grades_json as gradesJson,updated_at as updatedAt from graded_prices where product_id=?").bind(productId).first<{ gradesJson: string; updatedAt: string }>();
  if (!row) return null;
  try {
    const grades = JSON.parse(row.gradesJson) as GradedCardData["grades"];
    return Object.keys(grades).length ? { updatedAt: row.updatedAt, grades } : null;
  } catch { return null; }
}
