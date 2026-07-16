from __future__ import annotations

import sys
from pathlib import Path

APP_NAME = "Mercury Web"


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def project_root() -> Path:
    """Writable project root in dev; read-only bundle root when frozen."""
    if is_frozen():
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parents[2]


def bundle_root() -> Path:
    """Read-only resources (frontend dist, fixtures)."""
    return project_root()


def data_dir() -> Path:
    """Writable user data directory."""
    if is_frozen():
        path = Path.home() / "Library" / "Application Support" / APP_NAME
    else:
        path = project_root() / "data"
    path.mkdir(parents=True, exist_ok=True)
    return path


def dist_dir() -> Path:
    return bundle_root() / "frontend" / "dist"


def fixtures_dir() -> Path:
    return bundle_root() / "fixtures"


def logs_dir() -> Path:
    if is_frozen():
        path = Path.home() / "Library" / "Logs" / APP_NAME
    else:
        path = data_dir() / "logs"
    path.mkdir(parents=True, exist_ok=True)
    return path
