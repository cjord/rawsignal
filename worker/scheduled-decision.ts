import { ingestionRunId, runIdDate } from "../db/run-id.ts";

export type ScheduledAction = "live" | "details" | "graded" | "metrics" | "history" | "idle";

export type ScheduledInput = {
  probeUpdatedAt: string | null;
  livePublishedUpdatedAt: string | null;
  livePublishedRunId: string | null;
  liveTodayRunId: string;
  deploySnapshotUpdatedAt: string;
  detailsPublishedUpdatedAt: string | null;
  detailsPublishedRunId: string | null;
  detailsTodayRunId: string;
  gradedKeyConfigured: boolean;
  gradedPublishedRunId: string | null;
  gradedTodayRunId: string;
  metricsPublishedRunId: string | null;
  historyCheckpointRunId: string | null;
  historyPublishedRunId: string | null;
};

// What the tick should run, with the values that job needs. The plan carries them so
// the dispatcher never re-derives policy (or asserts non-null) on its own.
export type ScheduledPlan =
  | { action: "idle" }
  | { action: "live"; sourceUpdatedAt: string }
  | { action: "details"; sourceUpdatedAt: string }
  | { action: "graded" }
  | { action: "metrics"; asOfDate: string }
  | { action: "history"; sourceUpdatedAt: string; all: boolean };

// The data day the published live run represents: live runs are keyed by the TCGCSV
// publish date (`live-daily:<date>`) and finish after midnight UTC, so everything that
// follows a live run is keyed to THAT date, never to the wall-clock day of the tick.
// (Until 2026-09-03 the rollup and the daily history refresh were gated on
// `live-daily:<today>`, which was never the published id by the time the run finished —
// neither job ran in production after the 2026-08-28 backfill.)
export const liveRunDate = (livePublishedRunId: string | null) => livePublishedRunId ? runIdDate(livePublishedRunId) : null;
export const metricsRunIdFor = (liveDate: string) => ingestionRunId("metrics-rollup", liveDate);
export const historyRunIdFor = (liveDate: string) => ingestionRunId("history-daily", liveDate);

// Guard-cron policy (docs/todo.md G1): every tick advances at most one checkpointed batch,
// and only when work is genuinely due.
// - Live daily (replaces the bundled-feed daily action, 2026-08-28): the TCGCSV
//   last-updated probe timestamp is the snapshot identity — each upstream publish is
//   ingested exactly once (probe ≠ published source timestamp), and at most one live run
//   completes per day (a same-day re-publish waits for the midnight re-key). The tick skips
//   the probe entirely once today's run is complete; probeUpdatedAt is null on probe failure,
//   which simply retries next tick.
// - Details: bundled enrichment chunks are keyed to the deploy snapshot — ingested once per
//   deploy, at most once per day; the FK filter inside the runner handles catalog drift.
// - Graded rotation: once per day when the PokemonPriceTracker key is configured; the runner
//   spends its own credit budget and stops on the API's rate headers.
// - Metrics rollup: once per published live run, keyed to that run's date — no fresh
//   observations means nothing to roll up.
// - History: the cron CONTINUES any checkpointed, uncompleted run first (operator
//   backfills keep the `history-backfill:` key). After the live run's rollup landed, it
//   also STARTS a tier-scheduled refresh (todo M4, `history-daily:<liveDate>`) over the due
//   slice of the live catalog (todo M5) — a completed run of either kind dated that live
//   day satisfies it.
export function decideScheduledAction(input: ScheduledInput): ScheduledAction {
  const liveTodayCompleted = input.livePublishedRunId === input.liveTodayRunId;
  if (!liveTodayCompleted && input.probeUpdatedAt != null && input.probeUpdatedAt !== input.livePublishedUpdatedAt) return "live";
  const detailsIngested = input.detailsPublishedUpdatedAt === input.deploySnapshotUpdatedAt;
  const detailsTodayCompleted = input.detailsPublishedRunId === input.detailsTodayRunId;
  if (!detailsIngested && !detailsTodayCompleted) return "details";
  if (input.gradedKeyConfigured && input.gradedPublishedRunId !== input.gradedTodayRunId) return "graded";
  const liveDate = liveRunDate(input.livePublishedRunId);
  const metricsForLiveCompleted = liveDate != null && input.metricsPublishedRunId === metricsRunIdFor(liveDate);
  if (liveDate != null && !metricsForLiveCompleted) return "metrics";
  if (input.historyCheckpointRunId && input.historyCheckpointRunId !== input.historyPublishedRunId) return "history";
  // Daily tiered refresh (M4): starts only after the live run's rollup landed; any completed
  // history run dated that live day — tiered or a full operator backfill — counts.
  const historyDoneForLive = liveDate != null && (input.historyPublishedRunId?.endsWith(`:${liveDate}`) ?? false);
  if (liveDate != null && metricsForLiveCompleted && !historyDoneForLive) return "history";
  return "idle";
}

// A history tick continues any checkpointed run under ITS OWN key and target-list mode —
// an operator backfill (`history-backfill:` prefix) rebuilds the full list, the cron's own
// daily run (`history-daily:`) the tier-due list — otherwise it starts the live day's tiered refresh.
function historyPlan(input: ScheduledInput): { sourceUpdatedAt: string; all: boolean } {
  const checkpoint = input.historyCheckpointRunId;
  const continuing = checkpoint != null && checkpoint !== input.historyPublishedRunId;
  if (!continuing) {
    // decideScheduledAction only starts a fresh run with a published live run behind it.
    const liveDate = liveRunDate(input.livePublishedRunId);
    if (liveDate == null) throw new Error("Scheduled history action without a published live run");
    return { sourceUpdatedAt: liveDate, all: false };
  }
  return { sourceUpdatedAt: runIdDate(checkpoint), all: !checkpoint.startsWith("history-daily:") };
}

export function planScheduledAction(input: ScheduledInput): ScheduledPlan {
  const action = decideScheduledAction(input);
  switch (action) {
    case "live":
      // decideScheduledAction only chooses live on a non-null probe; surface a policy
      // regression loudly rather than pass an undefined snapshot identity to the job.
      if (input.probeUpdatedAt == null) throw new Error("Scheduled live action without a probe timestamp");
      return { action, sourceUpdatedAt: input.probeUpdatedAt };
    case "details":
      return { action, sourceUpdatedAt: input.deploySnapshotUpdatedAt };
    case "metrics": {
      const liveDate = liveRunDate(input.livePublishedRunId);
      if (liveDate == null) throw new Error("Scheduled metrics action without a published live run");
      return { action, asOfDate: liveDate };
    }
    case "history":
      return { action, ...historyPlan(input) };
    default:
      return { action };
  }
}
