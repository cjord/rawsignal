// Pure detail-feed construction. Fetching and file publishing stay in build-detail-feeds.mjs.
// Output must satisfy parseCatalogDetailEnrichments in core/domain/contracts.ts.

const finiteOrNull = value => (Number.isFinite(value) ? value : null);
const stringOrNull = value => (typeof value === "string" && value !== "" ? value : null);

// TCGCSV extendedData values may embed markup; the app renders metadata as plain text.
export const plainText = value => String(value)
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/g, "'")
  .trim();

export function productEnrichment({ kind, product, prices, group, categoryId, sourceUpdatedAt }) {
  const metadata = (Array.isArray(product.extendedData) ? product.extendedData : [])
    .filter(field => field && typeof field.name === "string" && field.value != null)
    .map(field => ({
      name: field.name,
      label: typeof field.displayName === "string" && field.displayName !== "" ? field.displayName : field.name,
      value: plainText(field.value),
    }))
    .filter(field => field.value !== "");
  const priceVariants = (Array.isArray(prices) ? prices : [])
    .filter(row => row && typeof row.subTypeName === "string" && row.subTypeName !== "")
    .map(row => ({
      printing: row.subTypeName,
      marketPrice: finiteOrNull(row.marketPrice),
      lowPrice: finiteOrNull(row.lowPrice),
      directLowPrice: finiteOrNull(row.directLowPrice),
      midPrice: finiteOrNull(row.midPrice),
      highPrice: finiteOrNull(row.highPrice),
    }));
  return {
    kind,
    productId: Number(product.productId),
    metadata,
    priceVariants,
    source: {
      categoryId: finiteOrNull(categoryId),
      groupId: finiteOrNull(group?.groupId),
      setAbbreviation: stringOrNull(group?.abbreviation),
      publishedOn: stringOrNull(group?.publishedOn),
      modifiedOn: stringOrNull(product.modifiedOn),
      imageCount: finiteOrNull(product.imageCount),
      isPresale: typeof product.presaleInfo?.isPresale === "boolean" ? product.presaleInfo.isPresale : null,
      presaleNote: stringOrNull(product.presaleInfo?.note),
      sourceUpdatedAt: stringOrNull(sourceUpdatedAt),
    },
  };
}

const emptySource = {
  categoryId: null, groupId: null, setAbbreviation: null, publishedOn: null,
  modifiedOn: null, imageCount: null, isPresale: null, presaleNote: null, sourceUpdatedAt: null,
};

export function fallbackCardEnrichment(card) {
  return {
    kind: "single",
    productId: card.productId,
    metadata: [],
    priceVariants: [{
      printing: stringOrNull(card.printing) ?? "Normal",
      marketPrice: finiteOrNull(card.marketPrice),
      lowPrice: finiteOrNull(card.lowPrice),
      directLowPrice: null,
      midPrice: finiteOrNull(card.midPrice),
      highPrice: finiteOrNull(card.highPrice),
    }],
    source: { ...emptySource },
  };
}

export function fallbackSealedEnrichment(product) {
  return {
    kind: "sealed",
    productId: product.productId,
    metadata: [],
    priceVariants: [{
      printing: "Sealed",
      marketPrice: finiteOrNull(product.marketPrice),
      lowPrice: null,
      directLowPrice: null,
      midPrice: finiteOrNull(product.midPrice),
      highPrice: null,
    }],
    source: { ...emptySource },
  };
}

// singles: deduped Card[]; sealed: deduped SealedProduct[];
// groups: [{ categoryId, group, products, prices }] from TCGCSV (empty when not enriching);
// returns { manifest, chunks, stats } with manifest keys "kind:productId" and chunk file names
// "{categoryId}-{groupId}.json" or "fallback-{kind}-{game}.json".
export function buildDetailFeeds({ singles, sealed, groups, sourceUpdatedAt = null }) {
  const catalog = new Map();
  for (const card of singles) catalog.set(`single:${card.productId}`, { kind: "single", game: card.game, record: card });
  for (const product of sealed) catalog.set(`sealed:${product.productId}`, { kind: "sealed", game: product.game, record: product });

  const chunks = new Map();
  const manifest = {};
  const enriched = new Set();
  const push = (file, enrichment, key) => {
    if (!chunks.has(file)) chunks.set(file, []);
    chunks.get(file).push(enrichment);
    manifest[key] = `/data/details/${file}`;
  };

  for (const { categoryId, group, products, prices } of groups) {
    const pricesByProduct = new Map();
    for (const row of prices ?? []) {
      const id = Number(row.productId);
      if (!pricesByProduct.has(id)) pricesByProduct.set(id, []);
      pricesByProduct.get(id).push(row);
    }
    const file = `${categoryId}-${group.groupId}.json`;
    for (const product of products ?? []) {
      const productId = Number(product.productId);
      for (const kind of ["single", "sealed"]) {
        const key = `${kind}:${productId}`;
        if (!catalog.has(key) || enriched.has(key)) continue;
        enriched.add(key);
        push(file, productEnrichment({ kind, product, prices: pricesByProduct.get(productId), group, categoryId, sourceUpdatedAt }), key);
      }
    }
  }

  let fallback = 0;
  for (const [key, entry] of catalog) {
    if (enriched.has(key)) continue;
    fallback += 1;
    const file = `fallback-${entry.kind}-${entry.game}.json`;
    push(file, entry.kind === "single" ? fallbackCardEnrichment(entry.record) : fallbackSealedEnrichment(entry.record), key);
  }

  for (const rows of chunks.values()) rows.sort((a, b) => a.productId - b.productId || a.kind.localeCompare(b.kind));
  const sortedManifest = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => {
    const [kindA, idA] = a.split(":"), [kindB, idB] = b.split(":");
    return kindA.localeCompare(kindB) || Number(idA) - Number(idB);
  }));
  return {
    manifest: sortedManifest,
    chunks: Object.fromEntries([...chunks.entries()].sort(([a], [b]) => a.localeCompare(b))),
    stats: { entries: catalog.size, enriched: enriched.size, fallback },
  };
}
