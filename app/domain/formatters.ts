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

// Local-timezone "Aug 28, 2026" for freshness lines ("Updated …", "Data updated …").
export function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
