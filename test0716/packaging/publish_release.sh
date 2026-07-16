#!/usr/bin/env bash
# 将 release/ 下的 DMG 发布到 GitHub Releases（需先 gh auth login）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DMG="$ROOT/release/Mercury Web-0716-arm64.dmg"
TAG="test0716-dmg"
REPO="3582800976-netizen/RSS-Reader"

if [[ ! -f "$DMG" ]]; then
  echo "ERROR: DMG not found: $DMG" >&2
  echo "Run ./packaging/build_dmg.sh first." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI (gh) not installed. Run: brew install gh && gh auth login" >&2
  exit 1
fi

NOTES="$(cat <<'EOF'
## Mercury Web — macOS 安装包（test0716）

Apple Silicon Mac 一键安装，无需 Python / Node。

### 安装

1. 下载 `Mercury Web-0716-arm64.dmg` 并打开
2. 将 **Mercury Web** 拖入 **应用程序**
3. 首次若被 Gatekeeper 拦截：**右键 → 打开**
4. 启动后自动在浏览器打开阅读界面

### 要求

- macOS 12+
- Apple Silicon（M 系列）

### 源码

[test/test0716](https://github.com/3582800976-netizen/RSS-Reader/tree/test/test0716)
EOF
)"

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "==> Release $TAG exists, uploading asset..."
  gh release upload "$TAG" "$DMG" --repo "$REPO" --clobber
else
  echo "==> Creating release $TAG..."
  gh release create "$TAG" "$DMG" \
    --repo "$REPO" \
    --title "Mercury Web 0716 — macOS 安装包（Apple Silicon）" \
    --notes "$NOTES" \
    --latest
fi

echo ""
echo "Done: https://github.com/$REPO/releases/tag/$TAG"
