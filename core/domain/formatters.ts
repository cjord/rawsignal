const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const wholeDollarCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsd(value: number | null | undefined, unavailable = "—") {
  if (value == null || !Number.isFinite(value)) return unavailable;
  return (Math.abs(value) >= 100 ? wholeDollarCurrency : currency).format(value);
}

export function formatPercent(value: number | null | undefined, unavailable = "—") {
  if (value == null || !Number.isFinite(value)) return unavailable;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatUtcDate(value: string, includeYear = false) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

// "Aug 28, 2026" for freshness lines ("Updated …", "Data updated …"). Formatted in UTC,
// like every other date in the app: the Worker renders these lines in UTC, so a
// browser-local format re-renders them differently after hydration for any user whose
// day boundary differs (React error #418 on the set pages, 2026-09-03).
export function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatRarity(value: string) {
  return value;
}

const gameNames: Record<string, string> = {
  pokemon: "Pokémon",
  riftbound: "Riftbound",
  onepiece: "One Piece",
  // The curated in-print sealed list ("scalping" internally, for URL stability).
  scalping: "Obey Products",
  // The cross-game scope (visual pass rework 2026-08-28).
  all: "All Markets",
};

export function formatGameName(value: string) {
  return gameNames[value] ?? value;
}

// URL identity for a set within its game (sets view 2026-08-29): lowercase, punctuation
// folded to hyphens. Slugs are only unique per game — route paths must carry both.
export function setSlug(setName: string) {
  return setName.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
