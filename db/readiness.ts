import { publishedIngestion, type D1DatabaseLike } from "./repository.ts";

// One home for every "is D1 ready to serve this?" definition (decision D6). The gates
// are deliberately different — they protect different data — but they live together so
// nobody invents a fifth. The detail loader's looser bare-marker check is documented at
// its call site (app/data/load-detail.ts): run-pinning is wrong for details.

// The catalog is servable when the published run's records are fully present.
export async function readyCatalogRun(db: D1DatabaseLike) {
  const published = await publishedIngestion(db);
  if (!published) return null;
  const row = await db.prepare("select count(*) as count from catalog_products where ingestion_run_id=?").bind(published.runId).first<{ count: number }>();
  // At least, not exactly: a batch that failed mid-write and was retried stamps its records
  // on the first attempt but counts them as duplicates on the retry. The guard's intent is
  // "no partial catalog", which the completed run plus full coverage already proves.
  return (row?.count ?? 0) >= published.recordsWritten && published.recordsWritten > 0 ? published : null;
}

// Persisted signals are authoritative only when BOTH the catalog run and the independent
// history-signals completion marker exist (architecture.md's reliability boundary).
export async function readySignalHistory(db: D1DatabaseLike) {
  const [catalog, history] = await Promise.all([publishedIngestion(db), publishedIngestion(db, "history-signals")]);
  return catalog && history ? { catalog, history } : null;
}

// Set EV needs live singles data — any completed published catalog run.
export function readySetEv(db: D1DatabaseLike) {
  return publishedIngestion(db);
}
