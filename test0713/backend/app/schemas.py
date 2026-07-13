from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class FeedCreate(BaseModel):
    feed_url: str = Field(..., min_length=1)


class FeedOut(BaseModel):
    id: int
    title: str
    feed_url: str
    site_url: Optional[str] = None
    last_fetched_at: Optional[str] = None
    created_at: str
    unread_count: int = 0


class EntryOut(BaseModel):
    id: int
    feed_id: int
    guid: str
    url: Optional[str] = None
    title: str
    author: Optional[str] = None
    published_at: Optional[str] = None
    summary: Optional[str] = None
    is_read: bool
    is_starred: bool = False
    created_at: str
    feed_title: Optional[str] = None


class EntryUpdate(BaseModel):
    is_read: Optional[bool] = None
    is_starred: Optional[bool] = None


class MarkReadBody(BaseModel):
    feed_id: Optional[int] = None


class MarkReadResult(BaseModel):
    updated: int


class StatsOut(BaseModel):
    feed_count: int
    entry_count: int
    unread_count: int
    starred_count: int
    last_synced_at: Optional[str] = None


class SyncResult(BaseModel):
    feed_id: int
    feed_url: str
    ok: bool
    inserted: int = 0
    error: Optional[str] = None


class SyncAllResult(BaseModel):
    results: list[SyncResult]
    ok_count: int
    fail_count: int
    inserted_total: int


class ImportResult(BaseModel):
    imported: int
    skipped: int
    feed_ids: list[int]
