// Favorites and buy-list state (audit Phase B). Device-local by decision — the same
// no-login pattern as every other preference; a future account merges this list up.
// Entries carry enough display data to render the buy list offline at a card show,
// stamped with when the price was captured.

export type FavoriteEntry = {
  key: string;
  kind: "single" | "sealed";
  game: string;
  productId: number;
  name: string;
  set: string;
  number: string | null;
  section: string | null;
  image: string | null;
  price: number | null;
  addedAt: string;
};

export type BuyState = { acquired: boolean; paid: number | null };

export const FAVORITES_KEY = "raw-signal-favorites";
export const BUYLIST_KEY = "raw-signal-buylist";

export const favoriteKey = (kind: "single" | "sealed", productId: number) => `${kind}:${productId}`;

// Entry builders for the hover-popover stars; FavoriteStar re-stamps addedAt on toggle.
export const cardFavorite = (card: { game: string; productId: number; name: string; set: string; number: string; section: string; image: string | null; marketPrice: number }): FavoriteEntry => ({
  key: favoriteKey("single", card.productId), kind: "single", game: card.game, productId: card.productId,
  name: card.name, set: card.set, number: card.number, section: card.section, image: card.image || null,
  price: card.marketPrice, addedAt: "",
});
export const sealedFavorite = (product: { game: string; productId: number; name: string; set: string; image: string | null; marketPrice: number | null }): FavoriteEntry => ({
  key: favoriteKey("sealed", product.productId), kind: "sealed", game: product.game, productId: product.productId,
  name: product.name, set: product.set, number: null, section: null, image: product.image || null,
  price: product.marketPrice, addedAt: "",
});

const isEntry = (value: unknown): value is FavoriteEntry => {
  const entry = value as FavoriteEntry;
  return Boolean(entry && typeof entry.key === "string" && (entry.kind === "single" || entry.kind === "sealed")
    && Number.isInteger(entry.productId) && typeof entry.name === "string" && typeof entry.set === "string");
};

export function parseFavorites(raw: string | null): FavoriteEntry[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch { return []; }
}

export function toggleFavorite(entries: FavoriteEntry[], entry: FavoriteEntry): FavoriteEntry[] {
  return entries.some(item => item.key === entry.key)
    ? entries.filter(item => item.key !== entry.key)
    : [...entries, entry];
}

export function addFavorites(entries: FavoriteEntry[], additions: FavoriteEntry[]): FavoriteEntry[] {
  const present = new Set(entries.map(item => item.key));
  return [...entries, ...additions.filter(item => !present.has(item.key) && present.add(item.key))];
}

export function parseBuyStates(raw: string | null): Record<string, BuyState> {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const states: Record<string, BuyState> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, BuyState>)) {
      if (value && typeof value === "object") states[key] = { acquired: Boolean(value.acquired), paid: Number.isFinite(value.paid) ? Number(value.paid) : null };
    }
    return states;
  } catch { return {}; }
}

// The show scoreboard: what the list is worth at captured market prices, what has been
// acquired, and what was actually paid for the acquired part.
export function buylistTotals(entries: FavoriteEntry[], states: Record<string, BuyState>) {
  let marketTotal = 0, acquiredMarket = 0, paidTotal = 0, acquired = 0;
  for (const entry of entries) {
    const price = entry.price ?? 0;
    marketTotal += price;
    const state = states[entry.key];
    if (state?.acquired) {
      acquired++;
      acquiredMarket += price;
      paidTotal += state.paid ?? 0;
    }
  }
  return { count: entries.length, acquired, marketTotal, acquiredMarket, paidTotal };
}
