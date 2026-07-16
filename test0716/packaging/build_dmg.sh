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

1. 将「Mercury Web.app」拖入「Applications」文件夹
2. 在启动台或应用程序文件夹中打开 Mercury Web
3. 首次打开若提示无法验证开发者：右键 App → 打开 → 再次确认打开
4. 应用会自动在默认浏览器中打开 http://127.0.0.1:6789

数据保存在：
~/Library/Application Support/Mercury Web/

退出：在 Dock 中右键 Mercury Web → 退出
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
