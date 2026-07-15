from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends

from app.db import get_connection
from app.schemas import SyncAllResult, SyncResult
from app.services.sync import sync_feeds

router = APIRouter(prefix="/api", tags=["sync"])


@router.post("/sync", response_model=SyncAllResult)
async def sync_all(conn: sqlite3.Connection = Depends(get_connection)) -> SyncAllResult:
    rows = conn.execute("SELECT id, feed_url FROM feeds ORDER BY id ASC").fetchall()
    feeds = [(int(r["id"]), r["feed_url"]) for r in rows]
    raw = await sync_feeds(conn, feeds)
    results = [
        SyncResult(
            feed_id=fid,
            feed_url=url,
            ok=ok,
            inserted=inserted,
            error=error,
        )
        for fid, url, ok, inserted, error in raw
    ]
    ok_count = sum(1 for r in results if r.ok)
    fail_count = len(results) - ok_count
    inserted_total = sum(r.inserted for r in results)
    return SyncAllResult(
        results=results,
        ok_count=ok_count,
        fail_count=fail_count,
        inserted_total=inserted_total,
    )
