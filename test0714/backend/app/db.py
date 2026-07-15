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

            CREATE TABLE IF NOT EXISTS llm_providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agent_settings (
                agent_type TEXT PRIMARY KEY,
                provider_id INTEGER,
                model_name TEXT,
                target_language TEXT,
                detail_level TEXT,
                prompt_strategy TEXT,
                FOREIGN KEY (provider_id) REFERENCES llm_providers(id)
            );

            CREATE TABLE IF NOT EXISTS entry_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id INTEGER UNIQUE,
                summary_text TEXT NOT NULL,
                model_name TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS entry_translations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id INTEGER NOT NULL,
                paragraph_index INTEGER NOT NULL,
                original_text TEXT,
                translated_text TEXT,
                status TEXT,
                model_name TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
                UNIQUE (entry_id, paragraph_index)
            );

            CREATE TABLE IF NOT EXISTS llm_usages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_name TEXT,
                model_name TEXT,
                agent_type TEXT,
                prompt_tokens INTEGER,
                completion_tokens INTEGER,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_entry_translations_entry
                ON entry_translations(entry_id);
            CREATE INDEX IF NOT EXISTS idx_llm_usages_created
                ON llm_usages(created_at);

            CREATE TABLE IF NOT EXISTS entry_cleaned (
                entry_id INTEGER PRIMARY KEY,
                cleaned_html TEXT,
                cleaned_markdown TEXT,
                word_count INTEGER DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'success',
                source_hash TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS reading_preferences (
                id INTEGER PRIMARY KEY DEFAULT 1,
                theme TEXT NOT NULL DEFAULT 'light',
                font_size INTEGER NOT NULL DEFAULT 16,
                line_height REAL NOT NULL DEFAULT 1.6,
                font_family TEXT NOT NULL DEFAULT 'system',
                display_mode TEXT NOT NULL DEFAULT 'reader',
                split_ratio REAL NOT NULL DEFAULT 0.5,
                CHECK (id = 1)
            );
            """
        )
        _ensure_column(conn, "entries", "is_starred", "is_starred INTEGER NOT NULL DEFAULT 0")
        _ensure_column(
            conn,
            "entry_translations",
            "target_language",
            "target_language TEXT",
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_entries_is_starred ON entries(is_starred)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_entries_is_read ON entries(is_read)"
        )
        # Seed default agent settings if missing
        for agent_type, detail in (
            ("summary", "concise"),
            ("translation", None),
        ):
            row = conn.execute(
                "SELECT agent_type FROM agent_settings WHERE agent_type = ?",
                (agent_type,),
            ).fetchone()
            if not row:
                conn.execute(
                    """
                    INSERT INTO agent_settings
                    (agent_type, provider_id, model_name, target_language, detail_level, prompt_strategy)
                    VALUES (?, NULL, NULL, 'Chinese', ?, 'default')
                    """,
                    (agent_type, detail),
                )
        # Seed default reading preferences if missing
        prefs_row = conn.execute("SELECT id FROM reading_preferences WHERE id = 1").fetchone()
        if not prefs_row:
            conn.execute(
                "INSERT INTO reading_preferences (id) VALUES (1)"
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
