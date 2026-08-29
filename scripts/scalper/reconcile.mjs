import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTcgcsvClient } from "../../core/clients/tcgcsv.ts";
import { prepareScalperCandidate, reconcileScalperWatchlist } from "./matcher.mjs";
import { parseScalperWatchlist, watchlistCategoryHints } from "./watchlist.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function categoryMatchesHint(category, hint) {
  const name = String(category.name ?? "").toLowerCase();
  if (hint === "pokemon") return name === "pokemon" || name === "pokémon";
  if (hint === "one piece") return /one piece/.test(name);
  if (hint === "riftbound") return /riftbound/.test(name);
  if (hint === "yu-gi-oh") return /yu-?gi-?oh/.test(name);
  if (hint === "lorcana") return /lorcana/.test(name);
  if (hint === "football") return /football/.test(name);
  return name.includes(hint);
}

function extendedValue(product, name) {
  return product.extendedData?.find(item => String(item.name).toLowerCase() === name)?.value ?? "";
}

function isLikelySealedProduct(product) {
  const rarity = extendedValue(product, "rarity");
  const number = extendedValue(product, "number");
  if (rarity || number) return false;
  return /box|bundle|pack|blister|tin|collection|deck|display|case|vault|trove|poster|binder|sticker|pouch|figure|ball|stadium/i.test(product.name ?? "");
}

function asCandidate(product, group, category) {
  return {
    productId: Number(product.productId),
    name: product.name,
    cleanName: product.cleanName ?? product.name,
    imageUrl: product.imageUrl ?? null,
    url: product.url ?? null,
    set: group.name,
    groupId: Number(group.groupId),
    categoryId: Number(category.categoryId),
    categoryName: category.name,
  };
}

function reportLine(result) {
  const serializeCandidate = item => {
    const { _scalperText, _scalperTokens, ...candidate } = item.candidate;
    void _scalperText;
    void _scalperTokens;
    return { score: Number(item.score.toFixed(4)), ...candidate };
  };
  return {
    lineNumber: result.entry.lineNumber,
    source: result.entry.raw,
    query: result.entry.query,
    msrpOverride: result.entry.msrpOverride,
    msrpUnverified: result.entry.msrpUnverified,
    candidates: result.candidates.map(serializeCandidate),
    alternatives: (result.alternatives ?? []).map(serializeCandidate),
  };
}

const watchlistPath = path.resolve(argument("watchlist", "scalper.txt"));
const outputPath = path.resolve(argument("output", "docs/scalper-reconciliation.json"));
const cachePath = path.resolve(argument("cache", "docs/scalper-candidates.json"));
const entries = parseScalperWatchlist(await readFile(watchlistPath, "utf8"));
const hints = watchlistCategoryHints(entries);
const useCache = process.argv.includes("--from-cache");
let categories = [];
let candidates = [];

if (useCache) {
  const cached = JSON.parse(await readFile(cachePath, "utf8"));
  candidates = cached.map(prepareScalperCandidate);
  categories = [...new Map(cached.map(candidate => [candidate.categoryId, { categoryId: candidate.categoryId, name: candidate.categoryName }])).values()];
} else {
  const client = createTcgcsvClient({ throttleMs: 110 });
  categories = (await client.categories()).filter(category => hints.some(hint => categoryMatchesHint(category, hint)));
  for (const category of categories) {
    const groups = await client.groups(category.categoryId);
    for (const [index, group] of groups.entries()) {
      const products = await client.products(category.categoryId, group.groupId);
      candidates.push(...products.filter(isLikelySealedProduct).map(product => prepareScalperCandidate(asCandidate(product, group, category))));
      if ((index + 1) % 50 === 0) console.error(`${category.name}: ${index + 1}/${groups.length}`);
    }
  }
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(candidates.map(candidate => {
    const { _scalperText, _scalperTokens, ...serializable } = candidate;
    void _scalperText;
    void _scalperTokens;
    return serializable;
  }), null, 2)}\n`);
}

const reconciled = reconcileScalperWatchlist(entries, candidates);
const report = {
  generatedAt: new Date().toISOString(),
  source: watchlistPath,
  sourcePolicy: "TCGCSV products only; the watchlist is an allowlist and optional MSRP override source.",
  categoryHints: hints,
  categories: categories.map(category => ({ categoryId: category.categoryId, name: category.name })),
  counts: {
    entries: entries.length,
    sealedCandidates: candidates.length,
    matched: reconciled.matched.length,
    ambiguous: reconciled.ambiguous.length,
    unmatched: reconciled.unmatched.length,
  },
  matched: reconciled.matched.map(reportLine),
  ambiguous: reconciled.ambiguous.map(reportLine),
  unmatched: reconciled.unmatched.map(reportLine),
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.counts));
console.log(`Review report: ${outputPath}`);
if (report.counts.ambiguous) process.exitCode = 2;
