from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.db import init_db
from app.routers import agents, entries, feeds, opml, providers, stats, sync, usages
from app.services.bootstrap import bootstrap_starter_feeds
from app.services.prompts import ensure_default_prompts_file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    ensure_default_prompts_file()
    # Import Mercury starter feeds (screenshot 11 sources) if missing, then sync.
    asyncio.create_task(bootstrap_starter_feeds())
    yield


app = FastAPI(title="RSS Reader — 必做① + AI", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(feeds.router)
app.include_router(entries.router)
app.include_router(opml.router)
app.include_router(sync.router)
app.include_router(stats.router)
app.include_router(providers.router)
app.include_router(agents.router)
app.include_router(usages.router)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


if DIST.exists():
    assets = DIST / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(DIST / "index.html")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str) -> FileResponse:
        candidate = DIST / full_path
        if full_path.startswith("api"):
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Not found")
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
