from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_connection
from app.schemas import (
    ProviderCreate,
    ProviderOut,
    ProviderTestBody,
    ProviderTestResult,
    ProviderUpdate,
)
from app.services.llm_client import test_provider

router = APIRouter(prefix="/api/ai/providers", tags=["ai-providers"])


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_provider(row: sqlite3.Row) -> ProviderOut:
    keys = row.keys()
    return ProviderOut(
        id=row["id"],
        name=row["name"],
        base_url=row["base_url"],
        api_key_set=bool(row["api_key"]),
        model_name=(row["model_name"] if "model_name" in keys else None) or None,
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
    )


@router.get("", response_model=list[ProviderOut])
def list_providers(conn: sqlite3.Connection = Depends(get_connection)) -> list[ProviderOut]:
    rows = conn.execute(
        "SELECT * FROM llm_providers ORDER BY id ASC"
    ).fetchall()
    return [_row_to_provider(r) for r in rows]


@router.post("", response_model=ProviderOut)
def create_provider(
    body: ProviderCreate,
    conn: sqlite3.Connection = Depends(get_connection),
) -> ProviderOut:
    model_name = (body.model_name or "").strip() or None
    cur = conn.execute(
        """
        INSERT INTO llm_providers (name, base_url, api_key, model_name, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            body.name.strip(),
            body.base_url.strip().rstrip("/"),
            body.api_key,
            model_name,
            1 if body.is_active else 0,
            _utc_now(),
        ),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM llm_providers WHERE id = ?", (cur.lastrowid,)
    ).fetchone()
    return _row_to_provider(row)


@router.patch("/{provider_id}", response_model=ProviderOut)
def update_provider(
    provider_id: int,
    body: ProviderUpdate,
    conn: sqlite3.Connection = Depends(get_connection),
) -> ProviderOut:
    row = conn.execute(
        "SELECT * FROM llm_providers WHERE id = ?", (provider_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Provider not found")

    keys = row.keys()
    name = body.name.strip() if body.name is not None else row["name"]
    base_url = (
        body.base_url.strip().rstrip("/") if body.base_url is not None else row["base_url"]
    )
    api_key = body.api_key if body.api_key is not None else row["api_key"]
    existing_model = row["model_name"] if "model_name" in keys else None
    model_name = (
        (body.model_name.strip() or None)
        if body.model_name is not None
        else existing_model
    )
    is_active = (
        (1 if body.is_active else 0) if body.is_active is not None else row["is_active"]
    )
    conn.execute(
        """
        UPDATE llm_providers
        SET name = ?, base_url = ?, api_key = ?, model_name = ?, is_active = ?
        WHERE id = ?
        """,
        (name, base_url, api_key, model_name, is_active, provider_id),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM llm_providers WHERE id = ?", (provider_id,)
    ).fetchone()
    return _row_to_provider(row)


@router.delete("/{provider_id}")
def delete_provider(
    provider_id: int,
    conn: sqlite3.Connection = Depends(get_connection),
) -> dict:
    row = conn.execute(
        "SELECT id FROM llm_providers WHERE id = ?", (provider_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Provider not found")
    conn.execute(
        "UPDATE agent_settings SET provider_id = NULL WHERE provider_id = ?",
        (provider_id,),
    )
    conn.execute("DELETE FROM llm_providers WHERE id = ?", (provider_id,))
    conn.commit()
    return {"ok": True}


@router.post("/test", response_model=ProviderTestResult)
async def test_provider_endpoint(
    body: ProviderTestBody,
    conn: sqlite3.Connection = Depends(get_connection),
) -> ProviderTestResult:
    base_url = body.base_url
    api_key = body.api_key
    model_name = (body.model_name or "").strip() or None
    if body.provider_id is not None:
        row = conn.execute(
            "SELECT * FROM llm_providers WHERE id = ?", (body.provider_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Provider not found")
        base_url = base_url or row["base_url"]
        if api_key is None:
            api_key = row["api_key"]
        if not model_name:
            keys = row.keys()
            model_name = (
                (row["model_name"] or "").strip()
                if "model_name" in keys
                else ""
            ) or None
    if not base_url:
        raise HTTPException(status_code=400, detail="base_url required")
    if not model_name:
        raise HTTPException(
            status_code=400,
            detail="该 Provider 未保存模型名，请重新添加并填写模型名",
        )
    try:
        reply = await test_provider(
            base_url=base_url,
            api_key=api_key,
            model_name=model_name,
        )
        return ProviderTestResult(ok=True, reply=reply)
    except Exception as exc:  # noqa: BLE001
        return ProviderTestResult(ok=False, error=str(exc))
