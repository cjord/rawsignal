export type CuratedSetArt = { logo: string; symbol: string | null };

const normalize = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

// Main-set wordmarks are optimized copies of the public Riftbound collection art;
// promo images are cropped from Riot's official announcements. Keeping these local
// prevents a third-party outage from reverting a set tile to high-value card art.
const RIFTBOUND_ART: Record<string, CuratedSetArt> = {
  "origins": { logo: "/images/set-art/riftbound/origins.webp", symbol: null },
  "origins proving grounds": { logo: "/images/set-art/riftbound/origins.webp", symbol: null },
  "spiritforged": { logo: "/images/set-art/riftbound/spiritforged.webp", symbol: null },
  "unleashed": { logo: "/images/set-art/riftbound/unleashed.webp", symbol: null },
  "vendetta": { logo: "/images/set-art/riftbound/vendetta.webp", symbol: null },
  "lunar revel 2026": { logo: "/images/set-art/riftbound/lunar-revel-2026.webp", symbol: null },
  "secret garden": { logo: "/images/set-art/riftbound/secret-garden.webp", symbol: null },
  "t1 2025 worlds champion collection": { logo: "/images/set-art/riftbound/t1-2025-worlds.webp", symbol: null },
};

export function curatedSetArtFor(game: string, set: string): CuratedSetArt | null {
  return game === "riftbound" ? RIFTBOUND_ART[normalize(set)] ?? null : null;
}
