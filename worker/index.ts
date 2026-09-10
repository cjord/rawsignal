/** Cloudflare Worker entry point for Raw Signal. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleLiveFeed } from "./live-feeds.ts";
import { runScheduledIngestionTick } from "./scheduled-ingestion.ts";
import { edgeCacheClass, edgeCacheableRequest, withEdgeCache } from "./edge-cache.ts";
import { pageCacheSignature } from "./page-signature.ts";
import type { D1DatabaseLike } from "../db/repository.ts";
import { handleStagingJob, type StagingJobEnv } from "./staging-jobs.ts";
import { EBAY_ACCOUNT_DELETION_PATH, handleEbayAccountDeletion, type EbayAccountDeletionEnv } from "./ebay-account-deletion.ts";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ENVIRONMENT?: string;
  STAGING_JOB_TOKEN?: string;
  POKEMONPRICETRACKER_API_KEY?: string;
  EBAY_CLIENT_ID?: string;
  EBAY_CLIENT_SECRET?: string;
  EBAY_DELETION_VERIFICATION_TOKEN?: string;
  EBAY_DELETION_ENDPOINT_URL?: string;
  EBAY_EPN_CAMPAIGN_ID?: string;
  CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // eBay must reach this compliance callback without vinext routing or the colo cache.
    // GET proves endpoint ownership; POST verifies eBay's signed deletion notification.
    if (url.pathname === EBAY_ACCOUNT_DELETION_PATH) {
      return handleEbayAccountDeletion(request, env as EbayAccountDeletionEnv);
    }

    const stagingJob = await handleStagingJob(request, env);
    if (stagingJob) return stagingJob;

    if (url.pathname.startsWith("/data/")) {
      const liveFeed = await withEdgeCache(request, ctx, async () => (await handleLiveFeed(request, env as unknown as StagingJobEnv)) ?? new Response(null, { status: 404 }));
      if (liveFeed.status !== 404) return liveFeed;
      // run_worker_first routes /data/* through here, so non-intercepted paths (detail
      // chunks, manifests, configs) are served from the static assets explicitly. Worker-only
      // paths with no asset behind them (freshness) 404 quietly instead of erroring — the
      // dev-workerd environment has no ASSETS binding on this code path at all.
      if (!env.ASSETS?.fetch) return new Response(null, { status: 404 });
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    // API routes ride the colo cache for the lifetime their own Cache-Control declares (review
    // §14 F7); the public D1-heavy pages (sets, card and sealed detail, metrics) are keyed by the
    // published runs and the deployed version, so an entry lives until the next publish or deploy
    // (review §15: a crawler over the product long tail costs one render per URL per colo per day).
    if (edgeCacheableRequest(request)) {
      const signature = edgeCacheClass(request) === "page" ? await pageCacheSignature(env.DB as unknown as D1DatabaseLike | undefined, env.CF_VERSION_METADATA?.id ?? "dev") : "";
      return withEdgeCache(request, ctx, () => handler.fetch(request, env, ctx), undefined, signature);
    }
    return handler.fetch(request, env, ctx);
  },

  // Guard cron (docs/todo.md G1): each tick advances at most one checkpointed ingestion
  // batch and no-ops when nothing is due. Config controls whether a trigger exists at all —
  // scripts/cloudflare/prepare-deployment.mjs only emits crons for staging, on request.
  async scheduled(controller: { scheduledTime: number; cron: string }, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduledIngestionTick(env as unknown as StagingJobEnv)
      .then(result => console.log(JSON.stringify({ event: "scheduled_tick", cron: controller.cron, ...result })))
      .catch(error => console.error(JSON.stringify({ event: "scheduled_tick_failed", cron: controller.cron, message: error instanceof Error ? error.message : "Unknown failure" }))));
  },
};

export default worker;
