from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from app.db import DATA_DIR

DEFAULT_PROMPTS: dict[str, Any] = {
    "summary": {
        "system": (
            "You are a careful reading assistant for an RSS reader. "
            "Write clear, faithful summaries. Do not invent facts."
        ),
        "user_concise": (
            "Summarize the following article in {language}. "
            "Keep it concise (about 3–6 short sentences). "
            "Use Markdown.\n\nTitle: {title}\n\nContent:\n{content}"
        ),
        "user_detailed": (
            "Summarize the following article in {language}. "
            "Cover the main points and key details in structured Markdown "
            "(short paragraphs or bullet points).\n\nTitle: {title}\n\nContent:\n{content}"
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


def load_prompts() -> dict[str, Any]:
    path = ensure_default_prompts_file()
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if not isinstance(data, dict) or "summary" not in data or "translation" not in data:
            raise ValueError("invalid prompts file")
        return data
    except Exception:
        # Reset if user corrupted the file
        path.write_text(
            yaml.safe_dump(DEFAULT_PROMPTS, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
        return dict(DEFAULT_PROMPTS)


def resolve_summary_prompts(
    *,
    language: str,
    detail_level: str,
    title: str,
    content: str,
) -> tuple[str, str]:
    prompts = load_prompts()["summary"]
    system = prompts.get("system") or DEFAULT_PROMPTS["summary"]["system"]
    key = "user_detailed" if detail_level == "detailed" else "user_concise"
    template = prompts.get(key) or DEFAULT_PROMPTS["summary"][key]
    user = template.format(language=language, title=title or "", content=content)
    return system, user


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
