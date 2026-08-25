export const CATALOG_SCHEMA_VERSION = 1;

const finiteOrNull = value => value === null || Number.isFinite(value);

export function validateCatalogSnapshot({ cards = [], sealed = [], minimumRecords = 1 }) {
  if (!Array.isArray(cards) || !Array.isArray(sealed)) throw new TypeError("Catalog snapshot collections must be arrays");
  if (cards.length + sealed.length < minimumRecords) throw new Error(`Catalog validation rejected ${cards.length + sealed.length} records; minimum is ${minimumRecords}`);
  const ids = new Set(), duplicates = [];
  for (const record of [...cards, ...sealed]) {
    if (!Number.isInteger(record.productId) || record.productId <= 0) throw new TypeError("Catalog record has an invalid product ID");
    const key = String(record.productId);
    if (ids.has(key)) duplicates.push(key); else ids.add(key);
    if (!record.name || !record.set) throw new TypeError(`Catalog record ${key} is missing identity metadata`);
    if (record.section && !(record.marketPrice > 0)) throw new TypeError(`Catalog record ${key} has invalid marketPrice`);
    for (const field of ["marketPrice", "midPrice", ...(record.section ? ["lowPrice", "highPrice"] : ["msrp"])]) {
      if (!finiteOrNull(record[field])) throw new TypeError(`Catalog record ${key} has invalid ${field}`);
      if (record[field] != null && record[field] < 0) throw new TypeError(`Catalog record ${key} has negative ${field}`);
    }
  }
  if (duplicates.length) throw new Error(`Catalog validation found duplicate product identities: ${duplicates.slice(0, 5).join(", ")}`);
  return { records: cards.length + sealed.length, cards: cards.length, sealed: sealed.length, duplicates: 0 };
}

export function ingestionManifest({ source, sourceUpdatedAt, generatedAt, counts, rejected = {}, duplicateDecisions = [] }) {
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    source,
    sourceUpdatedAt,
    generatedAt,
    counts,
    rejected,
    duplicateDecisions,
  };
}
