-- One complete, source-dated heatmap payload per game. The daily cron replaces both
-- rows atomically after the published live catalog has finished; API reads stay cheap.
CREATE TABLE set_heatmap_snapshots (
  game TEXT PRIMARY KEY CHECK (game IN ('pokemon', 'riftbound')),
  source_run_id TEXT NOT NULL,
  source_date TEXT NOT NULL,
  algorithm_version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
