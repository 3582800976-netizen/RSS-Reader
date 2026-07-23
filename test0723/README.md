# RSS Reader · test0723

> 本地优先（Local-first）的 Web RSS 阅读器。  
> 在 test0721（AI 厂商模板）基础上，新增 **已读延迟设置** 与 **半屏单栏钻入** 阅读体验。  
> 本目录亦含 macOS DMG 打包能力。

---

## macOS 一键安装（推荐）

> Apple Silicon（M 系列）Mac 可直接下载，**无需**安装 Python / Node。

| | |
|---|---|
| **下载** | [**Mercury Web-0723-arm64.dmg**](https://github.com/3582800976-netizen/RSS-Reader/releases/tag/test0723-dmg) |
| **系统要求** | macOS 12+，Apple Silicon |

### 重要：从 GitHub 下载后首次打开

从 Releases 下载的安装包**未做 Apple 开发者签名**。macOS 可能提示：

> Apple 无法验证「Mercury Web」是否包含可能危害 Mac 安全或泄漏隐私的恶意软件。

**这是未签名应用的正常提示，不代表检测到病毒。** 请按以下步骤操作：

1. 在 [Releases](https://github.com/3582800976-netizen/RSS-Reader/releases/latest) 下载 DMG 并打开
2. 将 **Mercury Web** 拖入 **应用程序（Applications）**
3. 打开应用程序文件夹，**右键 Mercury Web → 打开**
4. 在弹窗中再次点击 **打开**

**若直接双击** 只看到「完成」和「移到废纸篓」，请先点 **完成**，再执行步骤 3–4（双击不会出现「打开」按钮）。

**若右键后仍无「打开」按钮**：打开 **系统设置 → 隐私与安全性**，在底部安全性区域点击 **仍要打开**（Open Anyway），确认后重新启动应用。

5. 首次放行后可正常双击；浏览器将自动打开 `http://127.0.0.1:6789`

> 本地构建的 DMG 可能不会出现此提示；从 GitHub 下载的文件会被系统标记为「来自网络」，因此需要上述操作。

更多说明：[packaging/DISTRIBUTION.md](packaging/DISTRIBUTION.md)

---

> 实现课程作业必做① + ②：Feed / OPML 管理、内容清洗与阅读渲染，并扩展收藏、搜索、阅读主题以及 AI 智能摘要与翻译。

参考项目：[Mercury](https://github.com/neolee/mercury)（仅参考交互设计，不移植 SwiftUI）。

---

# 功能特性

## 必做① Feed 管理

- RSS / Atom 订阅源管理
- 添加、删除订阅源
- 单源同步 / 全部同步
- Feed 去重（`feed_id + guid`）
- OPML 导入 / 导出
- 三栏阅读界面（宽屏）
  - 左侧：订阅源
  - 中间：文章列表
  - 右侧：文章详情
- **半屏 / 窄屏（宽度 ≤ 860px）**：单栏钻入导航，见下文「半屏阅读」

---

## 必做② 内容清洗

采用四级内容处理流水线：

```text
Raw HTML
    │
    ▼
Readability 提取正文
    │
    ▼
Bleach 白名单清洗
    │
    ▼
BeautifulSoup 修正链接
    │
    ▼
html2text 转 Markdown
    │
    ▼
SQLite 增量缓存
```

支持：

- Cleaned HTML
- Cleaned Markdown
- SHA-256 增量缓存
- Markdown 渲染
- GitHub Flavored Markdown（GFM）
- Task List
- 代码高亮
- 自动降级显示原始 HTML

---

## P1 扩展功能

- 收藏（Star）
- 全部 / 未读 / 收藏筛选
- 全部标记已读
- 底部状态栏
  - Feed 数量
  - 文章数量
  - 未读数量
  - 收藏数量
  - 最近同步时间

---

## P2 扩展功能

- 标题 / 摘要关键词搜索
- 阅读模式
  - 阅读模式
  - 网页模式（iframe）
  - 双栏模式
- 阅读主题
  - 深色
  - 浅色
  - GitHub
  - 怀旧
- 字号
  - S
  - M
  - L
- 双栏宽度拖拽
- 阅读设置持久化
- **显示设置**
  - 主题、字号（S / M / L）
  - **已读设置**：打开未读文章后，延迟若干秒再自动标为已读（0–10 秒，步进 1 秒）
    - **0 秒**：与原先一致，点进文章立即标为已读
    - **1–10 秒**：在阅读页停留满设定时间后才标为已读；未满时间切换到其他文章则**不会**标为已读
    - 阅读区手动「标为已读 / 未读」、列表「全部标为已读」不受此延迟影响
    - 偏好保存在浏览器 `localStorage`（键 `rss-mark-read-delay`），仅本机有效

---

## 半屏阅读（窄屏布局）

当窗口宽度 **≤ 860px**（竖屏、分屏、手机浏览器等）时，不再将三栏纵向挤在一起，而是 **一次只显示一层**，通过返回键在层之间切换：

```text
订阅源  ──选源/视图──▶  文章列表  ──选文章──▶  阅读
   ▲                      ▲                    │
   └──────── 返回 ────────┴──── 返回 ───────────┘
```

| 层级 | 内容 | 返回 |
|------|------|------|
| 订阅源 | 全部 / 未读 / 收藏、添加源、OPML 导入导出（保留「导入」「导出」文字） | — |
| 文章 | 当前源或视图下的文章列表、「全部标为已读」 | ← 订阅源 |
| 阅读 | 正文 / 网页 / 双栏、AI 摘要与翻译、收藏与已读 | ← 文章 |

窄屏下的其它优化：

- 顶栏两行：搜索 + 阅读模式；**显示设置 / AI 设置 / 同步全部** 收入 **⋯** 菜单
- 阅读区 AI：**AI 摘要**、**AI 翻译** 为主按钮 + **▾** 选择语言（适配触控，不依赖悬停）
- 双栏模式在窄屏下改为正文与网页 **上下分栏**；双语对照为原文在上、译文在下
- 宽屏（> 860px）仍为左中右三栏，行为与此前一致

---

## AI 功能

支持 OpenAI Compatible Provider：

- OpenAI
- DeepSeek
- Ollama

功能包括：

- 流式摘要（SSE）
- 摘要缓存
- 段落级双语翻译
- **摘要 / 翻译目标语言分别选择**（默认中文，互不影响）
- **AI 厂商模板**：选择常见 LLM 厂商后自动填充 Base URL，用户只需填写 API Key 与模型名
- 段落失败可单段重试
- Token 用量统计（按日图表）
- 单段重试
- Token 使用统计
- Provider 管理
- Prompt 热更新

---

## OPML 后台导入（线程分离）

新版采用后台异步同步：

```text
POST /api/opml/import

        │
        ▼

解析 OPML

        │
        ▼

Feed 入库

        │
        ▼

立即返回

        │
        ▼

asyncio.create_task()

后台同步 Feed
```

特点：

- UI 不阻塞
- 导入立即完成
- 后台同步 Feed
- 状态栏实时显示同步进度
- 用户可继续浏览文章

---

# 技术架构

```text
                React + TypeScript
                        │
                REST API (FastAPI)
                        │
        ┌───────────────┴───────────────┐
        │                               │
   Feed Parser                     AI Agent
(feedparser/httpx)            OpenAI Compatible
        │                               │
        └───────────────┬───────────────┘
                        │
                 Cleaning Pipeline
                        │
      readability-lxml → bleach
      → BeautifulSoup → html2text
                        │
                    SQLite
```

---

# 技术栈

| 模块 | 技术 |
|------|------|
| Frontend | React + Vite + TypeScript |
| Backend | FastAPI |
| Database | SQLite |
| Feed Parser | feedparser + httpx |
| Content Cleaning | readability-lxml + bleach + BeautifulSoup4 + html2text |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| AI | OpenAI SDK（兼容 DeepSeek / Ollama） |
| Storage | Local-first |
| Server | FastAPI + StaticFiles |

---

# 项目结构

```text
test0723/
│
├── run.sh                      # 开发环境一键启动
├── README.md
├── .gitignore
│
├── fixtures/
│   └── mercury-starter.opml    # Mercury 默认订阅源
│
├── data/                       # 开发模式本地数据（运行时生成）
│   ├── app.db
│   └── prompts/
│       └── agents.yaml
│
├── packaging/                  # macOS DMG 打包
│   ├── build_dmg.sh            # 一键构建 DMG
│   ├── launcher.py             # .app 启动器（uvicorn + 打开浏览器）
│   ├── mercury.spec            # PyInstaller 配置
│   └── DISTRIBUTION.md         # 分发与安装说明
│
├── release/                    # DMG 产物目录（构建后生成）
│   └── Mercury Web-0723-arm64.dmg
│
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── db.py
│       ├── paths.py            # 开发/打包模式路径解析
│       ├── schemas.py
│       ├── routers/
│       │   ├── feeds.py
│       │   ├── entries.py
│       │   ├── opml.py
│       │   ├── sync.py
│       │   ├── stats.py
│       │   ├── providers.py
│       │   ├── agents.py
│       │   ├── cleaning.py
│       │   └── usages.py
│       └── services/
│           ├── bootstrap.py
│           ├── cleaning.py
│           ├── feed_parser.py
│           ├── llm_client.py
│           ├── opml.py
│           ├── preferences.py
│           ├── prompts.py
│           ├── segmenter.py
│           ├── sync.py
│           └── usage.py
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── api.ts
        ├── prefs.ts
        ├── App.tsx
        ├── styles.css
        └── components/
            ├── Sidebar.tsx
            ├── EntryList.tsx
            ├── ReaderPane.tsx
            ├── MarkdownBody.tsx
            ├── StatusBar.tsx
            ├── TopBar.tsx
            ├── Resizer.tsx
            ├── AiActionButton.tsx
            ├── AgentSettingsModal.tsx
            ├── DisplaySettingsModal.tsx
            ├── ConfirmModal.tsx
            ├── ThemeControls.tsx
            └── UsageCharts.tsx
```

---

# 快速开始

## 环境要求

- Python 3.10+
- Node.js
- npm

Windows 推荐：

- Git Bash
- WSL

---

## 运行

```bash
cd test0723

chmod +x run.sh

./run.sh
```

浏览器访问：

```
http://127.0.0.1:6789
```

启动脚本将自动：

1. 创建 Python 虚拟环境
2. 安装后端依赖
3. 安装前端依赖
4. 构建前端
5. 释放 6789 端口
6. 启动 FastAPI
7. 自动导入 Mercury 官方示例 OPML
8. 后台同步所有示例 Feed

---

# 主要 API

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET / POST | `/api/feeds` | Feed 列表 / 添加 |
| DELETE | `/api/feeds/{id}` | 删除 Feed |
| POST | `/api/feeds/{id}/sync` | 同步单个 Feed |
| POST | `/api/sync` | 全量同步 |
| GET | `/api/entries` | 查询文章 |
| GET / PATCH | `/api/entries/{id}` | 阅读状态 / 收藏 |
| POST | `/api/entries/mark-read` | 批量标记已读 |
| GET | `/api/stats` | 数据统计 |
| POST | `/api/opml/import` | 导入 OPML |
| GET | `/api/opml/export` | 导出 OPML |
| GET | `/api/opml/import-status/{job_id}` | 后台同步进度 |
| GET | `/api/entries/{id}/cleaned` | 获取清洗内容 |
| GET / POST | `/api/preferences/reading` | 阅读设置 |
| GET / POST / PATCH / DELETE | `/api/ai/providers` | Provider 管理 |
| POST | `/api/ai/providers/test` | Provider 连通性测试 |
| GET / PUT | `/api/ai/settings` | Agent 设置 |
| GET / POST | `/api/ai/summary` | AI 摘要 |
| GET / POST / DELETE | `/api/ai/translate` | AI 翻译 |
| GET | `/api/ai/usages` | Token 用量统计 |
| GET | `/api/health` | 健康检查 |
| GET | `/docs` | Swagger API 文档 |

---

# 数据存储

所有数据均保存在本地：

```text
data/app.db
```

无需账号、无需登录、无需云端同步。

AI 摘要、翻译、阅读偏好等均持久化存储于本地 SQLite 数据库。

---

# macOS DMG 打包（test0723）

将 Web 应用打包为 Apple Silicon Mac 可一键使用的 `.dmg` 安装包，终端用户无需安装 Python / Node。

## 构建

```bash
./packaging/build_dmg.sh
```

产物：`Mercury Web-0723-arm64.dmg`

## 分发与使用

详见 [packaging/DISTRIBUTION.md](packaging/DISTRIBUTION.md)。

- 双击 DMG，将 **Mercury Web.app** 拖入 Applications
- 首次打开若被 Gatekeeper 拦截：右键 → 打开
- 启动后自动在系统浏览器打开 `http://127.0.0.1:6789`
- 用户数据目录：`~/Library/Application Support/Mercury Web/`

---

# License

This project is intended for educational purposes and course assignments.
