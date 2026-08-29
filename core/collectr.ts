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

// ---------------------------------------------------------------------------
// Collectr Pro CSV export import. Collectr doesn't document the export layout, so the
// header mapping is deliberately tolerant: each logical field accepts every plausible
// header spelling, matched case- and punctuation-insensitively. Rows without a
// TCGplayer id get synthetic negative productIds; the route later resolves them by
// name/number against the catalog and rewrites the id when a match lands.

// RFC4180-ish parser: quoted fields, doubled-quote escapes, CRLF/CR/LF rows, BOM strip.
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuotes = false;
  const endField = () => { row.push(field); field = ""; };
  const endRow = () => { endField(); if (row.length > 1 || row[0].trim() !== "") rows.push(row); row = []; };
  for (let index = 0; index < source.length; index++) {
    const ch = source[index];
    if (inQuotes) {
      if (ch === '"') {
        if (source[index + 1] === '"') { field += '"'; index += 1; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") endField();
    else if (ch === "\n") endRow();
    else if (ch === "\r") { if (source[index + 1] === "\n") index += 1; endRow(); }
    else field += ch;
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

const headerKey = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9#]+/g, "");
const csvGame = (value: string): CollectrCard["game"] => {
  const folded = headerKey(value);
  if (folded.includes("pokemon")) return "pokemon";
  if (folded.includes("riftbound")) return "riftbound";
  return null;
};
const CSV_FIELDS: Record<string, string[]> = {
  id: ["tcgplayerid", "tcgplayerproductid", "productid", "tcgid", "id"],
  name: ["productname", "cardname", "name", "card", "product"],
  set: ["setname", "set", "group", "expansion", "cataloggroup"],
  number: ["cardnumber", "number", "card#", "#", "no"],
  rarity: ["rarity"],
  condition: ["condition", "cardcondition"],
  printing: ["printing", "subtype", "productsubtype", "variance", "variant", "finish"],
  quantity: ["quantity", "qty", "count", "owned"],
  price: ["marketprice", "marketvalue", "price", "value", "estimatedvalue"],
  game: ["category", "catalogcategory", "game", "tcg", "franchise"],
  gradeCompany: ["gradingcompany", "gradecompany", "grader", "grading"],
  grade: ["grade", "gradevalue"],
  kind: ["producttype", "itemtype", "type", "kind"],
};

const csvNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const RAW_GRADE_VALUES = /^(raw|ungraded|none|no|n\/a|-|—|0)$/i;

export type CollectrCsvImport = { cards: CollectrCard[]; skippedGraded: number; skippedSealed: number; hasIds: boolean };

export function normalizeCollectrCsv(text: string): CollectrCsvImport | { error: string } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "The CSV has no data rows — export your collection from Collectr (Pro) and try again." };
  const headers = rows[0].map(headerKey);
  const columns: Partial<Record<keyof typeof CSV_FIELDS, number>> = {};
  for (const [fieldName, aliases] of Object.entries(CSV_FIELDS)) {
    const at = headers.findIndex(header => aliases.includes(header));
    if (at >= 0) columns[fieldName as keyof typeof CSV_FIELDS] = at;
  }
  if (columns.name == null || (columns.id == null && columns.set == null && columns.number == null)) {
    return { error: `Couldn't recognize the CSV columns (found: ${rows[0].map(header => header.trim()).filter(Boolean).join(", ") || "none"}). Expected a Collectr collection export with a product name plus a TCGplayer id or set/number.` };
  }
  const cell = (row: string[], fieldName: keyof typeof CSV_FIELDS) => {
    const at = columns[fieldName];
    return at == null ? "" : (row[at] ?? "").trim();
  };
  const cards: CollectrCard[] = [];
  let skippedGraded = 0, skippedSealed = 0, hasIds = false;
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    const name = cell(row, "name");
    if (!name) continue;
    const kind = cell(row, "kind");
    if (kind && !/single|card/i.test(kind)) { skippedSealed += 1; continue; }
    const gradeCompany = cell(row, "gradeCompany");
    const grade = cell(row, "grade");
    if ((gradeCompany && !RAW_GRADE_VALUES.test(gradeCompany)) || (grade && !RAW_GRADE_VALUES.test(grade))) { skippedGraded += 1; continue; }
    const productId = csvNumber(cell(row, "id"));
    if (productId != null && productId > 0) hasIds = true;
    const collectrGame = cell(row, "game");
    cards.push({
      productId: productId != null && productId > 0 ? productId : -index,
      game: csvGame(collectrGame),
      collectrGame,
      name,
      set: cell(row, "set"),
      number: cell(row, "number"),
      rarity: cell(row, "rarity"),
      condition: cell(row, "condition") || null,
      printing: cell(row, "printing") || null,
      quantity: Math.max(1, Math.round(csvNumber(cell(row, "quantity")) ?? 1)),
      collectrPrice: csvNumber(cell(row, "price")),
      collectrChange: null,
      image: null,
    });
  }
  if (!cards.length) return { error: "No importable raw singles found in the CSV." };
  return { cards, skippedGraded, skippedSealed, hasIds };
}

// Card numbers vary in zero-padding and denominators across sources ("058/189", "58/189",
// "58"): normalize zero-padding per segment; two numbers agree when the normalized forms
// are equal, or when exactly one side lacks a denominator and the numerators match.
export function cardNumberKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "").split("/").map(segment => segment.replace(/^0+(?=[0-9])/, "")).join("/");
}
const numbersAgree = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes("/") !== b.includes("/") && a.split("/")[0] === b.split("/")[0];
};

// Disambiguate same-name catalog candidates for a CSV row: prefer a card-number match,
// then a set match; anything still ambiguous stays honestly unmatched.
export function pickCsvMatch<T extends { number: string; set: string }>(card: Pick<CollectrCard, "number" | "set">, candidates: T[]): T | null {
  if (!candidates.length) return null;
  let pool = candidates;
  const number = cardNumberKey(card.number);
  if (number) {
    const byNumber = pool.filter(candidate => numbersAgree(number, cardNumberKey(candidate.number)));
    if (byNumber.length) pool = byNumber;
  }
  if (pool.length > 1 && card.set) {
    const bySet = pool.filter(candidate => candidate.set.toLowerCase() === card.set.toLowerCase());
    if (bySet.length) pool = bySet;
  }
  return pool.length === 1 ? pool[0] : null;
}
