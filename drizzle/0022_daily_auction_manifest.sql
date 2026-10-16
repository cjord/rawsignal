-- A single immutable lineup per UTC date; no per-player server state.
CREATE TABLE daily_auction_manifests (
  challenge_date TEXT PRIMARY KEY NOT NULL,
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
