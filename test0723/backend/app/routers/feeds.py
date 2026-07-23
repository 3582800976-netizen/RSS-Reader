from __future__ import annotations

import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_connection
from app.schemas import FeedCreate, FeedOut, SyncResult
from app.services.feed_parser import fetch_and_parse
from app.services.sync import insert_entries, sync_feed, utc_now

router = APIRouter(prefix="/api/feeds", tags=["feeds"])


def _row_to_feed(row: sqlite3.Row) -> FeedOut:
    return FeedOut(
        id=row["id"],
        title=row["title"],
        feed_url=row["feed_url"],
        site_url=row["site_url"],
        last_fetched_at=row["last_fetched_at"],
        created_at=row["created_at"],
        unread_count=row["unread_count"] if "unread_count" in row.keys() else 0,
    )


@router.get("", response_model=list[FeedOut])
def list_feeds(conn: sqlite3.Connection = Depends(get_connection)) -> list[FeedOut]:
    rows = conn.execute(
        """
        SELECT f.*,
               COALESCE((
                   SELECT COUNT(*) FROM entries e
                   WHERE e.feed_id = f.id AND e.is_read = 0
               ), 0) AS unread_count
        FROM feeds f
        ORDER BY f.id ASC
        """
    ).fetchall()
    return [_row_to_feed(r) for r in rows]


@router.post("", response_model=FeedOut)
async def add_feed(
    body: FeedCreate,
    conn: sqlite3.Connection = Depends(get_connection),
) -> FeedOut:
    feed_url = body.feed_url.strip()
    if not feed_url:
        raise HTTPException(status_code=400, detail="feed_url is required")

    existing = conn.execute(
        "SELECT id FROM feeds WHERE feed_url = ?", (feed_url,)
    ).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="Feed already exists")

    try:
        parsed = await fetch_and_parse(feed_url)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to fetch/parse feed: {exc}") from exc

    now = utc_now()
    cur = conn.execute(
        """
        INSERT INTO feeds (title, feed_url, site_url, last_fetched_at, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (parsed.title, feed_url, parsed.site_url, now, now),
    )
    feed_id = int(cur.lastrowid)
    insert_entries(conn, feed_id, parsed)
    conn.commit()

    row = conn.execute(
        """
        SELECT f.*, 0 AS unread_count FROM feeds f WHERE f.id = ?
        """,
        (feed_id,),
    ).fetchone()
    # recompute unread
    unread = conn.execute(
        "SELECT COUNT(*) AS c FROM entries WHERE feed_id = ? AND is_read = 0",
        (feed_id,),
    ).fetchone()["c"]
    out = _row_to_feed(row)
    out.unread_count = int(unread)
    return out


@router.delete("/{feed_id}")
def delete_feed(
    feed_id: int,
    conn: sqlite3.Connection = Depends(get_connection),
) -> dict:
    cur = conn.execute("DELETE FROM feeds WHERE id = ?", (feed_id,))
    conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Feed not found")
    return {"ok": True}


@router.post("/{feed_id}/sync", response_model=SyncResult)
async def sync_one(
    feed_id: int,
    conn: sqlite3.Connection = Depends(get_connection),
) -> SyncResult:
    row = conn.execute(
        "SELECT id, feed_url FROM feeds WHERE id = ?", (feed_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Feed not found")
    ok, inserted, error = await sync_feed(conn, row["id"], row["feed_url"])
    return SyncResult(
        feed_id=row["id"],
        feed_url=row["feed_url"],
        ok=ok,
        inserted=inserted,
        error=error,
    )
