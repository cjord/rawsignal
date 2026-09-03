import assert from "node:assert/strict";
import test from "node:test";
import { historyTargetKey, loadPriceHistoryBatch } from "../app/data/usePriceHistoryBatch.ts";

// The client loader: one batch request per page of rows, single-product requests only for
// what the batch route had no stored series for, and a degraded path when the batch fails.

const history = (price) => ({ points: [{ date: "2026-08-01", price }, { date: "2026-08-31", price: price * 1.1 }], coverage: "exact", variant: "Holofoil", condition: "Near Mint" });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function fakeFetch(handlers) {
  const calls = [];
  const fetcher = async (url) => { calls.push(String(url)); for (const [pattern, handler] of handlers) if (pattern.test(String(url))) return handler(String(url)); return json({ error: "no route" }, 404); };
  return { fetcher, calls };
}

test("a page of rows is one batch request; misses fall back to the single-product route", async () => {
  const { fetcher, calls } = fakeFetch([
    [/\/api\/history\/batch\?t=/, url => { const t = decodeURIComponent(new URL(url, "https://x").searchParams.get("t")); assert.equal(t, "1:Holofoil,2:Holofoil,3:Normal:s"); return json({ histories: { "single:1:holofoil": history(10), "single:2:holofoil": null, "sealed:3:normal": history(50) } }); }],
    [/\/api\/history\?productId=2/, () => json(history(20))],
  ]);
  const targets = [{ productId: 1, printing: "Holofoil" }, { productId: 2, printing: "Holofoil" }, { productId: 3, printing: "Normal", sealed: true }];
  const entries = await loadPriceHistoryBatch(targets, new AbortController().signal, fetcher);
  assert.deepEqual(calls.map(url => url.split("?")[0]), ["/api/history/batch", "/api/history"]);
  assert.deepEqual(entries.map(e => [historyTargetKey(e.target), e.failed, e.history.points[0]?.price]), [["single:1:holofoil", false, 10], ["single:2:holofoil", false, 20], ["sealed:3:normal", false, 50]]);
  // Derived metrics are attached client-side exactly as for single responses.
  assert.equal(typeof entries[0].history.change30, "number");
});

test("a failed batch degrades to single-product requests; a single target skips the batch entirely", async () => {
  const degraded = fakeFetch([
    [/\/api\/history\/batch/, () => json({ error: "down" }, 503)],
    [/\/api\/history\?productId=(\d+)/, url => json(history(Number(url.match(/productId=(\d+)/)[1])))],
  ]);
  const entries = await loadPriceHistoryBatch([{ productId: 4, printing: "Normal" }, { productId: 5, printing: "Normal" }], new AbortController().signal, degraded.fetcher);
  assert.deepEqual(entries.map(e => e.history.points[0].price), [4, 5]);
  assert.equal(degraded.calls.filter(url => url.startsWith("/api/history/batch")).length, 1);

  const one = fakeFetch([[/\/api\/history\?productId=9/, () => json(history(9))]]);
  await loadPriceHistoryBatch([{ productId: 9, printing: "Normal" }], new AbortController().signal, one.fetcher);
  assert.deepEqual(one.calls.map(url => url.split("?")[0]), ["/api/history"]);
});

test("a single-route failure marks that entry failed without failing the page", async () => {
  const { fetcher } = fakeFetch([
    [/\/api\/history\/batch/, () => json({ histories: { "single:1:normal": null, "single:2:normal": history(2) } })],
    [/\/api\/history\?productId=1/, () => json({ error: "History unavailable" }, 502)],
  ]);
  const entries = await loadPriceHistoryBatch([{ productId: 1, printing: "Normal" }, { productId: 2, printing: "Normal" }], new AbortController().signal, fetcher);
  assert.deepEqual(entries.map(e => e.failed), [true, false]);
  assert.equal(entries[0].history.coverage, "none");
});
