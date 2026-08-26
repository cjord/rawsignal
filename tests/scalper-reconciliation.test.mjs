import test from "node:test";
import assert from "node:assert/strict";
import { parseScalperLine, parseScalperWatchlist, scalperEntryCategoryHint, watchlistCategoryHints } from "../scripts/scalper/watchlist.mjs";
import { reconcileScalperEntry, scoreScalperCandidate } from "../scripts/scalper/matcher.mjs";

test("parses optional MSRP overrides without inventing missing prices", () => {
  assert.equal(parseScalperLine("Perfect Order Booster Box $185", 1).msrpOverride, 185);
  assert.equal(parseScalperLine("Phantasmal Evolutions 3-Pack Blister", 2).msrpOverride, null);
  assert.equal(parseScalperLine("One Piece Card Game: OP-16 Booster Pack $4.99?", 3).msrpUnverified, true);
  assert.equal(parseScalperLine("Mega Charizard Tin 3", 4).msrpOverride, null);
  assert.equal(parseScalperLine("151 Booster Bundle 29.99", 5).msrpOverride, 29.99);
  assert.equal(parseScalperWatchlist("A\n\nB").length, 2);
  assert.deepEqual(parseScalperWatchlist("A\n\nB").map(entry => entry.lineNumber), [1, 3]);
});

test("normalizes common source shorthand and isolates matches to the intended TCG category", () => {
  const entry = parseScalperLine("Phantasmal Evolutions Booster Box", 1);
  assert.match(entry.normalizedQuery, /^phantasmal flames/);
  assert.equal(scalperEntryCategoryHint(entry), "pokemon");
  assert.equal(reconcileScalperEntry(entry, [
    { productId: 1, name: "Phantasmal Flames Booster Box", set: "Phantasmal Flames", categoryName: "Pokemon" },
    { productId: 2, name: "Phantasmal Flames Booster Box", set: "Phantasmal Flames", categoryName: "YuGiOh" },
  ]).candidates[0].candidate.productId, 1);
});

test("detects all represented TCG categories instead of binding Scalper view to one game", () => {
  const entries = parseScalperWatchlist("Pokemon ETB\nOne Piece Illustration Box\nYu-Gi-Oh! Booster Box\nLorcana Trove\nRiftbound Vault\nTopps Football Box");
  assert.deepEqual(watchlistCategoryHints(entries), ["pokemon", "one piece", "riftbound", "yu-gi-oh", "lorcana", "football"]);
});

test("penalizes materially different sealed variants", () => {
  const entry = parseScalperLine("151 Booster Bundle", 1);
  const bundle = { name: "Scarlet & Violet—151 Booster Bundle", set: "151" };
  const caseProduct = { name: "Scarlet & Violet—151 Booster Bundle Display", set: "151" };
  assert.ok(scoreScalperCandidate(entry, bundle) > scoreScalperCandidate(entry, caseProduct));
});

test("keeps equally plausible variants ambiguous for human confirmation", () => {
  const entry = parseScalperLine("Mega Evolution Elite Trainer Box", 1);
  const result = reconcileScalperEntry(entry, [
    { productId: 1, name: "Mega Evolution Elite Trainer Box - Lucario", set: "Mega Evolution" },
    { productId: 2, name: "Mega Evolution Elite Trainer Box - Gardevoir", set: "Mega Evolution" },
  ]);
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(result.candidates.map(item => item.candidate.productId), [1, 2]);
});

test("returns unmatched rather than generating a synthetic product", () => {
  const result = reconcileScalperEntry(parseScalperLine("Canon PowerShot G7 X Mark III", 1), [
    { productId: 1, name: "Pokemon Booster Box", set: "Pokemon" },
  ]);
  assert.equal(result.status, "unmatched");
  assert.deepEqual(result.candidates, []);
});
