import { failIngestion, readRefreshCursor, type D1DatabaseLike } from "./repository.ts";

// Shared plumbing for the checkpointed batch runners (daily, live, history, details,
// graded). The runners' loops deliberately stay separate — integer cursors, chunk
// cursors, and the live group:offset budget walk are genuinely different machines —
// but stats parsing, size clamping, resume reads, and the failure tail are one
// implementation instead of five.

export const parseStatsJson = <S>(value: string | null | undefined): Partial<S> => {
  try { return value ? JSON.parse(value) as Partial<S> : {}; } catch { return {}; }
};

// A non-finite request (NaN from a malformed body, Infinity) takes the fallback rather than
// leaking NaN through Math.min/Math.max into the slice bounds.
export const clampBatchSize = (requested: number | undefined, fallback: number, max: number, min = 1) =>
  Math.max(min, Math.min(max, Math.floor(Number.isFinite(requested) ? (requested as number) : fallback)));

// Returns the durable cursor only when it belongs to this run — a checkpoint left by an
// older run means "start fresh".
export async function resumeCheckpoint(db: D1DatabaseLike, key: string, runId: string) {
  const checkpoint = await readRefreshCursor(db, key);
  const resumed = checkpoint?.ingestionRunId === runId;
  return {
    resumed,
    cursor: resumed ? checkpoint?.cursor ?? null : null,
    statsJson: resumed ? checkpoint?.statsJson ?? null : null,
  };
}

// The uniform failure tail: record the failure against the run, caller rethrows.
export async function markIngestionFailed(db: D1DatabaseLike, runId: string, error: unknown, fallbackMessage: string) {
  await failIngestion(db, runId, new Date().toISOString(), error instanceof Error ? error.message : fallbackMessage);
}
