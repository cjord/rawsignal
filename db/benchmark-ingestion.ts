import type { D1DatabaseLike } from "./repository.ts";

// Daily S&P 500 benchmark (user decision 2026-08-28): Alpha Vantage's SPY daily series as
// the S&P proxy — labeled as such everywhere it renders. One request per day (compact =
// ~100 trading days) against a 25/day free-tier allowance; rows land in
// market_daily_metrics as the 'benchmark:sp500' series so charts read it like any other.

export const BENCHMARK_SERIES = "benchmark:sp500";
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function parseAlphaVantageDaily(payload: unknown): { date: string; closeCents: number }[] {
  const series = (payload as Record<string, unknown>)?.["Time Series (Daily)"];
  if (!series || typeof series !== "object") return [];
  const rows: { date: string; closeCents: number }[] = [];
  for (const [date, values] of Object.entries(series as Record<string, Record<string, string>>)) {
    const close = Number(values?.["4. close"]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(close) && close > 0) rows.push({ date, closeCents: Math.round(close * 100) });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function runBenchmarkIngestion(db: D1DatabaseLike, apiKey: string, fetcher: FetchLike = fetch) {
  const response = await fetcher(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=SPY&outputsize=compact&apikey=${apiKey}`);
  if (!response.ok) throw new Error(`Alpha Vantage request failed: ${response.status}`);
  const payload = await response.json();
  const rows = parseAlphaVantageDaily(payload);
  // Rate-limit and error responses arrive as 200s with a Note/Information body — report,
  // never write garbage.
  if (!rows.length) {
    const note = (payload as Record<string, unknown>)?.Note ?? (payload as Record<string, unknown>)?.Information ?? "empty response";
    return { series: BENCHMARK_SERIES, rows: 0, note: String(note), done: false };
  }
  for (const row of rows) {
    await db.prepare(`insert into market_daily_metrics (series, observed_date, value_cents, members) values (?,?,?,1)
      on conflict(series, observed_date) do update set value_cents=excluded.value_cents`).bind(BENCHMARK_SERIES, row.date, row.closeCents).run();
  }
  return { series: BENCHMARK_SERIES, rows: rows.length, note: null, done: true };
}
