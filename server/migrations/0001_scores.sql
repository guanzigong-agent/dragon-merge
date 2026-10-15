CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  nickname_key TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash) = 64),
  best_score INTEGER NOT NULL CHECK(best_score > 0 AND best_score <= 1000000000 AND best_score % 20 = 0),
  reached_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_ranking ON players(best_score DESC, reached_at ASC, id ASC);
