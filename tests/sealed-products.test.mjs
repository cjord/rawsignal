import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {isPokemonSealedProduct, normalizeProductType, normalizedProductKey} from "../core/sealed-product-utils.ts";

test("normalizes common Pokémon sealed product types", () => {
  assert.equal(normalizeProductType("151 Booster Bundle"), "Booster Bundles");
  assert.equal(normalizeProductType("Surging Sparks Booster Box"), "Booster Boxes");
  assert.equal(normalizeProductType("Charizard ex League Battle Deck"), "Starter / Theme Decks");
  assert.equal(normalizeProductType("Stellar Crown Build & Battle Box"), "Build & Battle");
  assert.equal(normalizeProductType("Mega Evolution Enhanced Booster Case"), "Cases");
  assert.equal(normalizeProductType("Surging Sparks Booster Box Case"), "Cases");
  assert.equal(normalizeProductType("Celebrations Ultra-Premium Collection Case"), "Cases");
  assert.equal(normalizeProductType("151 Booster Bundle Display"), "Cases");
  assert.equal(normalizeProductType("Ascended Heroes Booster Bundle Display"), "Cases");
  assert.equal(normalizeProductType("Detective Pikachu: Charizard GX Special Case File"), "Collections");
  assert.equal(normalizeProductType("Pokemon TCG: Back to School Pencil Case 2024"), "Collections");
});

test("rejects cards and products from other markets", () => {
  assert.equal(isPokemonSealedProduct({categoryId: 3, name: "Attack of the Vine! Booster Box", extendedData: []}, {name: "Miscellaneous"}), false);
  assert.equal(isPokemonSealedProduct({categoryId: 89, name: "Spiritforged Booster Box", extendedData: []}, {name: "Riftbound"}), false);
  assert.equal(isPokemonSealedProduct({categoryId: 3, name: "Iron Bundle", extendedData: [{name: "Rarity", value: "Rare"}]}, {name: "Paradox Rift"}), false);
});

test("preserves meaningful release variants in duplicate keys", () => {
  assert.notEqual(normalizedProductKey({name: "Poke Ball Tin (Q4 2024)"}, "Miscellaneous"), normalizedProductKey({name: "Poke Ball Tin (Q4 2025)"}, "Miscellaneous"));
});

test("generated Pokémon sealed feed is validated and nullable", async () => {
  const products = JSON.parse(await readFile(new URL("../public/data/sealed-pokemon.json", import.meta.url), "utf8"));
  assert.ok(products.length > 118);
  assert.equal(new Set(products.map(item => item.productId)).size, products.length);
  assert.ok(products.every(item => item.game === "pokemon" && item.category !== "Other"));
  assert.ok(products.every(item => !/lorcana|attack of the vine|one[ -]?piece|riftbound/i.test(`${item.name} ${item.set}`)));
  assert.ok(products.some(item => item.msrp === null));
  assert.ok(products.some(item => item.marketPrice === null));
  assert.ok(products.every(item => item.profit == null || item.msrp != null && item.marketPrice != null));
});
