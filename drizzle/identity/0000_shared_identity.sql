-- Identity-only database. Never bind a market/save database as IDENTITY_DB.
CREATE TABLE auth_user (
 id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE auth_session (
 id TEXT PRIMARY KEY NOT NULL, expiresAt TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, ipAddress TEXT, userAgent TEXT,
 environment TEXT NOT NULL CHECK(environment IN ('staging','production')),
 userId TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE
);
CREATE INDEX auth_session_user ON auth_session(userId,environment);
CREATE TABLE auth_account (
 id TEXT PRIMARY KEY NOT NULL, accountId TEXT NOT NULL, providerId TEXT NOT NULL,
 userId TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt TEXT,
 refreshTokenExpiresAt TEXT, scope TEXT, password TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
 UNIQUE(providerId,accountId)
);
CREATE INDEX auth_account_user ON auth_account(userId);
CREATE TABLE auth_verification (
 id TEXT PRIMARY KEY NOT NULL, identifier TEXT NOT NULL, value TEXT NOT NULL,
 expiresAt TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX auth_verification_identifier ON auth_verification(identifier);
CREATE TABLE auth_rate_limit (id TEXT PRIMARY KEY NOT NULL,key TEXT NOT NULL UNIQUE,count INTEGER NOT NULL,lastRequest INTEGER NOT NULL);
-- Durable deletion outbox: no emails, credentials or save bodies.
CREATE TABLE auth_deletion_tasks (
 user_id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL,
 staging_cleaned INTEGER NOT NULL DEFAULT 0 CHECK(staging_cleaned IN (0,1)),
 production_cleaned INTEGER NOT NULL DEFAULT 0 CHECK(production_cleaned IN (0,1))
);
CREATE INDEX auth_deletion_staging ON auth_deletion_tasks(staging_cleaned,created_at);
CREATE INDEX auth_deletion_production ON auth_deletion_tasks(production_cleaned,created_at);
