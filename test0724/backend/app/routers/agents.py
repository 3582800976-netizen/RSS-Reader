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
    ChatHistoryOut,
    ChatMessage,
    ChatRequest,
    TranslateRequest,
    TranslateRetryRequest,
    TranslationOut,
    TranslationParagraph,
)
from app.services.llm_client import chat_once, stream_chat
from app.services.prompts import resolve_qa_prompts, resolve_translation_prompts
from app.services.segmenter import html_to_plain, segment_from_cleaned, segment_html

router = APIRouter(prefix="/api/ai", tags=["ai-agents"])

TRANSLATE_CONCURRENCY = 5
MAX_CHAT_HISTORY = 20  # ~10 rounds of user/assistant pairs


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


def _get_entry_content(conn: sqlite3.Connection, entry: sqlite3.Row, entry_id: int) -> str:
    cleaned_row = conn.execute(
        "SELECT cleaned_markdown FROM entry_cleaned WHERE entry_id = ? AND status != 'failed'",
        (entry_id,),
    ).fetchone()
    if cleaned_row and cleaned_row["cleaned_markdown"]:
        content = cleaned_row["cleaned_markdown"]
        if len(content) > 20000:
            content = content[:20000] + "\n…"
        return content
    content = html_to_plain(entry["summary"], max_chars=8000)
    return content or ""


def _load_chat(conn: sqlite3.Connection, entry_id: int) -> list[dict[str, str]]:
    rows = conn.execute(
        """
        SELECT role, content FROM entry_chat_messages
        WHERE entry_id = ?
        ORDER BY seq ASC
        """,
        (entry_id,),
    ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in rows]


def _replace_chat_messages(
    db: sqlite3.Connection,
    entry_id: int,
    messages: list[dict[str, str]],
) -> None:
    now = _utc_now()
    db.execute("DELETE FROM entry_chat_messages WHERE entry_id = ?", (entry_id,))
    seq = 0
    for msg in messages:
        role = (msg.get("role") or "").strip().lower()
        text = (msg.get("content") or "").strip()
        if role not in {"user", "assistant"} or not text:
            continue
        db.execute(
            """
            INSERT INTO entry_chat_messages
            (entry_id, seq, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (entry_id, seq, role, text, now),
        )
        seq += 1
    db.commit()


@router.get("/chat/{entry_id}", response_model=ChatHistoryOut)
def get_chat_history(
    entry_id: int,
    conn: sqlite3.Connection = Depends(get_connection),
) -> ChatHistoryOut:
    _get_entry(conn, entry_id)
    messages = _load_chat(conn, entry_id)
    return ChatHistoryOut(
        entry_id=entry_id,
        messages=[
            ChatMessage(role=m["role"], content=m["content"]) for m in messages
        ],
    )


@router.delete("/chat/{entry_id}")
def clear_chat_history(
    entry_id: int,
    conn: sqlite3.Connection = Depends(get_connection),
) -> dict:
    _get_entry(conn, entry_id)
    conn.execute("DELETE FROM entry_chat_messages WHERE entry_id = ?", (entry_id,))
    conn.commit()
    return {"ok": True}


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
    if agent_type not in {"qa", "translation"}:
        raise HTTPException(status_code=400, detail="agent_type must be qa or translation")
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
            (agent_type, "concise" if agent_type == "qa" else None),
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


@router.post("/chat/stream")
async def stream_chat_endpoint(
    body: ChatRequest,
    conn: sqlite3.Connection = Depends(get_connection),
) -> StreamingResponse:
    entry = _get_entry(conn, body.entry_id)
    settings = conn.execute(
        "SELECT * FROM agent_settings WHERE agent_type = 'qa'"
    ).fetchone()
    detail = (settings["detail_level"] if settings else "concise") or "concise"

    content = _get_entry_content(conn, entry, body.entry_id)
    if not content:
        raise HTTPException(status_code=400, detail="该文章没有可用于问答的正文")

    system_prompt = resolve_qa_prompts(
        detail_level=detail,
        title=entry["title"] or "",
        content=content,
    )

    history: list[dict[str, str]] = []
    for msg in body.messages[-MAX_CHAT_HISTORY:]:
        role = (msg.role or "").strip().lower()
        text = (msg.content or "").strip()
        if role in {"user", "assistant"} and text:
            history.append({"role": role, "content": text})
    if not history or history[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="messages 必须以 user 消息结尾")

    async def event_gen():
        model_name = None
        assistant_text = ""
        db = connect()
        try:
            settings_row = db.execute(
                "SELECT model_name FROM agent_settings WHERE agent_type = 'qa'"
            ).fetchone()
            model_name = settings_row["model_name"] if settings_row else None
            async for delta in stream_chat(
                db,
                agent_type="qa",
                system_prompt=system_prompt,
                messages=history,
            ):
                assistant_text += delta
                yield f"data: {json.dumps({'type': 'delta', 'text': delta}, ensure_ascii=False)}\n\n"
            assistant_text = assistant_text.strip()
            if assistant_text:
                to_save: list[dict[str, str]] = []
                for msg in body.messages:
                    role = (msg.role or "").strip().lower()
                    text = (msg.content or "").strip()
                    if role in {"user", "assistant"} and text:
                        to_save.append({"role": role, "content": text})
                to_save.append({"role": "assistant", "content": assistant_text})
                _replace_chat_messages(db, body.entry_id, to_save)
            yield f"data: {json.dumps({'type': 'done', 'model_name': model_name}, ensure_ascii=False)}\n\n"
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


def _segment_entry_paragraphs(
    conn: sqlite3.Connection, entry: sqlite3.Row, entry_id: int
) -> list[str]:
    cleaned_row = conn.execute(
        "SELECT cleaned_html FROM entry_cleaned WHERE entry_id = ? AND status != 'failed'",
        (entry_id,),
    ).fetchone()
    if cleaned_row and cleaned_row["cleaned_html"]:
        return segment_from_cleaned(cleaned_row["cleaned_html"])
    return segment_html(entry["summary"])


def _save_translation_paragraph(
    db: sqlite3.Connection,
    *,
    entry_id: int,
    index: int,
    original: str,
    translated_text: str | None,
    status: str,
    model_name: str | None,
    language: str,
) -> None:
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
            entry_id,
            index,
            original,
            translated_text,
            status,
            model_name,
            _utc_now(),
            language,
        ),
    )
    db.commit()


@router.post("/translate", response_model=TranslationOut)
async def translate_entry(
    body: TranslateRequest,
    conn: sqlite3.Connection = Depends(get_connection),
) -> TranslationOut:
    """Non-streaming translate (compat). Prefer /translate/stream for UI."""
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

    paragraphs = _segment_entry_paragraphs(conn, entry, body.entry_id)
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

                _save_translation_paragraph(
                    db,
                    entry_id=body.entry_id,
                    index=index,
                    original=text,
                    translated_text=translated_text,
                    status=status,
                    model_name=model_name,
                    language=language,
                )
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


@router.post("/translate/stream")
async def stream_translate(
    body: TranslateRequest,
    conn: sqlite3.Connection = Depends(get_connection),
) -> StreamingResponse:
    """Stream paragraph translations via SSE. Format stays bilingual rows."""
    entry = _get_entry(conn, body.entry_id)
    settings = conn.execute(
        "SELECT * FROM agent_settings WHERE agent_type = 'translation'"
    ).fetchone()
    language = body.target_language or (settings["target_language"] if settings else "Chinese")
    strategy = (settings["prompt_strategy"] if settings else "default") or "default"
    default_model = settings["model_name"] if settings else None

    if not body.force:
        existing = _load_translation(conn, body.entry_id)
        if existing.paragraphs and (existing.target_language or "Chinese") == language:

            async def cached_gen():
                yield f"data: {json.dumps({'type': 'init', 'entry_id': body.entry_id, 'target_language': language, 'paragraphs': [p.model_dump() for p in existing.paragraphs], 'cached': True}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'cached': True, 'target_language': language}, ensure_ascii=False)}\n\n"

            return StreamingResponse(cached_gen(), media_type="text/event-stream")

    paragraphs = _segment_entry_paragraphs(conn, entry, body.entry_id)
    if not paragraphs:
        raise HTTPException(status_code=400, detail="该文章没有可用于翻译的段落")

    conn.execute("DELETE FROM entry_translations WHERE entry_id = ?", (body.entry_id,))
    conn.commit()

    pending = [
        {
            "paragraph_index": i,
            "original_text": text,
            "translated_text": "",
            "status": "pending",
            "model_name": None,
        }
        for i, text in enumerate(paragraphs)
    ]

    async def event_gen():
        queue: asyncio.Queue[dict | None] = asyncio.Queue()
        sem = asyncio.Semaphore(TRANSLATE_CONCURRENCY)

        async def translate_one(index: int, text: str) -> None:
            async with sem:
                db = connect()
                try:
                    try:
                        system_prompt, user_prompt = resolve_translation_prompts(
                            language=language,
                            content=text,
                            strategy=strategy,
                        )
                        collected: list[str] = []
                        model_name = default_model
                        async for delta in stream_chat(
                            db,
                            agent_type="translation",
                            system_prompt=system_prompt,
                            user_prompt=user_prompt,
                        ):
                            collected.append(delta)
                            await queue.put(
                                {
                                    "type": "delta",
                                    "paragraph_index": index,
                                    "text": delta,
                                }
                            )
                        translated_text = "".join(collected).strip()
                        status = "success"
                        settings_row = db.execute(
                            "SELECT model_name FROM agent_settings WHERE agent_type = 'translation'"
                        ).fetchone()
                        model_name = (
                            settings_row["model_name"] if settings_row else default_model
                        )
                    except Exception:  # noqa: BLE001
                        status = "failed"
                        translated_text = None
                        model_name = default_model

                    _save_translation_paragraph(
                        db,
                        entry_id=body.entry_id,
                        index=index,
                        original=text,
                        translated_text=translated_text,
                        status=status,
                        model_name=model_name,
                        language=language,
                    )
                    await queue.put(
                        {
                            "type": "paragraph",
                            "paragraph_index": index,
                            "original_text": text,
                            "translated_text": translated_text,
                            "status": status,
                            "model_name": model_name,
                        }
                    )
                finally:
                    db.close()

        async def run_all() -> None:
            try:
                await asyncio.gather(
                    *[translate_one(i, p) for i, p in enumerate(paragraphs)]
                )
            finally:
                await queue.put(None)

        yield f"data: {json.dumps({'type': 'init', 'entry_id': body.entry_id, 'target_language': language, 'paragraphs': pending, 'cached': False}, ensure_ascii=False)}\n\n"

        worker = asyncio.create_task(run_all())
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'cached': False, 'target_language': language}, ensure_ascii=False)}\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)}, ensure_ascii=False)}\n\n"
        finally:
            if not worker.done():
                worker.cancel()
                try:
                    await worker
                except asyncio.CancelledError:
                    pass

    return StreamingResponse(event_gen(), media_type="text/event-stream")


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
