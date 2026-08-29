// Collectr showcase parsing (import feature 2026-08-29). A public showcase page ships a
// React-Query dehydrated state inside Next RSC push chunks; its product records key on
// TCGplayer product ids — the same id space as the entire Raw Signal catalog, so
// matching is a plain integer join. The paginated API (api-v2.getcollectr.com
// /data/showcase/{handle}?limit&offset) returns the same shapes as page JSON.

export type CollectrRawProduct = {
  product_id?: unknown;
  catalog_category_name?: string;
  catalog_group?: string;
  product_name?: string;
  image_url?: string | null;
  card_number?: string | null;
  rarity?: string | null;
  quantity?: unknown;
  market_price?: unknown;
  market_price_diff?: unknown;
  market_price_percentage_diff?: unknown;
  card_condition?: string | null;
  product_sub_type?: string | null;
  grade_id?: unknown;
  grade_company?: string | null;
  is_card?: unknown;
};

export type CollectrProfile = {
  handle: string;
  name: string;
  totalCards: number;
  totalSealed: number;
  totalGraded: number;
  collectrValue: number | null;
};

export type CollectrCard = {
  productId: number;
  game: "pokemon" | "riftbound" | null;
  collectrGame: string;
  name: string;
  set: string;
  number: string;
  rarity: string;
  condition: string | null;
  printing: string | null;
  quantity: number;
  collectrPrice: number | null;
  collectrChange: number | null;
  image: string | null;
};

const GAME_MAP: Record<string, CollectrCard["game"]> = { pokemon: "pokemon", riftbound: "riftbound" };
const toNumber = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

// Graded detection differs by source: the paginated API leaves grade_id null and puts
// the grade in grade_company ("9"); the SSR payload puts it in grade_id with the "52"
// sentinel meaning raw. A record is graded when either field carries a real grade.
export function isGradedRecord(record: CollectrRawProduct): boolean {
  const company = (record.grade_company ?? "").trim();
  const gradeId = record.grade_id == null ? "" : String(record.grade_id).trim();
  return company !== "" || (gradeId !== "" && gradeId !== "52");
}

// Raw showcase records -> normalized cards. Graded copies and sealed rows are dropped
// here by design (the import scope is raw singles); the caller reports the skip counts.
export function normalizeCollectrProducts(raw: CollectrRawProduct[]): { cards: CollectrCard[]; skippedGraded: number; skippedSealed: number } {
  const cards: CollectrCard[] = [];
  let skippedGraded = 0, skippedSealed = 0;
  for (const record of raw) {
    if (record.is_card === false || record.is_card === "false") { skippedSealed += 1; continue; }
    if (isGradedRecord(record)) { skippedGraded += 1; continue; }
    const productId = toNumber(record.product_id);
    if (productId == null) continue;
    const collectrGame = (record.catalog_category_name ?? "").trim();
    cards.push({
      productId,
      game: GAME_MAP[collectrGame.toLowerCase()] ?? null,
      collectrGame,
      name: (record.product_name ?? "").trim(),
      set: (record.catalog_group ?? "").trim(),
      number: (record.card_number ?? "").trim(),
      rarity: (record.rarity ?? "").trim(),
      condition: record.card_condition?.trim() || null,
      printing: record.product_sub_type?.trim() || null,
      quantity: Math.max(1, toNumber(record.quantity) ?? 1),
      collectrPrice: toNumber(record.market_price),
      collectrChange: toNumber(record.market_price_diff),
      image: record.image_url || null,
    });
  }
  return { cards, skippedGraded, skippedSealed };
}

type ShowcasePage = {
  user?: string;
  handle?: string;
  total_cards?: unknown;
  total_sealed?: unknown;
  total_graded?: unknown;
  portfolio_value?: { price?: unknown }[];
  products?: CollectrRawProduct[];
};

export function parseShowcasePage(page: ShowcasePage): { profile: CollectrProfile; raw: CollectrRawProduct[] } {
  return {
    profile: {
      handle: (page.handle ?? "").trim(),
      name: (page.user ?? "").trim() || "Collectr user",
      totalCards: toNumber(page.total_cards) ?? 0,
      totalSealed: toNumber(page.total_sealed) ?? 0,
      totalGraded: toNumber(page.total_graded) ?? 0,
      collectrValue: toNumber(page.portfolio_value?.[0]?.price),
    },
    raw: Array.isArray(page.products) ? page.products : [],
  };
}

// Balanced-brace object extraction that respects JSON string escapes.
function extractObject(text: string, start: number): string | null {
  if (text[start] !== "{") return null;
  let depth = 0, inString = false;
  for (let index = start; index < text.length; index++) {
    const ch = text[index];
    if (inString) {
      if (ch === "\\") index += 1;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") { depth -= 1; if (depth === 0) return text.slice(start, index + 1); }
  }
  return null;
}

// Parse the dehydrated showcase query straight out of a showcase page's HTML. The RSC
// stream splits into <script>self.__next_f.push([1,"..."])</script> string fragments;
// unescaping each once and concatenating yields plain JSON around the marker.
export function parseShowcaseHtml(html: string): { profile: CollectrProfile; raw: CollectrRawProduct[] } | null {
  const fragments = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map(match => {
    try { return JSON.parse(`"${match[1]}"`) as string; } catch { return ""; }
  });
  const text = fragments.join("");
  const marker = text.indexOf('"getShowcaseProfile"');
  if (marker < 0) return null;
  // The dehydrated entry's data object starts at the nearest {"user": before the marker.
  const dataStart = text.lastIndexOf('{"user":', marker);
  if (dataStart < 0) return null;
  const objectText = extractObject(text, dataStart);
  if (!objectText) return null;
  try {
    return parseShowcasePage(JSON.parse(objectText) as ShowcasePage);
  } catch {
    return null;
  }
}

// Handles arrive as "@name", full profile URLs, or bare names; the API wants the bare name.
export function normalizeCollectrHandle(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = /getcollectr\.com\/showcase\/profile\/@?([A-Za-z0-9_.-]+)/i.exec(trimmed)?.[1];
  const bare = fromUrl ?? trimmed.replace(/^@/, "");
  return /^[A-Za-z0-9_.-]{2,64}$/.test(bare) ? bare.toLowerCase() : null;
}
