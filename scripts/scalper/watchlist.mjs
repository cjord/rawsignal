const NOTE_MARKERS = [" link ", " pack distribution:", " --- "];

function decodeMojibake(value) {
  return value
    .replaceAll("â€“", "–")
    .replaceAll("â€”", "—")
    .replaceAll("â€™", "’")
    .replaceAll("Ã©", "é");
}

export function normalizeScalperText(value) {
  return decodeMojibake(String(value ?? ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bETBs?\b/gi, " elite trainer box ")
    .replace(/\bUPCs?\b/gi, " ultra premium collection ")
    .replace(/\bSPC\b/gi, " surprise box ")
    .replace(/\bEX\b/gi, " ex ")
    .replace(/\b3[ -]?pack\b/gi, " three booster ")
    .replace(/\bthree[ -]?booster\b/gi, " three booster ")
    .replace(/\bbooster displays?\b/gi, " booster box ")
    .replace(/\bblister packs?\b/gi, " blister ")
    .replace(/\bcollections? boxes?\b/gi, " collection ")
    .replace(/\bboxes\b/gi, " box ")
    .replace(/\bbundles\b/gi, " bundle ")
    .replace(/\btins\b/gi, " tin ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase()
    .replace(/^one piece card game\b/, "one piece")
    .replace(/^phantasmal evolutions\b/, "phantasmal flames")
    .replace(/^ascended\b(?! heroes)/, "ascended heroes")
    .replace(/^ascended heroes tech stickers?\b/, "ascended heroes tech sticker collection")
    .replace(/\bdestined rival\b/g, "destined rivals")
    .replace(/^reshiram elite trainer box\b/, "white flare elite trainer box")
    .replace(/^zekr(?:a|o)m elite trainer box\b/, "black bolt elite trainer box")
    .replace(/^(white flare|black bolt) sticker three booster\b/, "$1 tech sticker collection")
    .replace(/\bdevil fruits\b/g, "devil fruit")
    .replace(/\bzekram\b/g, "zekrom")
    .replace(/\blatia s\b/g, "latias");
}

function canonicalWatchlistQuery(query, raw) {
  let normalized = normalizeScalperText(query);
  if (/pack distribution|random art|\blink\b/i.test(raw)) {
    normalized = normalized.replace(/^((?:one piece )?(?:illustration box|devil fruit collection|tin pack set) vol(?:ume)? \d+).*/, "$1");
  }
  return normalized;
}

export function scalperEntryCategoryHint(entry) {
  const value = entry.normalizedQuery;
  if (/one piece|\bop\d|\bil \d|\bdf \d|\bts \d/.test(value)) return "one piece";
  if (/riftbound|vendetta vault/.test(value)) return "riftbound";
  if (/yu gi oh|rarity collection/.test(value)) return "yu-gi-oh";
  if (/lorcana|illumineer|attack of the vine/.test(value)) return "lorcana";
  if (/topps|football/.test(value)) return "football";
  return "pokemon";
}

function stripNotes(value) {
  const lower = value.toLowerCase();
  const indexes = NOTE_MARKERS.map(marker => lower.indexOf(marker)).filter(index => index >= 0);
  return indexes.length ? value.slice(0, Math.min(...indexes)).trim() : value.trim();
}

export function parseScalperLine(rawLine, lineNumber = 0) {
  const raw = decodeMojibake(String(rawLine ?? "")).trim();
  if (!raw) return null;
  const priceMatch = raw.match(/(?:\$\s*)?(\d+(?:\.\d{1,2})?)\??\s*$/);
  const hasExplicitDollar = /\$\s*\d/.test(raw);
  const hasBareTrailingPrice = Boolean(priceMatch && /\s\d+\.\d{1,2}\??\s*$/.test(raw));
  const msrpOverride = priceMatch && (hasExplicitDollar || hasBareTrailingPrice)
    ? Number(priceMatch[1])
    : null;
  const withoutPrice = msrpOverride == null ? raw : raw.slice(0, priceMatch.index).trim();
  const query = stripNotes(withoutPrice)
    .replace(/\[(?:[^\]]+)\]\([^)]*\)/g, "")
    .replace(/\bTBD\b.*$/i, "")
    .trim();
  return {
    lineNumber,
    raw,
    query,
    normalizedQuery: canonicalWatchlistQuery(query, raw),
    msrpOverride,
    msrpUnverified: /\?\s*$/.test(raw),
  };
}

export function parseScalperWatchlist(text) {
  return String(text ?? "").split(/\r?\n/).map((line, index) => parseScalperLine(line, index + 1)).filter(Boolean);
}

export function watchlistCategoryHints(entries) {
  const source = entries.map(entry => entry.normalizedQuery).join(" ");
  const hints = new Set(["pokemon"]);
  if (/one piece|\bop\d|\bil \d|\bdf \d|\bts \d/.test(source)) hints.add("one piece");
  if (/riftbound|vendetta vault/.test(source)) hints.add("riftbound");
  if (/yu gi oh|rarity collection/.test(source)) hints.add("yu-gi-oh");
  if (/lorcana|illumineer|attack of the vine/.test(source)) hints.add("lorcana");
  if (/topps|football/.test(source)) hints.add("football");
  return [...hints];
}
