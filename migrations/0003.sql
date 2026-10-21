CREATE TABLE instance_budgets (
 id TEXT PRIMARY KEY,
 day TEXT NOT NULL,
 model_calls INTEGER NOT NULL CHECK(model_calls>=0),
 search_calls INTEGER NOT NULL CHECK(search_calls>=0),
 status TEXT NOT NULL CHECK(status IN ('pending','complete')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX instance_budgets_day ON instance_budgets(day);
