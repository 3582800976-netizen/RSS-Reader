#!/usr/bin/env bash
# 将 release/ 下的 DMG 发布到 GitHub Releases（需先 gh auth login）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DMG="$ROOT/release/Mercury Web-0724-arm64.dmg"
TAG="test0724-dmg"
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
## Mercury Web — macOS 安装包（test0724）

Apple Silicon Mac 一键安装，无需 Python / Node。

### 本版更新

- **AI 问答**：底部问答坞流式多轮对话，可上下拖动调高；顶栏「AI 摘要」一键注入
- **按文章保存聊天记录**：再打开可恢复；支持确认后清空
- **划词问 AI**：阅读/双语正文选中后弹出「问AI」
- **宽屏栏目收起**：可收起订阅源或全屏阅读
- **拖动优化**：三栏 / 双栏 / 问答拖动更跟手

### 重要：从 GitHub 下载后首次打开

本安装包**未做 Apple 开发者签名**。下载后若出现：

> Apple 无法验证「Mercury Web」是否包含可能危害 Mac 安全或泄漏隐私的恶意软件。

**这是未签名应用的正常提示，不代表检测到病毒。** 请：

1. 打开 DMG，将 **Mercury Web** 拖入 **应用程序**
2. 在应用程序文件夹中 **右键 Mercury Web → 打开**
3. 在弹窗中再次点击 **打开**

**若直接双击** 只看到「完成」和「移到废纸篓」，请先点 **完成**，再执行步骤 2–3。

**若右键后仍无「打开」按钮**：**系统设置 → 隐私与安全性** → 底部点击 **仍要打开**（Open Anyway）。

4. 首次放行后可双击启动；浏览器将自动打开阅读界面

> 请勿仅双击图标，系统可能直接拦截而无法打开。

### 系统要求

- macOS 12+
- Apple Silicon（M 系列）

### 源码

[test/test0724](https://github.com/3582800976-netizen/RSS-Reader/tree/test/test0724)
EOF
)"

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "==> Release $TAG exists, updating notes..."
  gh release edit "$TAG" --repo "$REPO" --notes "$NOTES"
  if [[ -f "$DMG" ]]; then
    echo "==> Uploading asset..."
    gh release upload "$TAG" "$DMG" --repo "$REPO" --clobber
  fi
else
  echo "==> Creating release $TAG..."
  gh release create "$TAG" "$DMG" \
    --repo "$REPO" \
    --title "Mercury Web 0724 — macOS 安装包（Apple Silicon）" \
    --notes "$NOTES" \
    --latest
fi

echo ""
echo "Done: https://github.com/$REPO/releases/tag/$TAG"
