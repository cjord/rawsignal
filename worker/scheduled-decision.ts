export type ScheduledAction = "daily" | "details" | "history" | "idle";

// Guard-cron policy (docs/todo.md G1, approved 2026-08-27): every tick advances at most one
// checkpointed batch, and only when work is genuinely due.
// - Daily catalog: due only while BOTH hold — the deployed feed snapshot has not been fully
//   ingested (each deploy is observed exactly once; identical feeds are never re-observed on
//   later days, which would fabricate flat history) AND today's date-keyed run is not already
//   complete (the batch runner cannot advance a finished run, so a same-day redeploy waits
//   for the midnight re-key instead of spinning no-op completions until then).
// - Details: follow the same once-per-snapshot rule, but only after the snapshot's catalog
//   ingestion completed — product_details rows carry a foreign key to catalog_products.
// - History: the cron only CONTINUES a backfill that an operator started via the staging
//   adapter (checkpoint exists, run not completed); it never starts one on its own.
export function decideScheduledAction(input: {
  snapshotUpdatedAt: string;
  dailyPublishedUpdatedAt: string | null;
  dailyPublishedRunId: string | null;
  dailyTodayRunId: string;
  detailsPublishedUpdatedAt: string | null;
  detailsPublishedRunId: string | null;
  detailsTodayRunId: string;
  historyCheckpointRunId: string | null;
  historyPublishedRunId: string | null;
}): ScheduledAction {
  const snapshotIngested = input.dailyPublishedUpdatedAt === input.snapshotUpdatedAt;
  const todayRunCompleted = input.dailyPublishedRunId === input.dailyTodayRunId;
  if (!snapshotIngested && !todayRunCompleted) return "daily";
  const detailsIngested = input.detailsPublishedUpdatedAt === input.snapshotUpdatedAt;
  const detailsTodayCompleted = input.detailsPublishedRunId === input.detailsTodayRunId;
  if (snapshotIngested && !detailsIngested && !detailsTodayCompleted) return "details";
  if (input.historyCheckpointRunId && input.historyCheckpointRunId !== input.historyPublishedRunId) return "history";
  return "idle";
}
