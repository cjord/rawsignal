// Sealed product identification and category taxonomy for the TCGCSV group walks.
export type SealedSourceProduct = {
  productId?: unknown;
  name?: string;
  url?: string;
  imageUrl?: string;
  categoryId?: unknown;
  extendedData?: { name: string; value?: unknown }[];
};
export type SealedSourceGroup = { name?: string; publishedOn?: string };

const TYPE_RULES: [string, RegExp][] = [
  ["Booster Boxes", /\b(booster (box|display)|display box)\b/i],
  ["Booster Bundles", /\bbooster bundle\b/i],
  ["Booster Packs", /\b(booster pack|sleeved booster|double pack|checklane booster)\b/i],
  ["Elite Trainer Boxes", /\belite trainer box\b/i],
  ["Troves", /\btrove\b/i],
  ["Starter / Theme Decks", /\b(starter deck|theme deck|battle deck|league battle deck|ex battle deck|v battle deck|championship deck|deck set)\b/i],
  ["Build & Battle", /\b(build\s*(?:&|and)\s*battle|prerelease kit|pre-release kit)\b/i],
  ["Tins", /\b(tin|mini tin)\b/i],
  ["Blisters", /\b(blister|checklane)\b/i],
  ["Collections", /\b(collection|collector chest|premium tournament collection|ultra-premium collection|case file|pencil case)\b/i],
  ["Trainer Kits / Toolkits", /\b(trainer(?:'s)? toolkit|trainer kit|battle academy)\b/i],
  ["Boxes / Bundles", /\b(box|bundle|vault|calendar)\b/i],
];

const NON_POKEMON = /\b(lorcana|one[ -]?piece|riftbound|yu-?gi-?oh|flesh and blood|dragon ball|digimon|star wars unlimited|magic: the gathering)\b|attack of the vine/i;
const NON_PRODUCT = /\b(code card|single card|jumbo card|oversize(?:d)? card|wrapper|empty box|deck box|card sleeves?|playmat|dice set)\b/i;

export function normalizeProductType(name = "") {
  if (/\bbooster bundle display\b/i.test(name)) return "Cases";
  if (/\bcase\b/i.test(name) && !/\b(case file|pencil case)\b/i.test(name)) return "Cases";
  return TYPE_RULES.find(([, pattern]) => pattern.test(name))?.[0] ?? "Other";
}

export function isPokemonSealedProduct(product: SealedSourceProduct, group: SealedSourceGroup = {}) {
  if (product.categoryId != null && Number(product.categoryId) !== 3) return false;
  const identity = `${product.name ?? ""} ${group.name ?? ""} ${product.url ?? ""}`;
  if (NON_POKEMON.test(identity) || NON_PRODUCT.test(product.name ?? "")) return false;
  if ((product.extendedData ?? []).some(field => /^(number|rarity)$/i.test(field.name) && String(field.value ?? "").trim())) return false;
  return normalizeProductType(product.name) !== "Other";
}

export function normalizedProductKey(product: SealedSourceProduct, groupName = "") {
  return `${groupName}|${product.name}`.toLowerCase().replace(/[^a-z0-9|]+/g, " ").trim();
}

// Riftbound name patterns differ from Pokémon's, but the emitted categories are the
// shared canonical buckets (decision D3 — the old curated vocabulary and its alias
// bridge are gone). Rule order matters — bundles before packs so "Sleeved Booster
// Pack Art Bundle" lands as a bundle.
const RIFTBOUND_TYPE_RULES: [string, RegExp][] = [
  ["Cases", /\bcase\b/i],
  ["Collections", /\b(player bundle|signature edition|art bundle|vault bundle|worlds bundle)\b/i],
  ["Boxes / Bundles", /\b(gift box|lunar revel bundle)\b/i],
  ["Starter / Theme Decks", /\bchampion deck\b/i],
  ["Booster Boxes", /\b(booster display|booster box)\b/i],
  ["Booster Packs", /\b(booster pack|sleeved booster|promo pack)\b/i],
];

export function normalizeRiftboundProductType(name = "") {
  return RIFTBOUND_TYPE_RULES.find(([, pattern]) => pattern.test(name))?.[0] ?? "Other";
}

// Unlike Pokémon, "Other" stays includable (Riftbound box sets land in that bucket);
// bulk lots are the one sealed-shaped Riftbound listing that is not a product.
export function isRiftboundSealedProduct(product: SealedSourceProduct) {
  if (product.categoryId != null && Number(product.categoryId) !== 89) return false;
  if (NON_PRODUCT.test(product.name ?? "") || /\bbulk\b/i.test(product.name ?? "")) return false;
  if ((product.extendedData ?? []).some(field => /^(number|rarity)$/i.test(field.name) && String(field.value ?? "").trim())) return false;
  return true;
}

// Japanese Pokémon sealed (category 85, todo L1 option B): JP sealed joins the English
// Pokémon sealed catalog (game stays "pokemon", no migration). Only SWSH-era-and-newer
// set groups are walked — tick cost scales with group count (434 non-promo groups hold
// just ~254 sealed) and the ≥2020 cutoff covers every observed Collectr miss for less
// than half the walk; the full walk or a sealed-group cache stays available if
// completeness ever matters. The JP line reuses the Pokémon taxonomy with one
// vocabulary addition — "Starter Set" is the JP starter-deck naming. "Other" stays
// excluded like English Pokémon: category 85 carries JP accessories (deck cases,
// coins) that the shared non-product patterns don't all name.
export const JAPANESE_SEALED_SINCE = "2020-01-01";
export function normalizeJapaneseProductType(name = "") {
  if (/\bstarter set\b/i.test(name)) return "Starter / Theme Decks";
  return normalizeProductType(name);
}

export function isJapaneseSealedProduct(product: SealedSourceProduct) {
  if (product.categoryId != null && Number(product.categoryId) !== 85) return false;
  if (NON_PRODUCT.test(product.name ?? "") || /\b(bulk|deck case|card case)\b/i.test(product.name ?? "")) return false;
  if ((product.extendedData ?? []).some(field => /^(number|rarity)$/i.test(field.name) && String(field.value ?? "").trim())) return false;
  return normalizeJapaneseProductType(product.name) !== "Other";
}

// One Piece (category 68) is sealed-only in the catalog — singles stay untracked (todo
// L2). Bandai's line has its own vocabulary (double packs, deck sets, illustration
// boxes, tin pack sets) mapped onto the shared canonical buckets. Rule order matters:
// cases/displays outrank the products they contain ("Booster Box Case", "Deck Set
// Display"), and the deck rule must not swallow "Double Pack Set".
const ONEPIECE_TYPE_RULES: [string, RegExp][] = [
  ["Cases", /\b(case|display)\b/i],
  ["Booster Boxes", /\bbooster box\b/i],
  ["Booster Packs", /\b(booster pack|sleeved booster|promotion pack|promo pack)\b/i],
  ["Starter / Theme Decks", /\b(starter deck|ultra deck|deck set)\b/i],
  ["Tins", /\btin\b/i],
  ["Collections", /\b(collection|illustration box|anniversary set|premium box)\b/i],
  ["Boxes / Bundles", /\b(double pack|gift box|box|bundle)\b/i],
];

export function normalizeOnePieceProductType(name = "") {
  return ONEPIECE_TYPE_RULES.find(([, pattern]) => pattern.test(name))?.[0] ?? "Other";
}

// "Other" stays includable like Riftbound (the category is dedicated to One Piece, so
// off-vocabulary items are still real sealed products); singles carry Number/Rarity
// extendedData and accessories match the shared non-product patterns.
export function isOnePieceSealedProduct(product: SealedSourceProduct) {
  if (product.categoryId != null && Number(product.categoryId) !== 68) return false;
  if (NON_PRODUCT.test(product.name ?? "") || /\bbulk\b/i.test(product.name ?? "")) return false;
  if ((product.extendedData ?? []).some(field => /^(number|rarity)$/i.test(field.name) && String(field.value ?? "").trim())) return false;
  return true;
}
