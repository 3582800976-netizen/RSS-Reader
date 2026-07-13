from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterator

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "app.db"


def get_db_path() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DB_PATH


def connect() -> sqlite3.Connection:
    path = get_db_path()
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    cols = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db() -> None:
    conn = connect()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS feeds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                feed_url TEXT NOT NULL UNIQUE,
                site_url TEXT,
                last_fetched_at TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feed_id INTEGER NOT NULL,
                guid TEXT NOT NULL,
                url TEXT,
                title TEXT NOT NULL,
                author TEXT,
                published_at TEXT,
                summary TEXT,
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
                UNIQUE (feed_id, guid)
            );

            CREATE INDEX IF NOT EXISTS idx_entries_feed_id ON entries(feed_id);
            CREATE INDEX IF NOT EXISTS idx_entries_published_at ON entries(published_at);
            """
        )
        _ensure_column(conn, "entries", "is_starred", "is_starred INTEGER NOT NULL DEFAULT 0")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_entries_is_starred ON entries(is_starred)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_entries_is_read ON entries(is_read)"
        )
        conn.commit()
    finally:
        conn.close()


def get_connection() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
