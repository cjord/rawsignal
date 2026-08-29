import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeCollectrHandle, normalizeCollectrProducts, parseShowcaseHtml, parseShowcasePage } from "../core/collectr.ts";

// The fixture is a trimmed capture of the real @9wocep showcase page (2026-08-29): the
// RSC push chunk holding the dehydrated getShowcaseProfile query — profile header plus
// the first 30 products, exactly as app.getcollectr.com serves them.
const fixture = () => readFile(new URL("./fixtures/collectr-showcase.html", import.meta.url), "utf8");

test("parses the dehydrated showcase payload out of real page HTML", async () => {
  const parsed = parseShowcaseHtml(await fixture());
  assert.ok(parsed, "parser returned null on the captured page");
  assert.equal(parsed.profile.handle, "9wocep");
  assert.equal(parsed.profile.name, "Anonymous Collectr");
  assert.equal(parsed.profile.totalCards, 147);
  assert.equal(parsed.profile.totalGraded, 5);
  assert.equal(parsed.profile.totalSealed, 0);
  assert.ok(parsed.profile.collectrValue > 4000 && parsed.profile.collectrValue < 6000);
  assert.equal(parsed.raw.length, 30);
  // The SSR payload marks raw cards grade_id "52"; four of these thirty carry real
  // grades ("8"/"9") and must fall out of a raw-singles import.
  const { cards, skippedGraded } = normalizeCollectrProducts(parsed.raw);
  assert.equal(skippedGraded, 4);
  assert.equal(cards.length, 26);
  assert.ok(cards.every(card => card.condition != null && card.printing != null), "SSR records carry condition and printing");
  const ahri = cards.find(card => card.productId === 664881);
  assert.ok(ahri, "Ahri (Overnumbered) missing — TCGplayer id join broken");
  assert.deepEqual({ game: ahri.game, set: ahri.set, number: ahri.number }, { game: "riftbound", set: "Spiritforged", number: "227/221" });
  const charmander = cards.find(card => card.productId === 84208);
  assert.deepEqual({ game: charmander.game, set: charmander.set, rarity: charmander.rarity }, { game: "pokemon", set: "EX Dragon", rarity: "Secret Rare" });
  assert.ok(charmander.collectrPrice > 100);
});

test("normalization drops graded and sealed records and tolerates junk", () => {
  const { cards, skippedGraded, skippedSealed } = normalizeCollectrProducts([
    { product_id: "100", catalog_category_name: "Pokemon", product_name: "Keeper", catalog_group: "Base Set", quantity: "2", market_price: "12.5", grade_id: "52" },
    { product_id: "101", catalog_category_name: "Pokemon", product_name: "SSR graded", grade_id: "9" },
    { product_id: "104", catalog_category_name: "Pokemon", product_name: "API graded", grade_id: null, grade_company: "9" },
    { product_id: "102", catalog_category_name: "Pokemon", product_name: "Sealed Box", is_card: false },
    { product_id: "not-a-number", catalog_category_name: "Pokemon", product_name: "Junk" },
    { product_id: "103", catalog_category_name: "One Piece Card Game", product_name: "Unsupported Game" },
  ]);
  assert.equal(cards.length, 2);
  assert.deepEqual({ id: cards[0].productId, qty: cards[0].quantity, price: cards[0].collectrPrice }, { id: 100, qty: 2, price: 12.5 });
  assert.equal(cards[1].game, null);
  assert.equal(skippedGraded, 2);
  assert.equal(skippedSealed, 1);
});

test("parses direct API pages and normalizes handles", () => {
  const { profile, raw } = parseShowcasePage({ user: "Someone", handle: "abc", total_cards: "3", total_sealed: "0", total_graded: "1", portfolio_value: [{ price: "99.5" }], products: [{ product_id: "5" }] });
  assert.deepEqual({ name: profile.name, cards: profile.totalCards, value: profile.collectrValue, raw: raw.length }, { name: "Someone", cards: 3, value: 99.5, raw: 1 });
  assert.equal(normalizeCollectrHandle("@9wocep"), "9wocep");
  assert.equal(normalizeCollectrHandle("https://app.getcollectr.com/showcase/profile/@9wocep"), "9wocep");
  assert.equal(normalizeCollectrHandle("  9Wocep  "), "9wocep");
  assert.equal(normalizeCollectrHandle("not a handle!!"), null);
  assert.equal(normalizeCollectrHandle(""), null);
});
