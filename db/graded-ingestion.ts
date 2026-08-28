import type { GradedCardData } from "../app/domain/types.ts";
import { completeIngestion, failIngestion, startIngestion, type D1DatabaseLike } from "./repository.ts";

// One PokemonPriceTracker card lookup costs 2 credits; the free tier grants 100/day. The
// rotation refreshes the stalest slice of the top-value Pokémon singles each day, preferring
// cards never fetched, and stops early when the API reports its daily budget nearly spent.
export type GradedFetchResult = { status: number; creditsConsumed: number | null; dailyRemaining: number | null; payload: unknown };
export type GradedRotationDeps = {
  fetchCard(productId: number): Promise<GradedFetchResult>;
  wait?(ms: number): Promise<void>;
};

const money = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
const count = (value: unknown) => Number.isInteger(value) && (value as number) >= 0 ? value as number : null;

export function compactGrades(salesByGrade: unknown): GradedCardData["grades"] {
  const grades: GradedCardData["grades"] = {};
  if (typeof salesByGrade !== "object" || salesByGrade === null) return grades;
  for (const [key, stat] of Object.entries(salesByGrade as Record<string, unknown>)) {
    if (typeof stat !== "object" || stat === null) continue;
    const record = stat as Record<string, unknown>;
    const sales = count(record.count);
    if (!sales) continue;
    const smart = (record.smartMarketPrice ?? {}) as Record<string, unknown>;
    grades[key] = {
      count: sales,
      average: money(record.averagePrice),
      median: money(record.medianPrice),
      smartPrice: money(smart.price),
      confidence: typeof smart.confidence === "string" ? smart.confidence : null,
      trend: record.marketTrend === "up" || record.marketTrend === "down" ? record.marketTrend : null,
      lastSaleDate: typeof record.lastSaleDate === "string" ? record.lastSaleDate.slice(0, 10) : null,
    };
  }
  return grades;
}

type PoolRow = { productId: number; updatedAt: string | null };

export async function runGradedRotationBatch(db: D1DatabaseLike, deps: GradedRotationDeps, options: { budget?: number; poolSize?: number; now?: Date } = {}) {
  const budget = Math.max(2, Math.min(100, options.budget ?? 90));
  // Research (audit Phase F): grading premiums matter for roughly the top 500-1,000 cards
  // by raw value. 600 keeps every card's refresh inside ~two weeks at 45 fetches/day.
  const poolSize = Math.max(1, Math.min(1000, options.poolSize ?? 600));
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
    await failIngestion(db, runId, new Date().toISOString(), error instanceof Error ? error.message : "Unknown graded rotation failure");
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
