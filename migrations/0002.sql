CREATE TABLE IF NOT EXISTS service_preferences (
 profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
 body TEXT NOT NULL CHECK(json_valid(body)), revision INTEGER NOT NULL DEFAULT 0,
 consent_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS external_requests (
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, key TEXT NOT NULL,
 request_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','complete')),
 body TEXT CHECK(body IS NULL OR json_valid(body)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(profile_id,key)
);
CREATE TABLE IF NOT EXISTS search_cache (
 key TEXT PRIMARY KEY, provider TEXT NOT NULL, body TEXT NOT NULL CHECK(json_valid(body)),
 retrieved_at TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
