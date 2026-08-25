import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createTcgcsvClient } from "../scripts/clients/tcgcsv.mjs";
import { publishCatalogSnapshot } from "../scripts/io/last-good.mjs";
import { normalizeSinglesGroup } from "../scripts/normalize/singles.mjs";
import { ingestionManifest, validateCatalogSnapshot } from "../scripts/validate/catalog.mjs";

const product = { productId: 101, name: "Pikachu", imageUrl: "https://example.com/p_200w.jpg", url: "https://example.com/p", extendedData: [{ name: "Rarity", value: "Illustration Rare" }, { name: "Number", value: "101/100" }] };
const group = { groupId: 1, name: "Fixture Set", publishedOn: "2026-01-01T00:00:00Z" };
const price = { productId: 101, marketPrice: 12, lowPrice: 10, midPrice: 13, highPrice: 15, subTypeName: "Holofoil" };

test("TCGCSV client retries and rejects malformed collections", async () => {
  let calls = 0;
  const client = createTcgcsvClient({ throttleMs: 0, wait: async () => {}, fetcher: async () => {
    calls++;
    if (calls === 1) return new Response("unavailable", { status: 503 });
    return Response.json({ results: [group] });
  } });
  assert.deepEqual(await client.groups(3), [group]);
  assert.equal(calls, 2);
  const malformed = createTcgcsvClient({ throttleMs: 0, fetcher: async () => Response.json({ results: {} }) });
  await assert.rejects(() => malformed.groups(3), /Invalid TCGCSV collection/);
});

test("normalization is deterministic and reports rejected records", () => {
  const input = { game: "pokemon", group, products: [product, { ...product, productId: 102, extendedData: [] }], prices: [price], previous: new Map([["pokemon:101", 10]]) };
  const first = normalizeSinglesGroup(input), second = normalizeSinglesGroup(input);
  assert.deepEqual(first, second);
  assert.equal(first.cards[0].section, "illustration-rares");
  assert.equal(first.cards[0].priceChange, 2);
  assert.equal(first.rejected["missing-market-price"], 1);
});

test("validation rejects duplicate identities and last-good output survives malformed input", async () => {
  const card = { game: "pokemon", section: "illustration-rares", productId: 101, name: "Pikachu", set: "Fixture Set", marketPrice: 12, lowPrice: 10, midPrice: 13, highPrice: 15 };
  assert.throws(() => validateCatalogSnapshot({ cards: [card, card] }), /duplicate/i);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "raw-signal-ingestion-")), target = path.join(directory, "feed.json");
  await fs.writeFile(target, "last-good");
  await assert.rejects(() => publishCatalogSnapshot({ cards: [] }, { [target]: "bad" }, { validation: { minimumRecords: 1 } }), /minimum/);
  assert.equal(await fs.readFile(target, "utf8"), "last-good");
  const body=JSON.stringify([card]);await publishCatalogSnapshot({cards:[card]},{[target]:body});const first=await fs.readFile(target);
  await publishCatalogSnapshot({cards:[card]},{[target]:body});assert.deepEqual(await fs.readFile(target),first);
  await fs.rm(directory, { recursive: true, force: true });
});

test("ingestion manifest records provenance and rejection decisions", () => {
  const manifest = ingestionManifest({ source: "fixture", sourceUpdatedAt: "2026-08-25", generatedAt: "2026-08-25T12:00:00Z", counts: { records: 1 }, rejected: { unsupported: 2 }, duplicateDecisions: [{ key: "x" }] });
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.rejected.unsupported, 2);
  assert.equal(manifest.duplicateDecisions.length, 1);
});
