export type ScheduledAction = "live" | "details" | "graded" | "history" | "idle";

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
// - History: the cron only CONTINUES a backfill that an operator started via the staging
//   adapter (checkpoint exists, run not completed); it never starts one on its own.
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
  historyCheckpointRunId: string | null;
  historyPublishedRunId: string | null;
}): ScheduledAction {
  const liveTodayCompleted = input.livePublishedRunId === input.liveTodayRunId;
  if (!liveTodayCompleted && input.probeUpdatedAt != null && input.probeUpdatedAt !== input.livePublishedUpdatedAt) return "live";
  const detailsIngested = input.detailsPublishedUpdatedAt === input.deploySnapshotUpdatedAt;
  const detailsTodayCompleted = input.detailsPublishedRunId === input.detailsTodayRunId;
  if (!detailsIngested && !detailsTodayCompleted) return "details";
  if (input.gradedKeyConfigured && input.gradedPublishedRunId !== input.gradedTodayRunId) return "graded";
  if (input.historyCheckpointRunId && input.historyCheckpointRunId !== input.historyPublishedRunId) return "history";
  return "idle";
}
