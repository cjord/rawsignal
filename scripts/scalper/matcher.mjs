import { normalizeScalperText, scalperEntryCategoryHint } from "./watchlist.mjs";

const GENERIC = new Set(["pokemon", "card", "game", "trading", "tcg", "sealed", "product"]);
const PRODUCT_TERMS = new Set(["case", "display", "box", "bundle", "pack", "blister", "tin", "collection", "deck", "elite", "trainer", "premium", "center", "booster", "three", "single", "mini", "poster", "sticker"]);
const VARIANT_TERMS = ["case", "display", "set", "box", "bundle", "pack", "blister", "tin", "collection", "deck", "elite", "premium", "center"];

function tokens(value) {
  return normalizeScalperText(value).split(" ").filter(token => token && !GENERIC.has(token));
}

export function prepareScalperCandidate(candidate) {
  const candidateText = normalizeScalperText(`${candidate.name ?? ""} ${candidate.set ?? candidate.groupName ?? ""}`);
  return { ...candidate, _scalperText: candidateText, _scalperTokens: tokens(candidateText) };
}

function diceCoefficient(left, right) {
  const bigrams = value => {
    const padded = ` ${value} `;
    return Array.from({ length: Math.max(0, padded.length - 1) }, (_, index) => padded.slice(index, index + 2));
  };
  const a = bigrams(left), remaining = bigrams(right), shared = a.reduce((count, item) => {
    const index = remaining.indexOf(item);
    if (index < 0) return count;
    remaining.splice(index, 1);
    return count + 1;
  }, 0);
  return a.length + remaining.length + shared ? (2 * shared) / (a.length + remaining.length + 2 * shared) : 0;
}

function variantConflicts(queryTokens, candidateTokens) {
  let penalty = 0;
  for (const term of VARIANT_TERMS) {
    const queryHas = queryTokens.includes(term), candidateHas = candidateTokens.includes(term);
    if (queryHas !== candidateHas) penalty += term === "case" || term === "center" ? 0.2 : 0.055;
  }
  return penalty;
}

export function scoreScalperCandidate(entry, candidate) {
  const query = entry.normalizedQuery;
  const candidateText = candidate._scalperText ?? normalizeScalperText(`${candidate.name ?? ""} ${candidate.set ?? candidate.groupName ?? ""}`);
  const queryTokens = tokens(query), candidateTokens = candidate._scalperTokens ?? tokens(candidateText);
  if (!queryTokens.length || !candidateTokens.length) return 0;
  const volumeIndex = queryTokens.findIndex(token => token === "vol" || token === "volume");
  const volumeNumber = volumeIndex >= 0 ? queryTokens[volumeIndex + 1] : null;
  if (volumeNumber && /^\d+$/.test(volumeNumber)) {
    const candidateVolumeIndex = candidateTokens.findIndex(token => token === "vol" || token === "volume");
    if (candidateVolumeIndex < 0 || candidateTokens[candidateVolumeIndex + 1] !== volumeNumber) return 0;
  }
  const querySet = new Set(queryTokens), candidateSet = new Set(candidateTokens);
  const matched = [...querySet].filter(token => candidateSet.has(token)).length;
  const volumeNumberIsIdentity = querySet.has("vol") || querySet.has("volume");
  const identityTokens = [...querySet].filter(token => !PRODUCT_TERMS.has(token) && (volumeNumberIsIdentity || !/^\d{1,2}$/.test(token)));
  const missingIdentity = identityTokens.filter(token => !candidateSet.has(token)).length;
  const identityPenalty = identityTokens.length ? (missingIdentity / identityTokens.length) * 0.24 : 0;
  const recall = matched / querySet.size;
  const precision = matched / candidateSet.size;
  const tokenScore = recall * 0.72 + precision * 0.08;
  const sequenceScore = diceCoefficient(query, candidateText) * 0.2;
  const exactBoost = candidateText.includes(query) || query.includes(candidateText) ? 0.08 : 0;
  return Math.max(0, Math.min(1, tokenScore + sequenceScore + exactBoost - identityPenalty - variantConflicts(queryTokens, candidateTokens)));
}

export function reconcileScalperEntry(entry, candidates, options = {}) {
  const minimumScore = options.minimumScore ?? 0.54;
  const ambiguityWindow = options.ambiguityWindow ?? 0.035;
  const limit = options.limit ?? 8;
  const categoryHint = scalperEntryCategoryHint(entry);
  const categoryCandidates = candidates.filter(candidate => {
    const category = normalizeScalperText(candidate.categoryName ?? "");
    if (!category) return true;
    if (categoryHint === "pokemon") return category === "pokemon";
    if (categoryHint === "one piece") return category.includes("one piece");
    if (categoryHint === "riftbound") return category.includes("riftbound");
    if (categoryHint === "yu-gi-oh") return category.includes("yugioh") || category.includes("yu gi oh");
    if (categoryHint === "lorcana") return category.includes("lorcana");
    if (categoryHint === "football") return category.includes("football");
    return true;
  });
  const ranked = categoryCandidates
    .map(candidate => ({ candidate, score: scoreScalperCandidate(entry, candidate) }))
    .filter(item => item.score >= minimumScore)
    .sort((a, b) => b.score - a.score || String(a.candidate.name).localeCompare(String(b.candidate.name)))
    .slice(0, limit);
  if (!ranked.length) return { status: "unmatched", entry, candidates: [] };
  const bestScore = ranked[0].score;
  const plausible = ranked.filter(item => bestScore - item.score <= ambiguityWindow);
  return {
    status: plausible.length > 1 ? "ambiguous" : "matched",
    entry,
    candidates: plausible.length > 1 ? plausible : [ranked[0]],
    alternatives: ranked.slice(plausible.length > 1 ? plausible.length : 1),
  };
}

export function reconcileScalperWatchlist(entries, candidates, options) {
  const results = entries.map(entry => reconcileScalperEntry(entry, candidates, options));
  return {
    matched: results.filter(result => result.status === "matched"),
    ambiguous: results.filter(result => result.status === "ambiguous"),
    unmatched: results.filter(result => result.status === "unmatched"),
  };
}
