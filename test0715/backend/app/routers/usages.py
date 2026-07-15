from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from app.db import get_connection
from app.schemas import DailyUsagePoint, UsageDailyOut, UsageOut, UsageSummaryOut

router = APIRouter(prefix="/api/ai/usages", tags=["ai-usages"])


@router.get("", response_model=list[UsageOut])
def list_usages(
    limit: int = Query(100, ge=1, le=500),
    agent_type: str | None = None,
    conn: sqlite3.Connection = Depends(get_connection),
) -> list[UsageOut]:
    clauses: list[str] = []
    params: list[object] = []
    if agent_type:
        clauses.append("agent_type = ?")
        params.append(agent_type)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)
    rows = conn.execute(
        f"""
        SELECT * FROM llm_usages
        {where}
        ORDER BY id DESC
        LIMIT ?
        """,
        params,
    ).fetchall()
    return [
        UsageOut(
            id=r["id"],
            provider_name=r["provider_name"],
            model_name=r["model_name"],
            agent_type=r["agent_type"],
            prompt_tokens=r["prompt_tokens"] or 0,
            completion_tokens=r["completion_tokens"] or 0,
            created_at=r["created_at"],
        )
        for r in rows
    ]


@router.get("/summary", response_model=UsageSummaryOut)
def usage_summary(conn: sqlite3.Connection = Depends(get_connection)) -> UsageSummaryOut:
    total = conn.execute(
        """
        SELECT
            COUNT(*) AS total_calls,
            COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
            COALESCE(SUM(completion_tokens), 0) AS completion_tokens
        FROM llm_usages
        """
    ).fetchone()
    by_agent = conn.execute(
        """
        SELECT agent_type,
               COUNT(*) AS calls,
               COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens
        FROM llm_usages
        GROUP BY agent_type
        ORDER BY tokens DESC
        """
    ).fetchall()
    by_model = conn.execute(
        """
        SELECT COALESCE(model_name, '(unknown)') AS model_name,
               COUNT(*) AS calls,
               COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens
        FROM llm_usages
        GROUP BY model_name
        ORDER BY tokens DESC
        """
    ).fetchall()
    prompt_tokens = int(total["prompt_tokens"] or 0)
    completion_tokens = int(total["completion_tokens"] or 0)
    return UsageSummaryOut(
        total_calls=int(total["total_calls"] or 0),
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        by_agent=[dict(r) for r in by_agent],
        by_model=[dict(r) for r in by_model],
    )


@router.get("/daily", response_model=UsageDailyOut)
def usage_daily(
    days: int = Query(30, ge=7, le=90),
    conn: sqlite3.Connection = Depends(get_connection),
) -> UsageDailyOut:
    """Daily call / token series for charts (last N days, zeros filled)."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    rows = conn.execute(
        """
        SELECT
            substr(created_at, 1, 10) AS day,
            COUNT(*) AS calls,
            COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
            COALESCE(SUM(completion_tokens), 0) AS completion_tokens
        FROM llm_usages
        WHERE substr(created_at, 1, 10) >= ?
        GROUP BY substr(created_at, 1, 10)
        ORDER BY day ASC
        """,
        (start.isoformat(),),
    ).fetchall()
    by_day = {
        r["day"]: {
            "calls": int(r["calls"] or 0),
            "prompt_tokens": int(r["prompt_tokens"] or 0),
            "completion_tokens": int(r["completion_tokens"] or 0),
        }
        for r in rows
    }
    series: list[DailyUsagePoint] = []
    for i in range(days):
        d = start + timedelta(days=i)
        key = d.isoformat()
        item = by_day.get(key, {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0})
        series.append(
            DailyUsagePoint(
                date=key,
                calls=item["calls"],
                prompt_tokens=item["prompt_tokens"],
                completion_tokens=item["completion_tokens"],
                total_tokens=item["prompt_tokens"] + item["completion_tokens"],
            )
        )
    return UsageDailyOut(days=series)
