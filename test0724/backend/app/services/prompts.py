from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from app.db import DATA_DIR

DEFAULT_PROMPTS: dict[str, Any] = {
    "qa": {
        "system": (
            "You are a careful reading assistant for an RSS reader. "
            "Answer questions about the article faithfully based on the full text below. "
            "Do not invent facts. Use Markdown when helpful.\n\n"
            "Response style: {detail_hint}\n\n"
            "Article title: {title}\n\nArticle content:\n{content}"
        ),
        "detail_hint_concise": (
            "Keep answers concise and to the point (a few short sentences unless more is needed)."
        ),
        "detail_hint_detailed": (
            "Provide thorough, well-structured answers (short paragraphs or bullet points when useful)."
        ),
    },
    "translation": {
        "system": (
            "You are a professional translator. Translate faithfully. "
            "Preserve meaning and tone. Output ONLY the translation, no explanations."
        ),
        "system_hy_mt": (
            "Translate the text into {language}. Output only the translation."
        ),
        "user": "Target language: {language}\n\nText:\n{content}",
        "user_hy_mt": "{content}",
    },
}


def prompts_dir() -> Path:
    path = DATA_DIR / "prompts"
    path.mkdir(parents=True, exist_ok=True)
    return path


def prompts_file() -> Path:
    return prompts_dir() / "agents.yaml"


def ensure_default_prompts_file() -> Path:
    path = prompts_file()
    if not path.exists():
        path.write_text(
            yaml.safe_dump(DEFAULT_PROMPTS, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
    return path


def _normalize_prompts(data: dict[str, Any]) -> dict[str, Any]:
    """Ensure qa exists; migrate legacy summary key if present."""
    if "qa" not in data and "summary" in data:
        data = dict(data)
        data["qa"] = DEFAULT_PROMPTS["qa"]
    return data


def load_prompts() -> dict[str, Any]:
    path = ensure_default_prompts_file()
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if not isinstance(data, dict):
            raise ValueError("invalid prompts file")
        data = _normalize_prompts(data)
        if "qa" not in data or "translation" not in data:
            raise ValueError("invalid prompts file")
        return data
    except Exception:
        path.write_text(
            yaml.safe_dump(DEFAULT_PROMPTS, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
        return dict(DEFAULT_PROMPTS)


def resolve_qa_prompts(
    *,
    detail_level: str,
    title: str,
    content: str,
) -> str:
    prompts = load_prompts()["qa"]
    template = prompts.get("system") or DEFAULT_PROMPTS["qa"]["system"]
    hint_key = "detail_hint_detailed" if detail_level == "detailed" else "detail_hint_concise"
    detail_hint = prompts.get(hint_key) or DEFAULT_PROMPTS["qa"][hint_key]
    return template.format(
        detail_hint=detail_hint,
        title=title or "",
        content=content,
    )


def resolve_translation_prompts(
    *,
    language: str,
    content: str,
    strategy: str = "default",
) -> tuple[str, str]:
    prompts = load_prompts()["translation"]
    hy = strategy in {"hy_mt", "HY-MT", "hy-mt", "hy_mt_optimized"}
    if hy:
        system = prompts.get("system_hy_mt") or DEFAULT_PROMPTS["translation"]["system_hy_mt"]
        template = prompts.get("user_hy_mt") or DEFAULT_PROMPTS["translation"]["user_hy_mt"]
        system = system.format(language=language)
        user = template.format(language=language, content=content)
    else:
        system = prompts.get("system") or DEFAULT_PROMPTS["translation"]["system"]
        template = prompts.get("user") or DEFAULT_PROMPTS["translation"]["user"]
        user = template.format(language=language, content=content)
    return system, user
