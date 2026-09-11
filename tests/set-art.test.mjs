import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import { curatedSetArtFor } from "../app/data/curated-set-art.ts";

const expected = new Map([
  ["Origins", "origins.webp"],
  ["Origins: Proving Grounds", "origins.webp"],
  ["Spiritforged", "spiritforged.webp"],
  ["Unleashed", "unleashed.webp"],
  ["Vendetta", "vendetta.webp"],
  ["Lunar Revel 2026", "lunar-revel-2026.webp"],
  ["Secret Garden", "secret-garden.webp"],
  ["T1 2025 Worlds Champion Collection", "t1-2025-worlds.webp"],
]);

test("curated Riftbound set art resolves to self-hosted assets", async () => {
  for (const [set, filename] of expected) {
    const art = curatedSetArtFor("riftbound", set);
    assert.equal(art?.logo, `/images/set-art/riftbound/${filename}`);
    await access(new URL(`../public${art.logo}`, import.meta.url));
  }
  assert.equal(curatedSetArtFor("pokemon", "Origins"), null);
  assert.equal(curatedSetArtFor("riftbound", "Unknown Set"), null);
});
