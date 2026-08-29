// The named cache tiers every API route serves from (decision D6) — previously six
// hand-typed Cache-Control literals across the routes.
export const CACHE_TIERS = {
  // Fast-moving catalog listings.
  short: "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
  // Daily rollups (metrics, set EV).
  medium: "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600",
  // Slow-moving detail payloads and ready signal sets.
  long: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  // Per-product history (refreshes daily; safe to hold an hour).
  hour: "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
  // Not-ready responses that should re-check soon.
  transient: "public, max-age=60, s-maxage=60",
} as const;
