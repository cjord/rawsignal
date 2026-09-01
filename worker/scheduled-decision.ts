export type ScheduledAction = "live" | "details" | "graded" | "metrics" | "history" | "idle";

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
// - Metrics rollup: once per day, only after that day's live run completed — no fresh
//   observations means nothing to roll up.
// - History: the cron CONTINUES any checkpointed, uncompleted run first (operator
//   backfills keep the `history-backfill:` key). Once per day, after that day's live run
//   and metrics rollup completed, it also STARTS a tier-scheduled refresh (todo M4,
//   `history-daily:` key) over the due slice of the live catalog (todo M5) — a completed
//   run of either kind dated today satisfies the day.
export function decideScheduledAction(input: {
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
  metricsTodayRunId: string;
  historyCheckpointRunId: string | null;
  historyPublishedRunId: string | null;
  historyTodayRunId: string;
}): ScheduledAction {
  const liveTodayCompleted = input.livePublishedRunId === input.liveTodayRunId;
  if (!liveTodayCompleted && input.probeUpdatedAt != null && input.probeUpdatedAt !== input.livePublishedUpdatedAt) return "live";
  const detailsIngested = input.detailsPublishedUpdatedAt === input.deploySnapshotUpdatedAt;
  const detailsTodayCompleted = input.detailsPublishedRunId === input.detailsTodayRunId;
  if (!detailsIngested && !detailsTodayCompleted) return "details";
  if (input.gradedKeyConfigured && input.gradedPublishedRunId !== input.gradedTodayRunId) return "graded";
  if (liveTodayCompleted && input.metricsPublishedRunId !== input.metricsTodayRunId) return "metrics";
  if (input.historyCheckpointRunId && input.historyCheckpointRunId !== input.historyPublishedRunId) return "history";
  // Daily tiered refresh (M4): starts only after today's live + metrics landed; any
  // completed history run dated today — tiered or a full operator backfill — counts.
  const historyDate = input.historyTodayRunId.slice(input.historyTodayRunId.indexOf(":") + 1);
  const historyDoneToday = input.historyPublishedRunId?.endsWith(`:${historyDate}`) ?? false;
  const metricsTodayCompleted = input.metricsPublishedRunId === input.metricsTodayRunId;
  if (liveTodayCompleted && metricsTodayCompleted && !historyDoneToday) return "history";
  return "idle";
}
