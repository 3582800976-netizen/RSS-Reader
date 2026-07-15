from __future__ import annotations

import sqlite3
from dataclasses import dataclass


@dataclass
class ReadingPreferences:
    theme: str = "light"
    font_size: int = 16
    line_height: float = 1.6
    font_family: str = "system"
    display_mode: str = "reader"
    split_ratio: float = 0.5


def get_preferences(conn: sqlite3.Connection) -> ReadingPreferences:
    row = conn.execute("SELECT * FROM reading_preferences WHERE id = 1").fetchone()
    if not row:
        conn.execute("INSERT INTO reading_preferences (id) VALUES (1)")
        conn.commit()
        return ReadingPreferences()
    return ReadingPreferences(
        theme=row["theme"] or "light",
        font_size=row["font_size"] or 16,
        line_height=row["line_height"] or 1.6,
        font_family=row["font_family"] or "system",
        display_mode=row["display_mode"] or "reader",
        split_ratio=row["split_ratio"] or 0.5,
    )


def save_preferences(
    conn: sqlite3.Connection,
    prefs: ReadingPreferences,
) -> ReadingPreferences:
    conn.execute(
        """
        INSERT INTO reading_preferences
            (id, theme, font_size, line_height, font_family, display_mode, split_ratio)
        VALUES (1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            theme = excluded.theme,
            font_size = excluded.font_size,
            line_height = excluded.line_height,
            font_family = excluded.font_family,
            display_mode = excluded.display_mode,
            split_ratio = excluded.split_ratio
        """,
        (
            prefs.theme,
            prefs.font_size,
            prefs.line_height,
            prefs.font_family,
            prefs.display_mode,
            prefs.split_ratio,
        ),
    )
    conn.commit()
    return prefs
