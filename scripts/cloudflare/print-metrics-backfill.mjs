// Prints the SQL that backfills metric series from stored observations, for running against
// a database whose Worker has no ops adapter (production). Usage:
//   node scripts/cloudflare/print-metrics-backfill.mjs [--series key1,key2] > backfill.sql
//   npx wrangler d1 execute DB --remote --file backfill.sql --config <config>
// Each series is deleted first: a backfill recomputes qualification from scratch.
import { METRIC_SERIES, metricsBackfillStatements } from "../../db/metrics-ingestion.ts";

const args = process.argv.slice(2);
const index = args.indexOf("--series");
const keys = index >= 0 ? new Set(args[index + 1]?.split(",").map(value => value.trim()).filter(Boolean)) : null;
const series = keys ? METRIC_SERIES.filter(def => keys.has(def.key)) : METRIC_SERIES;
if (keys && series.length !== keys.size) {
  const known = new Set(series.map(def => def.key));
  throw new Error(`Unknown series: ${[...keys].filter(key => !known.has(key)).join(", ")}`);
}
console.log(metricsBackfillStatements(series).map(statement => `${statement};`).join("\n"));
