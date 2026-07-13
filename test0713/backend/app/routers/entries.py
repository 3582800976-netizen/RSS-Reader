from __future__ import annotations

import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import get_connection
from app.schemas import EntryOut, EntryUpdate, MarkReadBody, MarkReadResult

router = APIRouter(prefix="/api/entries", tags=["entries"])


def _row_to_entry(row: sqlite3.Row) -> EntryOut:
    keys = row.keys()
    return EntryOut(
        id=row["id"],
        feed_id=row["feed_id"],
        guid=row["guid"],
        url=row["url"],
        title=row["title"],
        author=row["author"],
        published_at=row["published_at"],
        summary=row["summary"],
        is_read=bool(row["is_read"]),
        is_starred=bool(row["is_starred"]) if "is_starred" in keys else False,
        created_at=row["created_at"],
        feed_title=row["feed_title"] if "feed_title" in keys else None,
    )


@router.get("", response_model=list[EntryOut])
def list_entries(
    feed_id: Optional[int] = None,
    is_read: Optional[bool] = None,
    is_starred: Optional[bool] = None,
    q: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    conn: sqlite3.Connection = Depends(get_connection),
) -> list[EntryOut]:
    clauses: list[str] = []
    params: list[object] = []
    if feed_id is not None:
        clauses.append("e.feed_id = ?")
        params.append(feed_id)
    if is_read is not None:
        clauses.append("e.is_read = ?")
        params.append(1 if is_read else 0)
    if is_starred is not None:
        clauses.append("e.is_starred = ?")
        params.append(1 if is_starred else 0)
    if q is not None and q.strip():
        clauses.append("(e.title LIKE ? OR IFNULL(e.summary, '') LIKE ?)")
        like = f"%{q.strip()}%"
        params.extend([like, like])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.extend([limit, offset])
    rows = conn.execute(
        f"""
        SELECT e.*, f.title AS feed_title
        FROM entries e
        JOIN feeds f ON f.id = e.feed_id
        {where}
        ORDER BY COALESCE(e.published_at, e.created_at) DESC, e.id DESC
        LIMIT ? OFFSET ?
        """,
        params,
    ).fetchall()
    return [_row_to_entry(r) for r in rows]


@router.post("/mark-read", response_model=MarkReadResult)
def mark_all_read(
    body: MarkReadBody,
    conn: sqlite3.Connection = Depends(get_connection),
) -> MarkReadResult:
    if body.feed_id is not None:
        cur = conn.execute(
            "UPDATE entries SET is_read = 1 WHERE is_read = 0 AND feed_id = ?",
            (body.feed_id,),
        )
    else:
        cur = conn.execute("UPDATE entries SET is_read = 1 WHERE is_read = 0")
    conn.commit()
    return MarkReadResult(updated=cur.rowcount)


@router.get("/{entry_id}", response_model=EntryOut)
def get_entry(
    entry_id: int,
    conn: sqlite3.Connection = Depends(get_connection),
) -> EntryOut:
    row = conn.execute(
        """
        SELECT e.*, f.title AS feed_title
        FROM entries e
        JOIN feeds f ON f.id = e.feed_id
        WHERE e.id = ?
        """,
        (entry_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")
    return _row_to_entry(row)


@router.patch("/{entry_id}", response_model=EntryOut)
def update_entry(
    entry_id: int,
    body: EntryUpdate,
    conn: sqlite3.Connection = Depends(get_connection),
) -> EntryOut:
    row = conn.execute("SELECT id FROM entries WHERE id = ?", (entry_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")
    if body.is_read is not None:
        conn.execute(
            "UPDATE entries SET is_read = ? WHERE id = ?",
            (1 if body.is_read else 0, entry_id),
        )
    if body.is_starred is not None:
        conn.execute(
            "UPDATE entries SET is_starred = ? WHERE id = ?",
            (1 if body.is_starred else 0, entry_id),
        )
    conn.commit()
    return get_entry(entry_id, conn)
