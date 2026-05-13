from pathlib import Path
import sqlite3


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "tibiascope.db"


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  world TEXT NOT NULL,
  vocation TEXT NOT NULL,
  guild TEXT,
  residence TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  experience INTEGER NOT NULL DEFAULT 0,
  last_login TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS character_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  snapshot_date TEXT NOT NULL,
  world TEXT NOT NULL,
  vocation TEXT NOT NULL,
  level INTEGER NOT NULL,
  experience INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'collector',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(character_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS highscore_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  world TEXT NOT NULL,
  category TEXT NOT NULL,
  vocation_filter TEXT NOT NULL,
  rank INTEGER NOT NULL,
  character_name TEXT NOT NULL,
  character_vocation TEXT NOT NULL,
  level INTEGER NOT NULL,
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(snapshot_date, world, category, vocation_filter, rank, character_name)
);

CREATE TABLE IF NOT EXISTS guild_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  guild_name TEXT NOT NULL,
  world TEXT,
  member_name TEXT NOT NULL,
  member_vocation TEXT,
  member_level INTEGER,
  member_experience INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(snapshot_date, guild_name, member_name)
);

CREATE TABLE IF NOT EXISTS collection_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_character_snapshots_character_date
  ON character_snapshots(character_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_highscore_snapshots_lookup
  ON highscore_snapshots(world, category, vocation_filter, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_guild_snapshots_guild_date
  ON guild_snapshots(guild_name, snapshot_date);
"""


def main() -> None:
  DB_PATH.parent.mkdir(parents=True, exist_ok=True)
  with sqlite3.connect(DB_PATH) as conn:
    conn.executescript(SCHEMA)
    conn.commit()
  print(f"Banco pronto em: {DB_PATH}")


if __name__ == "__main__":
  main()
