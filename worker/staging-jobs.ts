import { parseCards, parseSealedProducts } from "../app/domain/contracts.ts";
import type { Card, SealedProduct } from "../app/domain/types.ts";
import { fetchTcgplayerHistory } from "../app/data/tcgplayer-history-client.ts";
import { allowedRarities } from "../app/state/market-query.ts";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- shared clients stay in the .mjs modules the local sync scripts use
import { createTcgcsvClient } from "../scripts/clients/tcgcsv.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { fetchJson } from "../scripts/clients/http-json.mjs";
import { runDailyMarketIngestionBatch, type DailyCatalogSnapshot } from "../db/daily-ingestion.ts";
import { runDetailIngestionBatch } from "../db/detail-ingestion.ts";
import { runGradedRotationBatch, type GradedRotationDeps } from "../db/graded-ingestion.ts";
import { runHistoryBackfillBatch, type HistoryBackfillTarget } from "../db/history-backfill.ts";
import { runLiveDailyIngestionBatch, type LiveSyncDeps, type TcgcsvClient } from "../db/live-ingestion.ts";
import type { D1DatabaseLike } from "../db/repository.ts";

const probeUserAgent = "RawSignal/7.0 (+validated daily market ingestion)";

// TCGCSV publishes ~20:00 UTC daily; the probe timestamp is the live snapshot's identity.
export async function probeTcgcsvUpdatedAt(fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher("https://tcgcsv.com/last-updated.txt", { headers: { "User-Agent": probeUserAgent } });
  if (!response.ok) throw new Error(`TCGCSV last-updated probe failed: ${response.status}`);
  return (await response.text()).trim();
}

export function liveSyncDeps(request: Request, assets: AssetsBinding): LiveSyncDeps {
  return {
    client: createTcgcsvClient() as TcgcsvClient,
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

async function load<T>(request: Request, assets: AssetsBinding, filename: string, parse: (value: unknown) => T[]) {
  const response = await assets.fetch(new Request(new URL(`/data/${filename}`, request.url), { headers: { Accept: "application/json" } }));
  if (!response.ok) throw new Error(`Staging source ${filename} unavailable: ${response.status}`);
  return parse(await response.json());
}

async function loadAsset(request: Request, assets: AssetsBinding, path: string): Promise<unknown> {
  const response = await assets.fetch(new Request(new URL(path, request.url), { headers: { Accept: "application/json" } }));
  if (!response.ok) throw new Error(`Staging source ${path} unavailable: ${response.status}`);
  return response.json();
}

// The detail manifest maps `${kind}:${productId}` to its enrichment chunk; the sorted unique
// chunk list is the detail-ingestion cursor space (stable for a given deploy).
export async function loadDetailChunkPaths(request: Request, assets: AssetsBinding): Promise<string[]> {
  const manifest = await loadAsset(request, assets, "/data/detail-manifest.json") as Record<string, string>;
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
      const result = await runLiveDailyIngestionBatch(env.DB, liveSyncDeps(request, env.ASSETS), { sourceUpdatedAt: probed, batchSize: requested });
      return json({ job: "live", result });
    }
    if (input.job === "graded") {
      if (!env.POKEMONPRICETRACKER_API_KEY) return json({ error: "Graded rotation key is not configured" }, 503);
      const budget = typeof input.batchSize === "number" ? input.batchSize : 90;
      const result = await runGradedRotationBatch(env.DB, gradedRotationDeps(env.POKEMONPRICETRACKER_API_KEY), { budget });
      return json({ job: "graded", result });
    }
    if (input.job === "details") {
      const requested = typeof input.batchSize === "number" ? input.batchSize : 4;
      const chunkPaths = await loadDetailChunkPaths(request, env.ASSETS);
      const result = await runDetailIngestionBatch(env.DB, chunkPaths, path => loadAsset(request, env.ASSETS, path), { batchSize: requested, sourceUpdatedAt });
      return json({ job: "details", result });
    }
    const snapshot = await loadStagingSnapshot(request, env.ASSETS, sourceUpdatedAt);
    if (input.job === "daily") {
      const requested = typeof input.batchSize === "number" ? input.batchSize : 50;
      const batchSize = Math.max(1, Math.min(maxDailyBatchSize, Math.floor(requested)));
      return json({ job: "daily", result: await runDailyMarketIngestionBatch(env.DB, snapshot, { batchSize }) });
    }
    if (input.job === "history") {
      const requested = typeof input.batchSize === "number" ? input.batchSize : 10;
      // 60 targets × ~2 external fetches stays under the paid plan's 1000-subrequest limit;
      // the binding-call budget (~12 D1 ops per target) is the tighter ceiling.
      const batchSize = Math.max(1, Math.min(60, Math.floor(requested)));
      const targets = historyTargets(snapshot);
      const result = await runHistoryBackfillBatch(env.DB, targets, target => fetchTcgplayerHistory(target.productId, target.printing, Boolean(target.sealed)), {
        batchSize,
        sourceUpdatedAt: snapshot.sourceUpdatedAt,
      });
      return json({ job: "history", result });
    }
    return json({ error: "Job must be live, daily, history, details, or graded" }, 400);
  } catch (error) {
    console.error(JSON.stringify({ event: "staging_job_failed", job: input.job, message: error instanceof Error ? error.message : "Unknown failure" }));
    return json({ error: "Staging job failed" }, 500);
  }
}
