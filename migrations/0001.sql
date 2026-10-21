PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profiles (
 id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0), assessment TEXT CHECK(assessment IS NULL OR json_valid(assessment)),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS knowledge_states (
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, node_id TEXT NOT NULL,
 level INTEGER CHECK(level IS NULL OR level BETWEEN 0 AND 4), evidence_type TEXT NOT NULL CHECK(evidence_type IN ('self','course','project','task','external')),
 evidence TEXT NOT NULL, learning_status TEXT NOT NULL CHECK(learning_status IN ('not_started','learning','paused')), conflict INTEGER NOT NULL DEFAULT 0 CHECK(conflict IN(0,1)),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(profile_id,node_id)
);
CREATE TABLE IF NOT EXISTS records (
 id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('snapshot','event','assessment','attempt','checkin','message','proposal','agentRun','idempotency')),
 parent_id TEXT, body TEXT NOT NULL CHECK(json_valid(body)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(profile_id,id)
);
CREATE TABLE IF NOT EXISTS paths (
 id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, topic_id TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 0 CHECK(active IN(0,1)), version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(profile_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_path ON paths(profile_id) WHERE active=1;
CREATE TABLE IF NOT EXISTS path_versions (
 id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, path_id TEXT NOT NULL, version INTEGER NOT NULL, body TEXT NOT NULL CHECK(json_valid(body)),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(path_id,version),
 FOREIGN KEY(profile_id,path_id) REFERENCES paths(profile_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS idempotency (
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, key TEXT NOT NULL, request_hash TEXT NOT NULL,
 body TEXT NOT NULL CHECK(json_valid(body)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(profile_id,key)
);
CREATE TABLE IF NOT EXISTS knowledge_releases (
 id TEXT PRIMARY KEY, hash TEXT NOT NULL, body TEXT NOT NULL CHECK(json_valid(body)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes (
 release_id TEXT NOT NULL REFERENCES knowledge_releases(id), id TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN('major','domain','subdomain','knowledge','skill','project')),
 body TEXT NOT NULL CHECK(json_valid(body)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(release_id,id)
);
CREATE TABLE IF NOT EXISTS edges (
 release_id TEXT NOT NULL, id TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL, type TEXT NOT NULL,
 body TEXT NOT NULL CHECK(json_valid(body)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK(from_id<>to_id), PRIMARY KEY(release_id,id),
 FOREIGN KEY(release_id,from_id) REFERENCES nodes(release_id,id), FOREIGN KEY(release_id,to_id) REFERENCES nodes(release_id,id)
);
