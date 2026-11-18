-- Real feedback storage. No demo merchants or credentials are seeded.
CREATE TABLE IF NOT EXISTS portal_merchants(
 id TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1))
);
CREATE TABLE IF NOT EXISTS portal_feedback(
 id TEXT PRIMARY KEY, tourist_id TEXT NOT NULL, merchant_id TEXT NOT NULL REFERENCES portal_merchants(id),
 category TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, request_id TEXT NOT NULL,
 UNIQUE(tourist_id,request_id)
);
CREATE INDEX IF NOT EXISTS portal_feedback_merchant ON portal_feedback(merchant_id,created_at);
CREATE INDEX IF NOT EXISTS portal_feedback_tourist ON portal_feedback(tourist_id,created_at);
CREATE TABLE IF NOT EXISTS portal_replies(
 id TEXT PRIMARY KEY, feedback_id TEXT NOT NULL REFERENCES portal_feedback(id), actor_id TEXT NOT NULL,
 actor_role TEXT NOT NULL CHECK(actor_role IN('merchant','government')), body TEXT NOT NULL,
 created_at TEXT NOT NULL, request_id TEXT NOT NULL, UNIQUE(actor_id,request_id)
);
CREATE INDEX IF NOT EXISTS portal_replies_item ON portal_replies(feedback_id,created_at);
