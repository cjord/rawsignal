import assert from "node:assert/strict";
import test from "node:test";
import { PUBLISH_KEYS, SIGNATURE_TTL_MS, fallbackSignature, pageCacheSignature, readPublishSignature } from "../worker/page-signature.ts";

// A fake D1 answering the refresh_state read; `rows` can change between calls and `fail`
// makes the read throw, so the memo and the fallback are exercised without a database.
function fakeDb(rows, options = {}) {
  const db = { prepared: 0, rows, fail: options.fail ?? false };
  db.prepare = () => ({ bind: (...keys) => ({ async all() { db.prepared++; if (db.fail) throw new Error("D1 unavailable"); assert.deepEqual(keys, [...PUBLISH_KEYS]); return { results: db.rows }; } }) });
  return db;
}
const published = (key, runId, at) => ({ key, runId, at });
const rows = [published("daily-market", "live-daily:2026-09-03", "2026-09-04T00:30:51Z"), published("metrics-rollup", "metrics-rollup:2026-09-03", "2026-09-04T04:33:00Z")];

test("the signature names the version and every published run", async () => {
  const db = fakeDb(rows);
  assert.equal(await readPublishSignature(db), "daily-market=live-daily:2026-09-03@2026-09-04T00:30:51Z;metrics-rollup=metrics-rollup:2026-09-03@2026-09-04T04:33:00Z");
  assert.equal(await pageCacheSignature(db, "v1", 1_000_000), "v1|daily-market=live-daily:2026-09-03@2026-09-04T00:30:51Z;metrics-rollup=metrics-rollup:2026-09-03@2026-09-04T04:33:00Z");
  // A new deploy or a new publish is a new signature.
  assert.notEqual(await pageCacheSignature(fakeDb(rows), "v2", 1_000_000), await pageCacheSignature(fakeDb(rows), "v1", 1_000_000));
  const later = [rows[0], published("metrics-rollup", "metrics-rollup:2026-09-04", "2026-09-05T04:30:00Z")];
  assert.notEqual(await pageCacheSignature(fakeDb(later), "v1", 1_000_000), await pageCacheSignature(fakeDb(rows), "v1", 1_000_000));
});

test("the read is memoized per database for a minute, then refreshed", async () => {
  const db = fakeDb(rows);
  const first = await pageCacheSignature(db, "v1", 1_000_000);
  assert.equal(await pageCacheSignature(db, "v1", 1_000_000 + SIGNATURE_TTL_MS - 1), first);
  assert.equal(db.prepared, 1);
  db.rows = [rows[0]];
  const refreshed = await pageCacheSignature(db, "v1", 1_000_000 + SIGNATURE_TTL_MS);
  assert.equal(db.prepared, 2);
  assert.notEqual(refreshed, first);
});

test("without a database, or when the read fails, the signature is a ten-minute bucket and is not memoized", async () => {
  assert.equal(await pageCacheSignature(undefined, "v1", 1_800_000), fallbackSignature("v1", 1_800_000));
  assert.equal(fallbackSignature("v1", 1_800_000), "v1|t3");
  assert.equal(fallbackSignature("v1", 2_399_999), "v1|t3");
  assert.equal(fallbackSignature("v1", 2_400_000), "v1|t4");
  const db = fakeDb(rows, { fail: true });
  assert.equal(await pageCacheSignature(db, "v1", 1_800_000), "v1|t3");
  db.fail = false;
  // The failure was not kept: the next call reads again and gets the real signature.
  assert.match(await pageCacheSignature(db, "v1", 1_800_001), /^v1\|daily-market=/);
  assert.equal(db.prepared, 2);
});
