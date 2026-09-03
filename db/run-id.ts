// Ingestion run ids are `<prefix>:<YYYY-MM-DD>` (e.g. `live-daily:2026-08-28`,
// `history-backfill:2026-08-27`). The prefix names the job family; the date is the
// snapshot day. Every reader and writer of the format goes through these two helpers.

export function ingestionRunId(prefix: string, date: string): string {
  return `${prefix}:${date.slice(0, 10)}`;
}

export function runIdDate(runId: string): string {
  return runId.slice(runId.indexOf(":") + 1);
}
