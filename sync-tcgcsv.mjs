import fs from "node:fs/promises";

const BASE = "https://tcgcsv.com/tcgplayer";
const headers = { "User-Agent": "RawSignal/2.0 (+daily market leaderboard)" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const data = await response.json();
  await sleep(120);
  return data.results ?? [];
}

const ext = (product, key) => product.extendedData?.find((item) => item.name === key)?.value ?? "";
const today = new Date();

async function collectCategory(categoryId, game) {
  const groups = await readJson(`${BASE}/${categoryId}/groups`);
  const eligibleGroups = groups.filter((group) => {
    const published = new Date(group.publishedOn);
    if (published > today) return false;
    if (game === "riftbound") return true;
    return published.getFullYear() <= 2010 || published.getFullYear() >= 2023;
  });

  const cards = [];
  for (const group of eligibleGroups) {
    const [products, prices] = await Promise.all([
      readJson(`${BASE}/${categoryId}/${group.groupId}/products`),
      readJson(`${BASE}/${categoryId}/${group.groupId}/prices`),
    ]);
    const pricesByProduct = new Map();
    for (const price of prices) {
      if (!price.marketPrice || price.marketPrice <= 0) continue;
      const current = pricesByProduct.get(price.productId);
      if (!current || price.marketPrice > current.marketPrice) pricesByProduct.set(price.productId, price);
    }
    for (const product of products) {
      const price = pricesByProduct.get(product.productId);
      const rarity = ext(product, "Rarity");
      const number = ext(product, "Number");
      if (!price || !rarity || !number) continue;
      const year = new Date(group.publishedOn).getFullYear();
      let section = null;
      if (game === "pokemon") {
        if (year <= 2010) section = "vintage";
        if (/^Illustration Rare$/i.test(rarity)) section = "illustration-rares";
        if (/^Special Illustration Rare$/i.test(rarity)) section = "special-illustration-rares";
      } else {
        if (/\(Signature\)/i.test(product.name)) section = "signatures";
        else if (/\(Overnumbered\)/i.test(product.name)) section = "overnumbered";
        else if (/\(Alternate Art\)/i.test(product.name)) section = "alt-arts";
        else if (/^Epic$/i.test(rarity)) section = "epics";
        else if (/^Rare$/i.test(rarity)) section = "rares";
      }
      if (!section) continue;
      cards.push({
        game, section, productId: product.productId, name: product.name, set: group.name,
        year, rarity, number, image: product.imageUrl?.replace("_200w", "_in_1000x1000"), url: product.url,
        marketPrice: price.marketPrice, lowPrice: price.lowPrice, midPrice: price.midPrice,
        printing: price.subTypeName,
      });
    }
  }
  return cards;
}

const [pokemon, riftbound] = await Promise.all([collectCategory(3, "pokemon"), collectCategory(89, "riftbound")]);
const limits = { vintage: 40, "illustration-rares": 40, "special-illustration-rares": 40, rares: 40, epics: 40, "alt-arts": 40, overnumbered: 40, signatures: 40 };
const all = [...pokemon, ...riftbound];
const sections = {};
for (const card of all) (sections[card.section] ??= []).push(card);
for (const [key, cards] of Object.entries(sections)) {
  cards.sort((a, b) => b.marketPrice - a.marketPrice);
  sections[key] = cards.slice(0, limits[key]);
}
const lastUpdated = await fetch("https://tcgcsv.com/last-updated.txt", { headers }).then((r) => r.text()).catch(() => today.toISOString());
await fs.writeFile("tcg-data.json", JSON.stringify({ source: "TCGCSV / TCGplayer", syncedAt: new Date().toISOString(), sourceUpdatedAt: lastUpdated.trim(), sections }, null, 2));
console.log(Object.fromEntries(Object.entries(sections).map(([key, cards]) => [key, cards.length])));
