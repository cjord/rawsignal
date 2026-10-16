-- Both daily difficulties share one immutable UTC-day snapshot, no player records.
CREATE TABLE daily_showdown_manifests (
  challenge_date TEXT PRIMARY KEY NOT NULL,
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
