from __future__ import annotations

import sqlite3
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Optional

from openai import AsyncOpenAI

from app.services.usage import record_usage


@dataclass
class ProviderConfig:
    id: int
    name: str
    base_url: str
    api_key: Optional[str]
    model_name: str


def get_agent_provider(
    conn: sqlite3.Connection, agent_type: str
) -> tuple[ProviderConfig, dict[str, Any]]:
    settings = conn.execute(
        "SELECT * FROM agent_settings WHERE agent_type = ?",
        (agent_type,),
    ).fetchone()
    if not settings:
        raise ValueError(f"Agent settings missing for {agent_type}")
    if not settings["provider_id"] or not settings["model_name"]:
        raise ValueError("请先在 AI 设置中配置 Provider 与模型名称")

    provider = conn.execute(
        "SELECT * FROM llm_providers WHERE id = ? AND is_active = 1",
        (settings["provider_id"],),
    ).fetchone()
    if not provider:
        raise ValueError("所选 Provider 不存在或未启用")

    cfg = ProviderConfig(
        id=provider["id"],
        name=provider["name"],
        base_url=provider["base_url"].rstrip("/"),
        api_key=provider["api_key"] or "local",
        model_name=settings["model_name"],
    )
    return cfg, dict(settings)


def make_client(cfg: ProviderConfig) -> AsyncOpenAI:
    return AsyncOpenAI(api_key=cfg.api_key or "local", base_url=cfg.base_url)


async def test_provider(
    *,
    base_url: str,
    api_key: str | None,
    model_name: str,
) -> str:
    client = AsyncOpenAI(api_key=api_key or "local", base_url=base_url.rstrip("/"))
    response = await client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "user", "content": "Reply with exactly: OK"},
        ],
        max_tokens=16,
        temperature=0,
    )
    content = (response.choices[0].message.content or "").strip()
    return content or "OK"


async def stream_chat(
    conn: sqlite3.Connection,
    *,
    agent_type: str,
    system_prompt: str,
    user_prompt: str | None = None,
    messages: list[dict[str, str]] | None = None,
) -> AsyncIterator[str]:
    cfg, _settings = get_agent_provider(conn, agent_type)
    client = make_client(cfg)
    collected: list[str] = []
    prompt_tokens = 0
    completion_tokens = 0
    msg_list: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    if messages:
        for item in messages:
            role = item.get("role")
            content = (item.get("content") or "").strip()
            if role in {"user", "assistant"} and content:
                msg_list.append({"role": role, "content": content})
    elif user_prompt:
        msg_list.append({"role": "user", "content": user_prompt})
    else:
        raise ValueError("user_prompt or messages is required")

    try:
        stream = await client.chat.completions.create(
            model=cfg.model_name,
            messages=msg_list,
            stream=True,
            stream_options={"include_usage": True},
        )
    except Exception:  # noqa: BLE001
        stream = await client.chat.completions.create(
            model=cfg.model_name,
            messages=msg_list,
            stream=True,
        )
    async for chunk in stream:
        if chunk.usage:
            prompt_tokens = chunk.usage.prompt_tokens or prompt_tokens
            completion_tokens = chunk.usage.completion_tokens or completion_tokens
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta:
            collected.append(delta)
            yield delta

    record_usage(
        conn,
        provider_name=cfg.name,
        model_name=cfg.model_name,
        agent_type=agent_type,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens or max(1, len("".join(collected)) // 4),
    )


async def chat_once(
    conn: sqlite3.Connection,
    *,
    agent_type: str,
    system_prompt: str,
    user_prompt: str,
    record: bool = True,
) -> tuple[str, str]:
    """Return (text, model_name)."""
    cfg, _settings = get_agent_provider(conn, agent_type)
    client = make_client(cfg)
    response = await client.chat.completions.create(
        model=cfg.model_name,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )
    text = (response.choices[0].message.content or "").strip()
    usage = response.usage
    if record:
        record_usage(
            conn,
            provider_name=cfg.name,
            model_name=cfg.model_name,
            agent_type=agent_type,
            prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
        )
    return text, cfg.model_name
