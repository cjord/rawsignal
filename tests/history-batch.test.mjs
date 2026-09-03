import assert from "node:assert/strict";
import test from "node:test";
import { HISTORY_BATCH_LIMIT, chunkHistoryTargets, encodeHistoryTargets, historyBatchKey, parseHistoryTargets } from "../core/history-batch.ts";

test("history batch targets round-trip through the wire format, printings with spaces and slashes included", () => {
  const targets = [
    { productId: 664881, printing: "Holofoil" },
    { productId: 12, printing: "1st Edition Holofoil" },
    { productId: 99, printing: "Reverse/Holo" },
    { productId: 500, printing: "Normal", sealed: true },
  ];
  const encoded = encodeHistoryTargets(targets);
  assert.equal(encoded, "664881:Holofoil,12:1st%20Edition%20Holofoil,99:Reverse%2FHolo,500:Normal:s");
  assert.deepEqual(parseHistoryTargets(encoded), targets);
  assert.equal(historyBatchKey(targets[3]), "sealed:500:normal");
  assert.equal(historyBatchKey(targets[0]), "single:664881:holofoil");
});

test("malformed, empty, oversized, or duplicate lists are handled", () => {
  assert.equal(parseHistoryTargets(null), null);
  assert.equal(parseHistoryTargets(""), null);
  assert.equal(parseHistoryTargets("abc:Holofoil"), null);
  assert.equal(parseHistoryTargets("1:Holo:x"), null);
  assert.equal(parseHistoryTargets("1:%E0%A4%A"), null);
  const many = Array.from({ length: HISTORY_BATCH_LIMIT + 1 }, (_, i) => ({ productId: i + 1, printing: "Normal" }));
  assert.equal(parseHistoryTargets(encodeHistoryTargets(many)), null);
  assert.deepEqual(parseHistoryTargets("7:Holofoil,7:holofoil,7:Holofoil"), [{ productId: 7, printing: "Holofoil" }]);
});

test("chunking preserves order and fills each request to the limit", () => {
  const items = Array.from({ length: 95 }, (_, i) => i);
  const chunks = chunkHistoryTargets(items);
  assert.deepEqual(chunks.map(chunk => chunk.length), [40, 40, 15]);
  assert.deepEqual(chunks.flat(), items);
  assert.deepEqual(chunkHistoryTargets([]), []);
});
