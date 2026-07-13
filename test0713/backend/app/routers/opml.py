from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response

from app.db import get_connection
from app.schemas import ImportResult
from app.services.opml import OPMLFeed, export_opml, parse_opml
from app.services.sync import utc_now

router = APIRouter(prefix="/api/opml", tags=["opml"])


@router.post("/import", response_model=ImportResult)
async def import_opml(
    file: UploadFile = File(...),
    conn: sqlite3.Connection = Depends(get_connection),
) -> ImportResult:
    raw = await file.read()
    feeds = parse_opml(raw)
    imported = 0
    skipped = 0
    feed_ids: list[int] = []
    now = utc_now()
    for item in feeds:
        existing = conn.execute(
            "SELECT id FROM feeds WHERE feed_url = ?", (item.feed_url,)
        ).fetchone()
        if existing:
            skipped += 1
            feed_ids.append(int(existing["id"]))
            continue
        cur = conn.execute(
            """
            INSERT INTO feeds (title, feed_url, site_url, last_fetched_at, created_at)
            VALUES (?, ?, ?, NULL, ?)
            """,
            (item.title, item.feed_url, item.site_url, now),
        )
        feed_ids.append(int(cur.lastrowid))
        imported += 1
    conn.commit()
    return ImportResult(imported=imported, skipped=skipped, feed_ids=feed_ids)


@router.get("/export")
def export_opml_file(conn: sqlite3.Connection = Depends(get_connection)) -> Response:
    rows = conn.execute(
        "SELECT title, feed_url, site_url FROM feeds ORDER BY id ASC"
    ).fetchall()
    feeds = [
        OPMLFeed(title=r["title"], feed_url=r["feed_url"], site_url=r["site_url"])
        for r in rows
    ]
    xml = export_opml(feeds)
    return Response(
        content=xml,
        media_type="text/xml; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="subscriptions.opml"'},
    )
