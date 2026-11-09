-- Additive market-aware archive; existing Riftbound daily tables remain untouched.
CREATE TABLE shared_game_manifests (
 market TEXT NOT NULL CHECK(market IN ('pokemon','riftbound')),
 challenge_kind TEXT NOT NULL CHECK(challenge_kind IN ('showdown','auction')),
 challenge_date TEXT NOT NULL,
 manifest_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(market,challenge_kind,challenge_date)
);
