#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="Mercury Web"
VERSION="0716"
ARCH="arm64"
DMG_NAME="${APP_NAME}-${VERSION}-${ARCH}.dmg"
RELEASE_DIR="$ROOT/release"
STAGING_DIR="$ROOT/build/dmg-staging"
DIST_APP="$ROOT/dist/${APP_NAME}.app"

echo "==> [1/5] Build frontend"
cd frontend
if [[ ! -d node_modules ]]; then
  npm ci
else
  npm install
fi
npm run build
cd "$ROOT"

if [[ ! -d frontend/dist ]]; then
  echo "ERROR: frontend/dist not found after build" >&2
  exit 1
fi

echo "==> [2/5] Python venv + PyInstaller"
python3 -m venv backend/.venv
# shellcheck disable=SC1091
source backend/.venv/bin/activate
pip install -q -r backend/requirements.txt
pip install -q pyinstaller

echo "==> [3/5] PyInstaller bundle"
rm -rf build dist
pyinstaller packaging/mercury.spec --noconfirm --clean

if [[ ! -d "$DIST_APP" ]]; then
  echo "ERROR: ${DIST_APP} not found" >&2
  exit 1
fi

echo "==> [4/5] Stage DMG contents"
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
cp -R "$DIST_APP" "$STAGING_DIR/"
ln -s /Applications "$STAGING_DIR/Applications"

cat > "$STAGING_DIR/安装说明.txt" <<'EOF'
Mercury Web — 本地 RSS 阅读器

【重要】从网站下载后首次打开：
若提示「Apple 无法验证 Mercury Web 是否包含恶意软件」，
这是未签名应用的正常提示，不是病毒。

正确方式：
1. 将「Mercury Web.app」拖入「Applications」
2. 在应用程序文件夹中：右键 Mercury Web → 打开 → 再次确认打开
   （勿直接双击；双击弹窗只有「完成/移到废纸篓」，没有「打开」）
3. 若仍无法打开：系统设置 → 隐私与安全性 → 仍要打开

首次放行后可正常双击。浏览器将打开 http://127.0.0.1:6789

数据：~/Library/Application Support/Mercury Web/
退出：Dock 中右键 Mercury Web → 退出
EOF

echo "==> [5/5] Create DMG"
mkdir -p "$RELEASE_DIR"
rm -f "$RELEASE_DIR/$DMG_NAME"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$RELEASE_DIR/$DMG_NAME"

echo ""
echo "Done: $RELEASE_DIR/$DMG_NAME"
du -h "$RELEASE_DIR/$DMG_NAME"
