const TYPE_RULES = [
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

export function isPokemonSealedProduct(product, group = {}) {
  if (product.categoryId != null && Number(product.categoryId) !== 3) return false;
  const identity = `${product.name ?? ""} ${group.name ?? ""} ${product.url ?? ""}`;
  if (NON_POKEMON.test(identity) || NON_PRODUCT.test(product.name ?? "")) return false;
  if ((product.extendedData ?? []).some(field => /^(number|rarity)$/i.test(field.name) && String(field.value ?? "").trim())) return false;
  return normalizeProductType(product.name) !== "Other";
}

export function normalizedProductKey(product, groupName = "") {
  return `${groupName}|${product.name}`.toLowerCase().replace(/[^a-z0-9|]+/g, " ").trim();
}
