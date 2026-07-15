from __future__ import annotations

import asyncio
import json
import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.db import connect, get_connection
from app.schemas import (
    AgentSettingsOut,
    AgentSettingsUpdate,
    SummaryOut,
    SummaryRequest,
    TranslateRequest,
    TranslateRetryRequest,
    TranslationOut,
    TranslationParagraph,
)
from app.services.llm_client import chat_once, stream_chat
from app.services.prompts import resolve_summary_prompts, resolve_translation_prompts
from app.services.segmenter import html_to_plain, segment_from_cleaned, segment_html

router = APIRouter(prefix="/api/ai", tags=["ai-agents"])

TRANSLATE_CONCURRENCY = 5


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _settings_out(row: sqlite3.Row) -> AgentSettingsOut:
    return AgentSettingsOut(
        agent_type=row["agent_type"],
        provider_id=row["provider_id"],
        model_name=row["model_name"],
        target_language=row["target_language"],
        detail_level=row["detail_level"],
        prompt_strategy=row["prompt_strategy"],
    )


def _get_entry(conn: sqlite3.Connection, entry_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")
    return row


@router.get("/settings", response_model=list[AgentSettingsOut])
def list_settings(conn: sqlite3.Connection = Depends(get_connection)) -> list[AgentSettingsOut]:
    rows = conn.execute(
        "SELECT * FROM agent_settings ORDER BY agent_type ASC"
    ).fetchall()
    return [_settings_out(r) for r in rows]


@router.put("/settings/{agent_type}", response_model=AgentSettingsOut)
def update_settings(
    agent_type: str,
    body: AgentSettingsUpdate,
    conn: sqlite3.Connection = Depends(get_connection),
) -> AgentSettingsOut:
    if agent_type not in {"summary", "translation"}:
        raise HTTPException(status_code=400, detail="agent_type must be summary or translation")
    row = conn.execute(
        "SELECT * FROM agent_settings WHERE agent_type = ?", (agent_type,)
    ).fetchone()
    if not row:
        conn.execute(
            """
            INSERT INTO agent_settings
            (agent_type, provider_id, model_name, target_language, detail_level, prompt_strategy)
            VALUES (?, NULL, NULL, 'Chinese', ?, 'default')
            """,
            (agent_type, "concise" if agent_type == "summary" else None),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM agent_settings WHERE agent_type = ?", (agent_type,)
        ).fetchone()

    provider_id = body.provider_id if body.provider_id is not None else row["provider_id"]
    model_name = body.model_name if body.model_name is not None else row["model_name"]
    target_language = (
        body.target_language if body.target_language is not None else row["target_language"]
    )
    detail_level = body.detail_level if body.detail_level is not None else row["detail_level"]
    prompt_strategy = (
        body.prompt_strategy if body.prompt_strategy is not None else row["prompt_strategy"]
    )

    if provider_id is not None:
        exists = conn.execute(
            "SELECT id FROM llm_providers WHERE id = ?", (provider_id,)
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=400, detail="provider_id not found")

    conn.execute(
        """
        UPDATE agent_settings
        SET provider_id = ?, model_name = ?, target_language = ?,
            detail_level = ?, prompt_strategy = ?
        WHERE agent_type = ?
        """,
        (provider_id, model_name, target_language, detail_level, prompt_strategy, agent_type),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM agent_settings WHERE agent_type = ?", (agent_type,)
    ).fetchone()
    return _settings_out(row)


@router.get("/summary/{entry_id}", response_model=SummaryOut)
def get_summary(
    entry_id: int,
    conn: sqlite3.Connection = Depends(get_connection),
) -> SummaryOut:
    _get_entry(conn, entry_id)
    row = conn.execute(
        "SELECT * FROM entry_summaries WHERE entry_id = ?", (entry_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Summary not found")
    return SummaryOut(
        entry_id=entry_id,
        summary_text=row["summary_text"],
        model_name=row["model_name"],
        target_language=(
            row["target_language"] if "target_language" in row.keys() else None
        ),
        created_at=row["created_at"],
        cached=True,
    )


@router.post("/summary/stream")
async def stream_summary(
    body: SummaryRequest,
    conn: sqlite3.Connection = Depends(get_connection),
) -> StreamingResponse:
    entry = _get_entry(conn, body.entry_id)
    settings = conn.execute(
        "SELECT * FROM agent_settings WHERE agent_type = 'summary'"
    ).fetchone()
    language = body.target_language or (settings["target_language"] if settings else "Chinese")
    detail = body.detail_level or (settings["detail_level"] if settings else "concise") or "concise"

    if not body.force:
        cached = conn.execute(
            "SELECT * FROM entry_summaries WHERE entry_id = ?", (body.entry_id,)
        ).fetchone()
        cached_lang = (
            cached["target_language"]
            if cached and "target_language" in cached.keys()
            else None
        )
        if cached and (cached_lang is None or cached_lang == language):

            async def cached_gen():
                text = cached["summary_text"]
                # Emit as SSE chunks so frontend can reuse the same parser
                chunk_size = 80
                for i in range(0, len(text), chunk_size):
                    yield f"data: {json.dumps({'type': 'delta', 'text': text[i:i+chunk_size]}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'cached': True, 'model_name': cached['model_name'], 'target_language': cached_lang or language}, ensure_ascii=False)}\n\n"

            return StreamingResponse(cached_gen(), media_type="text/event-stream")

    # Prefer cleaned markdown from content cleaning pipeline
    cleaned_row = conn.execute(
        "SELECT cleaned_markdown FROM entry_cleaned WHERE entry_id = ? AND status != 'failed'",
        (body.entry_id,),
    ).fetchone()
    if cleaned_row and cleaned_row["cleaned_markdown"]:
        content = cleaned_row["cleaned_markdown"]
        if len(content) > 20000:
            content = content[:20000] + "\n…"
    else:
        # Fallback: extract plain text from raw summary
        content = html_to_plain(entry["summary"], max_chars=8000)
    if not content:
        raise HTTPException(status_code=400, detail="该文章没有可用于摘要的正文")

    system_prompt, user_prompt = resolve_summary_prompts(
        language=language,
        detail_level=detail,
        title=entry["title"] or "",
        content=content,
    )

    async def event_gen():
        collected: list[str] = []
        model_name = None
        db = connect()
        try:
            settings_row = db.execute(
                "SELECT model_name FROM agent_settings WHERE agent_type = 'summary'"
            ).fetchone()
            model_name = settings_row["model_name"] if settings_row else None
            async for delta in stream_chat(
                db,
                agent_type="summary",
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            ):
                collected.append(delta)
                yield f"data: {json.dumps({'type': 'delta', 'text': delta}, ensure_ascii=False)}\n\n"
            full = "".join(collected).strip()
            if full:
                db.execute(
                    """
                    INSERT INTO entry_summaries
                    (entry_id, summary_text, model_name, target_language, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(entry_id) DO UPDATE SET
                        summary_text = excluded.summary_text,
                        model_name = excluded.model_name,
                        target_language = excluded.target_language,
                        created_at = excluded.created_at
                    """,
                    (body.entry_id, full, model_name, language, _utc_now()),
                )
                db.commit()
            yield f"data: {json.dumps({'type': 'done', 'cached': False, 'model_name': model_name, 'target_language': language}, ensure_ascii=False)}\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)}, ensure_ascii=False)}\n\n"
        finally:
            db.close()

    return StreamingResponse(event_gen(), media_type="text/event-stream")


def _load_translation(conn: sqlite3.Connection, entry_id: int) -> TranslationOut:
    rows = conn.execute(
        """
        SELECT * FROM entry_translations
        WHERE entry_id = ?
        ORDER BY paragraph_index ASC
        """,
        (entry_id,),
    ).fetchall()
    stored_lang = None
    if rows:
        keys = rows[0].keys()
        if "target_language" in keys and rows[0]["target_language"]:
            stored_lang = rows[0]["target_language"]
    if not stored_lang:
        settings = conn.execute(
            "SELECT target_language FROM agent_settings WHERE agent_type = 'translation'"
        ).fetchone()
        stored_lang = settings["target_language"] if settings else None
    return TranslationOut(
        entry_id=entry_id,
        target_language=stored_lang,
        paragraphs=[
            TranslationParagraph(
                paragraph_index=r["paragraph_index"],
                original_text=r["original_text"],
                translated_text=r["translated_text"],
                status=r["status"],
                model_name=r["model_name"],
            )
            for r in rows
        ],
    )


@router.get("/translate/{entry_id}", response_model=TranslationOut)
def get_translation(
    entry_id: int,
    conn: sqlite3.Connection = Depends(get_connection),
) -> TranslationOut:
    _get_entry(conn, entry_id)
    out = _load_translation(conn, entry_id)
    if not out.paragraphs:
        raise HTTPException(status_code=404, detail="Translation not found")
    return out


@router.delete("/translate/{entry_id}")
def clear_translation(
    entry_id: int,
    conn: sqlite3.Connection = Depends(get_connection),
) -> dict:
    _get_entry(conn, entry_id)
    conn.execute("DELETE FROM entry_translations WHERE entry_id = ?", (entry_id,))
    conn.commit()
    return {"ok": True}


@router.post("/translate", response_model=TranslationOut)
async def translate_entry(
    body: TranslateRequest,
    conn: sqlite3.Connection = Depends(get_connection),
) -> TranslationOut:
    entry = _get_entry(conn, body.entry_id)
    settings = conn.execute(
        "SELECT * FROM agent_settings WHERE agent_type = 'translation'"
    ).fetchone()
    language = body.target_language or (settings["target_language"] if settings else "Chinese")
    strategy = (settings["prompt_strategy"] if settings else "default") or "default"

    if not body.force:
        existing = _load_translation(conn, body.entry_id)
        if existing.paragraphs and (existing.target_language or "Chinese") == language:
            return existing

    # Prefer cleaned HTML from content cleaning pipeline for better segmentation
    cleaned_row = conn.execute(
        "SELECT cleaned_html FROM entry_cleaned WHERE entry_id = ? AND status != 'failed'",
        (body.entry_id,),
    ).fetchone()
    if cleaned_row and cleaned_row["cleaned_html"]:
        paragraphs = segment_from_cleaned(cleaned_row["cleaned_html"])
    else:
        # Fallback: segment raw summary HTML
        paragraphs = segment_html(entry["summary"])
    if not paragraphs:
        raise HTTPException(status_code=400, detail="该文章没有可用于翻译的段落")

    conn.execute("DELETE FROM entry_translations WHERE entry_id = ?", (body.entry_id,))
    conn.commit()

    sem = asyncio.Semaphore(TRANSLATE_CONCURRENCY)

    async def translate_one(index: int, text: str) -> TranslationParagraph:
        async with sem:
            db = connect()
            try:
                try:
                    system_prompt, user_prompt = resolve_translation_prompts(
                        language=language,
                        content=text,
                        strategy=strategy,
                    )
                    translated, model_name = await chat_once(
                        db,
                        agent_type="translation",
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                    )
                    status = "success"
                    translated_text = translated
                except Exception:  # noqa: BLE001
                    status = "failed"
                    translated_text = None
                    model_name = settings["model_name"] if settings else None

                db.execute(
                    """
                    INSERT INTO entry_translations
                    (entry_id, paragraph_index, original_text, translated_text, status, model_name, updated_at, target_language)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(entry_id, paragraph_index) DO UPDATE SET
                        original_text = excluded.original_text,
                        translated_text = excluded.translated_text,
                        status = excluded.status,
                        model_name = excluded.model_name,
                        updated_at = excluded.updated_at,
                        target_language = excluded.target_language
                    """,
                    (
                        body.entry_id,
                        index,
                        text,
                        translated_text,
                        status,
                        model_name,
                        _utc_now(),
                        language,
                    ),
                )
                db.commit()
                return TranslationParagraph(
                    paragraph_index=index,
                    original_text=text,
                    translated_text=translated_text,
                    status=status,
                    model_name=model_name,
                )
            finally:
                db.close()

    results = await asyncio.gather(
        *[translate_one(i, p) for i, p in enumerate(paragraphs)]
    )
    results_sorted = sorted(results, key=lambda x: x.paragraph_index)
    return TranslationOut(
        entry_id=body.entry_id,
        paragraphs=results_sorted,
        target_language=language,
    )


@router.post("/translate/retry", response_model=TranslationParagraph)
async def retry_paragraph(
    body: TranslateRetryRequest,
    conn: sqlite3.Connection = Depends(get_connection),
) -> TranslationParagraph:
    _get_entry(conn, body.entry_id)
    settings = conn.execute(
        "SELECT * FROM agent_settings WHERE agent_type = 'translation'"
    ).fetchone()
    language = body.target_language or (settings["target_language"] if settings else "Chinese")
    strategy = (settings["prompt_strategy"] if settings else "default") or "default"

    row = conn.execute(
        """
        SELECT * FROM entry_translations
        WHERE entry_id = ? AND paragraph_index = ?
        """,
        (body.entry_id, body.paragraph_index),
    ).fetchone()
    original = body.original_text or (row["original_text"] if row else None)
    if not original:
        raise HTTPException(status_code=400, detail="original_text required")

    try:
        system_prompt, user_prompt = resolve_translation_prompts(
            language=language,
            content=original,
            strategy=strategy,
        )
        translated, model_name = await chat_once(
            conn,
            agent_type="translation",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
        status = "success"
        translated_text = translated
    except Exception as exc:  # noqa: BLE001
        status = "failed"
        translated_text = None
        model_name = settings["model_name"] if settings else None
        raise HTTPException(status_code=502, detail=f"翻译失败: {exc}") from exc

    conn.execute(
        """
        INSERT INTO entry_translations
        (entry_id, paragraph_index, original_text, translated_text, status, model_name, updated_at, target_language)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(entry_id, paragraph_index) DO UPDATE SET
            original_text = excluded.original_text,
            translated_text = excluded.translated_text,
            status = excluded.status,
            model_name = excluded.model_name,
            updated_at = excluded.updated_at,
            target_language = excluded.target_language
        """,
        (
            body.entry_id,
            body.paragraph_index,
            original,
            translated_text,
            status,
            model_name,
            _utc_now(),
            language,
        ),
    )
    conn.commit()
    return TranslationParagraph(
        paragraph_index=body.paragraph_index,
        original_text=original,
        translated_text=translated_text,
        status=status,
        model_name=model_name,
    )
