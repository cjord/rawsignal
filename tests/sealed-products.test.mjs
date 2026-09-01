import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {isJapaneseSealedProduct, isOnePieceSealedProduct, isPokemonSealedProduct, normalizeJapaneseProductType, normalizeOnePieceProductType, normalizeProductType, normalizedProductKey} from "../core/sealed-product-utils.ts";
import {normalizeJapaneseSealedProduct, normalizeOnePieceSealedProduct} from "../core/normalize/sealed.ts";

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

test("Japanese sealed detection and taxonomy join the Pokémon vocabulary", () => {
  assert.equal(normalizeJapaneseProductType("Eevee Heroes Booster Box"), "Booster Boxes");
  assert.equal(normalizeJapaneseProductType("Shiny Treasure ex Booster Pack"), "Booster Packs");
  // "Starter Set" is the JP starter-deck naming — English rules alone would bucket it Other.
  assert.equal(normalizeJapaneseProductType("Ceruledge ex Stellar Tera Type Starter Set"), "Starter / Theme Decks");
  assert.equal(normalizeJapaneseProductType("VStar Premium Trainer Box"), "Boxes / Bundles");
  assert.equal(isJapaneseSealedProduct({categoryId: 85, name: "Eevee Heroes Booster Box", extendedData: []}), true);
  // Singles (even rarity-less JP promos with a Number) and accessories stay out.
  assert.equal(isJapaneseSealedProduct({categoryId: 85, name: "Victini - 288/SV-P", extendedData: [{name: "Number", value: "288/SV-P"}]}), false);
  assert.equal(isJapaneseSealedProduct({categoryId: 85, name: "Eevee Heroes Deck Case", extendedData: []}), false);
  assert.equal(isJapaneseSealedProduct({categoryId: 3, name: "Surging Sparks Booster Box", extendedData: []}), false);
  const box = normalizeJapaneseSealedProduct({productId: 565351, name: "Eevee Heroes Booster Box", imageUrl: "", url: "https://example.com/jp", extendedData: []}, {name: "S6a: Eevee Heroes", publishedOn: "2021-05-28T00:00:00Z"}, {marketPrice: 480, subTypeName: "Normal"});
  // Joins the English Pokémon sealed catalog; JP MSRPs are yen-denominated → honest null.
  assert.deepEqual({game: box.game, category: box.category, marketPrice: box.marketPrice, msrp: box.msrp, profit: box.profit}, {game: "pokemon", category: "Booster Boxes", marketPrice: 480, msrp: null, profit: null});
});

test("normalizes One Piece sealed product types onto the canonical buckets", () => {
  assert.equal(normalizeOnePieceProductType("The Dominance of God Booster Box"), "Booster Boxes");
  assert.equal(normalizeOnePieceProductType("The Dominance of God Booster Box Case"), "Cases");
  assert.equal(normalizeOnePieceProductType("Double Pack Set Vol. 13 Display"), "Cases");
  assert.equal(normalizeOnePieceProductType("The Dominance of God Sleeved Booster Pack"), "Booster Packs");
  assert.equal(normalizeOnePieceProductType("Set Sail Deck Set"), "Starter / Theme Decks");
  assert.equal(normalizeOnePieceProductType("Starter Deck 31: RED Monkey.D.Luffy"), "Starter / Theme Decks");
  assert.equal(normalizeOnePieceProductType("Double Pack Set Vol. 12"), "Boxes / Bundles");
  assert.equal(normalizeOnePieceProductType("One Piece Tin Pack Set Vol. 2 -Sabo-"), "Tins");
  assert.equal(normalizeOnePieceProductType("One Piece Card Game Illustration Box Vol. 1"), "Collections");
  assert.equal(normalizeOnePieceProductType("Devil Fruits Collection Vol. 1"), "Collections");
});

test("One Piece sealed detection excludes singles, accessories, and other categories", () => {
  assert.equal(isOnePieceSealedProduct({categoryId: 68, name: "Carrying On His Will Booster Box", extendedData: []}), true);
  // Singles carry Number/Rarity extendedData — the promo card must stay out.
  assert.equal(isOnePieceSealedProduct({categoryId: 68, name: "Monkey.D.Luffy (PSA Magazine)", extendedData: [{name: "Number", value: "OP05-060"}]}), false);
  assert.equal(isOnePieceSealedProduct({categoryId: 68, name: "One Piece Card Game Official Card Sleeves", extendedData: []}), false);
  assert.equal(isOnePieceSealedProduct({categoryId: 3, name: "Surging Sparks Booster Box", extendedData: []}), false);
});

test("One Piece sealed normalization applies verified Bandai MSRPs and honest nulls", () => {
  const group = {name: "The Time of Battle", publishedOn: "2026-01-01T00:00:00Z"};
  // 689341 is in the verified table (migrated from the retired curated feed).
  const verified = normalizeOnePieceSealedProduct({productId: 689341, name: "The Time of Battle Booster Pack", imageUrl: "https://example.com/x_200w.jpg", url: "https://example.com/x", extendedData: []}, group, {marketPrice: 6.56, subTypeName: "Normal"});
  assert.deepEqual({game: verified.game, category: verified.category, msrp: verified.msrp, msrpSource: verified.msrpSource, profit: verified.profit}, {game: "onepiece", category: "Booster Packs", msrp: 4.99, msrpSource: "Bandai published MSRP", profit: 1.57});
  const unknown = normalizeOnePieceSealedProduct({productId: 628352, name: "Carrying On His Will Booster Box", imageUrl: "", url: "", extendedData: []}, group, {marketPrice: 120, subTypeName: "Normal"});
  assert.deepEqual({msrp: unknown.msrp, msrpSource: unknown.msrpSource, profit: unknown.profit}, {msrp: null, msrpSource: null, profit: null});
  assert.equal(normalizeOnePieceSealedProduct({productId: 1, name: "Otama (Parallel)", extendedData: [{name: "Rarity", value: "SR"}]}, group, null), null);
});

test("generated One Piece sealed feed is validated, sealed-only, and nullable", async () => {
  const products = JSON.parse(await readFile(new URL("../public/data/sealed-onepiece.json", import.meta.url), "utf8"));
  assert.ok(products.length > 100);
  assert.equal(new Set(products.map(item => item.productId)).size, products.length);
  assert.ok(products.every(item => item.game === "onepiece"));
  assert.ok(products.some(item => item.msrp === null));
  assert.ok(products.some(item => item.msrp != null && item.msrpSource === "Bandai published MSRP"));
  assert.ok(products.every(item => item.profit == null || item.msrp != null && item.marketPrice != null));
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
