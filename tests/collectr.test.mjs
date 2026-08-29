import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cardNumberKey, normalizeCollectrCsv, normalizeCollectrHandle, normalizeCollectrProducts, parseCsv, parseShowcaseHtml, parseShowcasePage, pickCsvMatch } from "../core/collectr.ts";

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

test("parseCsv handles quotes, escapes, CRLF, and BOM", () => {
  const rows = parseCsv('﻿Name,Set,Qty\r\n"Pikachu, V","Sword ""&"" Shield",2\nCharizard,Base Set,1\r\n\r\n');
  assert.deepEqual(rows, [
    ["Name", "Set", "Qty"],
    ['Pikachu, V', 'Sword "&" Shield', "2"],
    ["Charizard", "Base Set", "1"],
  ]);
});

test("normalizeCollectrCsv maps tolerant headers and skips graded/sealed rows", () => {
  const csv = [
    "Product Name,Set Name,Card Number,Rarity,Condition,Printing,Quantity,Market Price,Category,Grading Company,TCGplayer Id,Product Type",
    'Charmander,EX Dragon,"98/97",Secret Rare,Near Mint,Holofoil,1,"$120.50",Pokémon,Raw,84208,Single',
    "Ahri,Spiritforged,227/221,Epic,Lightly Played,Normal,2,10,Riftbound,,664881,Card",
    "Graded Pika,Base Set,58/102,Rare,Near Mint,Normal,1,300,Pokemon,PSA,12345,Single",
    "Booster Box,Evolving Skies,,,,,1,400,Pokemon,,,Sealed Product",
    "No Id Card,Surging Sparks,238/191,Special Illustration Rare,Near Mint,Normal,1,55,Pokemon,,,Single",
  ].join("\r\n");
  const result = normalizeCollectrCsv(csv);
  assert.ok(!("error" in result), `unexpected error: ${"error" in result ? result.error : ""}`);
  assert.equal(result.cards.length, 3);
  assert.equal(result.skippedGraded, 1);
  assert.equal(result.skippedSealed, 1);
  assert.equal(result.hasIds, true);
  const charmander = result.cards[0];
  assert.deepEqual(
    { id: charmander.productId, game: charmander.game, set: charmander.set, price: charmander.collectrPrice, printing: charmander.printing },
    { id: 84208, game: "pokemon", set: "EX Dragon", price: 120.5, printing: "Holofoil" },
  );
  const ahri = result.cards[1];
  assert.deepEqual({ id: ahri.productId, game: ahri.game, qty: ahri.quantity }, { id: 664881, game: "riftbound", qty: 2 });
  // Id-less rows get synthetic negative ids for later name resolution.
  assert.ok(result.cards[2].productId < 0);
  assert.equal(result.cards[2].name, "No Id Card");
});

test("normalizeCollectrCsv rejects unrecognizable layouts with the found headers", () => {
  const result = normalizeCollectrCsv("Foo,Bar\n1,2");
  assert.ok("error" in result);
  assert.match(result.error, /Foo, Bar/);
  assert.ok("error" in normalizeCollectrCsv(""));
});

test("browser fetch worker keeps its WAF-safe contract", async () => {
  const source = await readFile(new URL("../workers/collectr-fetch/src/index.mjs", import.meta.url), "utf8");
  assert.match(source, /const PAGE_SIZE = 30;/, "the showcase API 401s on limits above 30 — keep the page size");
  assert.match(source, /`Bearer \$\{env\.IMPORT_TOKEN\}`/, "the worker must stay token-gated (it is an open WAF relay otherwise)");
  assert.match(source, /api-v2\.getcollectr\.com/);
});

test("csv match disambiguation prefers number, then set, and refuses ambiguity", () => {
  assert.equal(cardNumberKey("058/189"), "58/189");
  assert.equal(cardNumberKey("TG12/TG30"), "tg12/tg30");
  assert.equal(cardNumberKey(" 4 "), "4");
  const candidates = [
    { productId: 1, number: "58/102", set: "Base Set" },
    { productId: 2, number: "58/189", set: "Darkness Ablaze" },
  ];
  assert.equal(pickCsvMatch({ number: "058/102", set: "" }, candidates)?.productId, 1);
  // A bare numerator agrees with either denominator form — still needs the set to decide.
  assert.equal(pickCsvMatch({ number: "58", set: "Base Set" }, candidates)?.productId, 1);
  assert.equal(pickCsvMatch({ number: "", set: "Darkness Ablaze" }, candidates)?.productId, 2);
  assert.equal(pickCsvMatch({ number: "", set: "" }, candidates), null);
  assert.equal(pickCsvMatch({ number: "7/102", set: "" }, [candidates[0]])?.productId, 1);
  assert.equal(pickCsvMatch({ number: "1/1", set: "" }, []), null);
});
