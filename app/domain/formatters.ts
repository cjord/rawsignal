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

export function formatRarity(value: string) {
  return value;
}

const gameNames: Record<string, string> = {
  pokemon: "Pokémon",
  riftbound: "Riftbound",
  onepiece: "One Piece",
  scalping: "Scalping",
};

export function formatGameName(value: string) {
  return gameNames[value] ?? value;
}
