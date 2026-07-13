from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

BLOCK_TAGS = {"p", "blockquote", "li", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "div"}
INLINE_KEEP = {"em", "i", "strong", "b", "a", "code", "span", "br"}


def _plain(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def segment_html(html: str | None) -> list[str]:
    """Split article HTML into paragraph-level plain texts for bilingual translation."""
    if not html or not html.strip():
        return []

    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    paragraphs: list[str] = []
    seen: set[str] = set()

    def push(text: str) -> None:
        t = _plain(text)
        if len(t) < 2:
            return
        if t in seen:
            return
        seen.add(t)
        paragraphs.append(t)

    blocks = soup.find_all(BLOCK_TAGS)
    if blocks:
        for block in blocks:
            # Prefer leaf-ish blocks: skip divs that only wrap other blocks
            if isinstance(block, Tag) and block.name == "div":
                if block.find(BLOCK_TAGS - {"div"}):
                    continue
            push(block.get_text(" ", strip=True))
    else:
        push(soup.get_text(" ", strip=True))

    if not paragraphs:
        # Fallback: split plain text by blank lines / periods for very broken HTML
        text = _plain(BeautifulSoup(html, "lxml").get_text("\n", strip=True))
        if text:
            parts = re.split(r"\n{2,}|(?<=[。！？.!?])\s+", text)
            for part in parts:
                push(part)

    return paragraphs


def html_to_plain(html: str | None, max_chars: int = 8000) -> str:
    """Extract plain text for summary, truncated to max_chars."""
    if not html:
        return ""
    text = BeautifulSoup(html, "lxml").get_text("\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) > max_chars:
        return text[:max_chars] + "\n…"
    return text
