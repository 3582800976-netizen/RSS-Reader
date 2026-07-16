# RSS Reader（Mercury Web）

本地优先的 RSS 阅读器课程项目，支持 Feed / OPML、内容清洗、AI 摘要与翻译。

---

## macOS 一键安装（推荐）

> **老师 / 验收同学**：无需进入代码目录，直接下载安装包即可使用。  
> 适用于 **Apple Silicon（M 系列）** Mac，macOS 12+。

| | |
|---|---|
| **下载安装包** | [**Mercury Web-0716-arm64.dmg**](https://github.com/3582800976-netizen/RSS-Reader/releases/latest) |
| **代码与文档** | [test 分支](https://github.com/3582800976-netizen/RSS-Reader/tree/test) · [test0716](https://github.com/3582800976-netizen/RSS-Reader/tree/test/test0716) |
| **开发进度** | [report/0716](https://github.com/3582800976-netizen/RSS-Reader/tree/report/0716) |

### 安装步骤

1. 点击上方链接，在 **Releases** 页面下载 `Mercury Web-0716-arm64.dmg`
2. 打开 DMG，将 **Mercury Web** 拖入 **应用程序（Applications）**
3. 从启动台打开应用；若提示「无法验证开发者」，请 **右键 → 打开 → 再次确认**
4. 应用会自动在浏览器中打开 `http://127.0.0.1:6789`

### 说明

- 无需安装 Python、Node.js 或执行 `run.sh`
- 用户数据保存在 `~/Library/Application Support/Mercury Web/`
- 仅支持 Apple Silicon；Intel Mac 无法原生运行

---

## 仓库结构

| 目录 | 说明 |
|------|------|
| [test0713](test0713/) | 必做① Feed / OPML / Sync |
| [test0714](test0714/) | 必做② 内容清洗 + 阅读渲染 |
| [test0715](test0715/) | 体验优化与 AI 交互增强 |
| [test0716](test0716/) | macOS DMG 打包与分发 |

开发与联调请切换到 **[test 分支](https://github.com/3582800976-netizen/RSS-Reader/tree/test)**。

---

## 开发者运行（Web 模式）

```bash
git clone -b test https://github.com/3582800976-netizen/RSS-Reader.git
cd RSS-Reader/test0716
./run.sh
# 浏览器打开 http://127.0.0.1:6789
```

构建 DMG：`./packaging/build_dmg.sh`（详见 test0716 README）

---

## License

Educational use — course assignment.
