# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Mercury Web macOS .app bundle."""

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

ROOT = Path(SPECPATH).resolve().parent
BACKEND = ROOT / "backend"

block_cipher = None

datas = [
    (str(ROOT / "frontend" / "dist"), "frontend/dist"),
    (str(ROOT / "fixtures"), "fixtures"),
    (str(BACKEND / "app"), "backend/app"),
]

hiddenimports = (
    collect_submodules("app")
    + collect_submodules("uvicorn")
    + collect_submodules("fastapi")
    + collect_submodules("starlette")
    + collect_submodules("pydantic")
    + collect_submodules("anyio")
    + collect_submodules("httpx")
    + collect_submodules("httpcore")
    + collect_submodules("h11")
    + collect_submodules("certifi")
    + collect_submodules("feedparser")
    + collect_submodules("bs4")
    + collect_submodules("lxml")
    + collect_submodules("readability")
    + collect_submodules("bleach")
    + collect_submodules("html2text")
    + collect_submodules("openai")
    + collect_submodules("yaml")
    + [
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "multipart",
        "sqlite3",
        "encodings.idna",
    ]
)

a = Analysis(
    [str(ROOT / "packaging" / "launcher.py")],
    pathex=[str(BACKEND)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Mercury Web",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch="arm64",
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="Mercury Web",
)

app = BUNDLE(
    coll,
    name="Mercury Web.app",
    icon=None,
    bundle_identifier="com.ecnu.mercuryweb",
    info_plist={
        "CFBundleName": "Mercury Web",
        "CFBundleDisplayName": "Mercury Web",
        "CFBundleVersion": "0.2.0",
        "CFBundleShortVersionString": "0.2.0",
        "NSHighResolutionCapable": True,
        "LSMinimumSystemVersion": "12.0",
    },
)
