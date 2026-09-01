import { parseCards, parseSealedProducts } from "../core/domain/contracts.ts";
import type { Card, SealedProduct } from "../core/domain/types.ts";
import { fetchTcgplayerHistory } from "../app/data/tcgplayer-history-client.ts";
import { allowedRarities } from "../core/market-state.ts";
import { createTcgcsvClient } from "../core/clients/tcgcsv.ts";
import { fetchJson, fetchText } from "../core/clients/http-json.ts";
import { runDailyMarketIngestionBatch, type DailyCatalogSnapshot } from "../db/daily-ingestion.ts";
import { runDetailIngestionBatch } from "../db/detail-ingestion.ts";
import { runGradedRotationBatch, type GradedRotationDeps } from "../db/graded-ingestion.ts";
import { runHistoryBackfillBatch, type HistoryBackfillTarget } from "../db/history-backfill.ts";
import { dueHistoryTargets, readHistoryTargetRows } from "../db/history-targets.ts";
import { runLiveDailyIngestionBatch, type LiveSyncDeps, type TcgcsvClient } from "../db/live-ingestion.ts";
import { runBenchmarkIngestion } from "../db/benchmark-ingestion.ts";
import { runMetricsRollup } from "../db/metrics-ingestion.ts";
import type { D1DatabaseLike } from "../db/repository.ts";

const probeUserAgent = "RawSignal/7.0 (+validated daily market ingestion)";

// TCGCSV publishes ~20:00 UTC daily; the probe timestamp is the live snapshot's identity.
// Rides the shared retry policy (decision D8) like every other external fetch.
export async function probeTcgcsvUpdatedAt(fetcher: typeof fetch = fetch): Promise<string> {
  return (await fetchText("https://tcgcsv.com/last-updated.txt", { fetcher, headers: { "User-Agent": probeUserAgent } })).trim();
}

export function liveSyncDeps(request: Request, assets: AssetsBinding): LiveSyncDeps {
  return {
    // Wire boundary: the generic TCGCSV rows narrow to the ingestion's group/product
    // shapes here; the normalizers re-validate every field they read.
    client: createTcgcsvClient() as unknown as TcgcsvClient,
    async fetchMsrp() {
      const tracker = await fetchJson("https://tcg-price-tracker.shizukaziye.workers.dev/data/data.json", { headers: { "User-Agent": "RawSignal/7.0" } }) as { items?: Record<string, unknown>[] };
      return new Map((tracker.items ?? []).filter(item => item.matched && Number(item.msrp) > 0).map(item => [Number(item.productId ?? item.id), item]));
    },
    loadBundledSealed: market => load(request, assets, `sealed-${market}.json`, parseSealedProducts) as Promise<SealedProduct[]>,
  };
}

type AssetsBinding = { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
export type StagingJobEnv = {
  ASSETS: AssetsBinding;
  DB: D1DatabaseLike;
  ENVIRONMENT?: string;
  STAGING_JOB_TOKEN?: string;
  POKEMONPRICETRACKER_API_KEY?: string;
  ALPHAVANTAGE_API_KEY?: string;
  CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
};

export function gradedRotationDeps(apiKey: string): GradedRotationDeps {
  return {
    async fetchCard(productId) {
      const response = await fetch(`https://www.pokemonpricetracker.com/api/v2/cards?tcgPlayerId=${productId}&includeEbay=true`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
      const header = (name: string) => { const value = Number(response.headers.get(name)); return Number.isFinite(value) ? value : null; };
      return {
        status: response.status,
        creditsConsumed: header("x-api-calls-consumed"),
        dailyRemaining: header("x-ratelimit-daily-remaining"),
        payload: response.ok ? await response.json().catch(() => null) : null,
      };
    },
  };
}

const path = "/__ops/staging-jobs";
// A catalog record can issue several D1 operations while refreshing derived metrics.
// Keep the batch below Workers' per-invocation external-operation ceiling.
const maxDailyBatchSize = 80;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

async function equalTokens(left: string, right: string) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let difference = x.length ^ y.length;
  for (let index = 0; index < Math.max(x.length, y.length); index++) difference |= (x[index] ?? 0) ^ (y[index] ?? 0);
  return difference === 0;
}

// One asset reader for the ops adapter and the cron tick; the base URL only routes the
// assets binding by pathname (any host works).
export async function fetchAssetJson(assets: AssetsBinding, path: string, base: string): Promise<unknown> {
  const response = await assets.fetch(new Request(new URL(path, base), { headers: { Accept: "application/json" } }));
  if (!response.ok) throw new Error(`Asset source ${path} unavailable: ${response.status}`);
  return response.json();
}

async function load<T>(request: Request, assets: AssetsBinding, filename: string, parse: (value: unknown) => T[]) {
  return parse(await fetchAssetJson(assets, `/data/${filename}`, request.url));
}

// The detail manifest maps `${kind}:${productId}` to its enrichment chunk; the sorted unique
// chunk list is the detail-ingestion cursor space (stable for a given deploy).
export async function loadDetailChunkPaths(request: Request, assets: AssetsBinding): Promise<string[]> {
  const manifest = await fetchAssetJson(assets, "/data/detail-manifest.json", request.url) as Record<string, string>;
  return [...new Set(Object.values(manifest))].sort();
}

export async function loadStagingSnapshot(request: Request, assets: AssetsBinding, sourceUpdatedAt = new Date().toISOString()): Promise<DailyCatalogSnapshot> {
  const sections = [...new Set([...allowedRarities.pokemon, ...allowedRarities.riftbound])];
  const [cards, sealed] = await Promise.all([
    Promise.all(sections.map(section => load(request, assets, `${section}.json`, parseCards))).then(groups => groups.flat() as Card[]),
    Promise.all(["pokemon", "riftbound", "onepiece"].map(market => load(request, assets, `sealed-${market}.json`, parseSealedProducts))).then(groups => groups.flat() as SealedProduct[]),
  ]);
  return { cards, sealed, source: "bundled-feed", sourceUpdatedAt, schemaVersion: 1 };
}

export function historyTargets(snapshot: DailyCatalogSnapshot): HistoryBackfillTarget[] {
  return [
    ...snapshot.cards.map(card => ({ productId: card.productId, printing: card.printing, currentPrice: card.marketPrice })),
    ...snapshot.sealed.filter(product => product.marketPrice != null).map(product => ({ productId: product.productId, printing: "Sealed", sealed: true, currentPrice: product.marketPrice! })),
  ];
}

// One implementation per job body. The ops adapter and the cron tick share these and
// differ only in authentication, scheduling decisions, batch sizes, and reporting.
export function runLiveJob(env: StagingJobEnv, request: Request, batchSize: number, sourceUpdatedAt: string) {
  return runLiveDailyIngestionBatch(env.DB, liveSyncDeps(request, env.ASSETS), { sourceUpdatedAt, batchSize });
}

export async function runDetailsJob(env: StagingJobEnv, request: Request, batchSize: number, sourceUpdatedAt: string) {
  const chunkPaths = await loadDetailChunkPaths(request, env.ASSETS);
  return runDetailIngestionBatch(env.DB, chunkPaths, path => fetchAssetJson(env.ASSETS, path, request.url), { batchSize, sourceUpdatedAt });
}

// Callers gate on the key's presence (503 in the adapter, the scheduler's decision input).
export function runGradedJob(env: StagingJobEnv, budget: number) {
  return runGradedRotationBatch(env.DB, gradedRotationDeps(env.POKEMONPRICETRACKER_API_KEY!), { budget });
}

export async function runMetricsJob(env: StagingJobEnv, mode: "daily" | "backfill") {
  const result = await runMetricsRollup(env.DB, { mode });
  // The S&P benchmark rides the metrics cadence: one Alpha Vantage call per run, skipped
  // entirely when no key is configured; a failed fetch never fails the rollup.
  const benchmark = env.ALPHAVANTAGE_API_KEY
    ? await runBenchmarkIngestion(env.DB, env.ALPHAVANTAGE_API_KEY).catch(error => ({ series: "benchmark:sp500", rows: 0, note: error instanceof Error ? error.message : "failed", done: false }))
    : null;
  return { ...result, benchmark };
}

export async function runHistoryJob(env: StagingJobEnv, request: Request, batchSize: number, sourceUpdatedAt: string, options: { all?: boolean } = {}) {
  // Targets come from the live catalog, due-filtered by refresh tier (todo M5+M4);
  // operator backfills pass all:true to refresh everything regardless of cadence. The
  // bundled snapshot only backs an empty database (fresh sandbox, tests) — an empty
  // DUE list on a populated catalog is a completed no-op day, not a fallback.
  const rows = await readHistoryTargetRows(env.DB);
  const targets = rows.length
    ? dueHistoryTargets(rows, sourceUpdatedAt, options)
    : historyTargets(await loadStagingSnapshot(request, env.ASSETS, sourceUpdatedAt));
  return runHistoryBackfillBatch(env.DB, targets, target => fetchTcgplayerHistory(target.productId, target.printing, Boolean(target.sealed)), {
    batchSize,
    sourceUpdatedAt,
    runIdPrefix: options.all ? undefined : "history-daily",
  });
}

export async function handleStagingJob(request: Request, env: StagingJobEnv): Promise<Response | null> {
  if (new URL(request.url).pathname !== path) return null;
  if (env.ENVIRONMENT !== "staging") return json({ error: "Not found" }, 404);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.STAGING_JOB_TOKEN) return json({ error: "Staging job token is not configured" }, 503);
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || !await equalTokens(authorization.slice(7), env.STAGING_JOB_TOKEN)) return json({ error: "Unauthorized" }, 401);
  let input: { job?: unknown; batchSize?: unknown };
  try { input = await request.json() as typeof input; }
  catch { return json({ error: "Invalid JSON" }, 400); }
  const sourceUpdatedAt = env.CF_VERSION_METADATA?.timestamp ?? new Date().toISOString();
  try {
    if (input.job === "live") {
      const requested = typeof input.batchSize === "number" ? input.batchSize : 80;
      const probed = await probeTcgcsvUpdatedAt();
      return json({ job: "live", result: await runLiveJob(env, request, requested, probed) });
    }
    if (input.job === "graded") {
      if (!env.POKEMONPRICETRACKER_API_KEY) return json({ error: "Graded rotation key is not configured" }, 503);
      const budget = typeof input.batchSize === "number" ? input.batchSize : 90;
      return json({ job: "graded", result: await runGradedJob(env, budget) });
    }
    if (input.job === "metrics") {
      return json({ job: "metrics", result: await runMetricsJob(env, input.batchSize === 0 ? "daily" : "backfill") });
    }
    if (input.job === "details") {
      const requested = typeof input.batchSize === "number" ? input.batchSize : 4;
      return json({ job: "details", result: await runDetailsJob(env, request, requested, sourceUpdatedAt) });
    }
    if (input.job === "daily") {
      const requested = typeof input.batchSize === "number" ? input.batchSize : 50;
      const batchSize = Math.max(1, Math.min(maxDailyBatchSize, Math.floor(requested)));
      const snapshot = await loadStagingSnapshot(request, env.ASSETS, sourceUpdatedAt);
      return json({ job: "daily", result: await runDailyMarketIngestionBatch(env.DB, snapshot, { batchSize }) });
    }
    if (input.job === "history") {
      const requested = typeof input.batchSize === "number" ? input.batchSize : 10;
      // 60 targets × ~2 external fetches stays under the paid plan's 1000-subrequest limit;
      // the binding-call budget (~12 D1 ops per target) is the tighter ceiling.
      const batchSize = Math.max(1, Math.min(60, Math.floor(requested)));
      // Operator backfills refresh every priced product; the tier cadence applies only
      // to the cron's self-started daily runs.
      return json({ job: "history", result: await runHistoryJob(env, request, batchSize, sourceUpdatedAt, { all: true }) });
    }
    return json({ error: "Job must be live, daily, history, details, graded, or metrics" }, 400);
  } catch (error) {
    console.error(JSON.stringify({ event: "staging_job_failed", job: input.job, message: error instanceof Error ? error.message : "Unknown failure" }));
    return json({ error: "Staging job failed" }, 500);
  }
}
