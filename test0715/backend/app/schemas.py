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
    job_id: str = ""


# —— AI module ——


class ProviderCreate(BaseModel):
    name: str = Field(..., min_length=1)
    base_url: str = Field(..., min_length=1)
    api_key: Optional[str] = None
    is_active: bool = True


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    is_active: Optional[bool] = None


class ProviderOut(BaseModel):
    id: int
    name: str
    base_url: str
    api_key_set: bool
    is_active: bool
    created_at: str


class ProviderTestBody(BaseModel):
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: str = Field(..., min_length=1)
    provider_id: Optional[int] = None


class ProviderTestResult(BaseModel):
    ok: bool
    reply: Optional[str] = None
    error: Optional[str] = None


class AgentSettingsUpdate(BaseModel):
    provider_id: Optional[int] = None
    model_name: Optional[str] = None
    target_language: Optional[str] = None
    detail_level: Optional[str] = None
    prompt_strategy: Optional[str] = None


class AgentSettingsOut(BaseModel):
    agent_type: str
    provider_id: Optional[int] = None
    model_name: Optional[str] = None
    target_language: Optional[str] = None
    detail_level: Optional[str] = None
    prompt_strategy: Optional[str] = None


class SummaryRequest(BaseModel):
    entry_id: int
    target_language: Optional[str] = None
    detail_level: Optional[str] = None
    force: bool = False


class SummaryOut(BaseModel):
    entry_id: int
    summary_text: str
    model_name: Optional[str] = None
    target_language: Optional[str] = None
    created_at: Optional[str] = None
    cached: bool = False


class TranslateRequest(BaseModel):
    entry_id: int
    target_language: Optional[str] = None
    force: bool = False


class TranslateRetryRequest(BaseModel):
    entry_id: int
    paragraph_index: int
    original_text: Optional[str] = None
    target_language: Optional[str] = None


class TranslationParagraph(BaseModel):
    paragraph_index: int
    original_text: Optional[str] = None
    translated_text: Optional[str] = None
    status: str
    model_name: Optional[str] = None


class TranslationOut(BaseModel):
    entry_id: int
    paragraphs: list[TranslationParagraph]
    target_language: Optional[str] = None


class UsageOut(BaseModel):
    id: int
    provider_name: Optional[str] = None
    model_name: Optional[str] = None
    agent_type: Optional[str] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    created_at: str


class UsageSummaryOut(BaseModel):
    total_calls: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    by_agent: list[dict]
    by_model: list[dict]


class DailyUsagePoint(BaseModel):
    date: str
    calls: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class UsageDailyOut(BaseModel):
    days: list[DailyUsagePoint]


# —— Cleaning module ——


class CleanedOut(BaseModel):
    entry_id: int
    cleaned_html: Optional[str] = None
    cleaned_markdown: Optional[str] = None
    word_count: int = 0
    status: str = "success"
    title: Optional[str] = None
    byline: Optional[str] = None


# —— Reading Preferences ——


class ReadingPreferenceIn(BaseModel):
    theme: Optional[str] = None
    font_size: Optional[int] = None
    line_height: Optional[float] = None
    font_family: Optional[str] = None
    display_mode: Optional[str] = None
    split_ratio: Optional[float] = None


class ReadingPreferenceOut(BaseModel):
    theme: str = "light"
    font_size: int = 16
    line_height: float = 1.6
    font_family: str = "system"
    display_mode: str = "reader"
    split_ratio: float = 0.5
