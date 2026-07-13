# RSS Reader · test0713

本地优先的 Web RSS 阅读器，对应作业必做①：

**Feed / OPML 解析 + Sync + 内容呈现**

在①基础上已扩展 **P1 / P2**（收藏、筛选、搜索、阅读主题与双栏等），界面为深色三栏阅读布局（参考 [Mercury](https://github.com/neolee/mercury) 观感，不移植 SwiftUI）。

---

## 快速开始

```bash
cd test/test0713
./run.sh
```

浏览器打开：**http://127.0.0.1:6789**

`run.sh` 会：

1. 准备 Python venv 并安装后端依赖  
2. `npm install` + 构建前端  
3. 若 6789 被占用则结束旧进程  
4. 启动 FastAPI（`/api` + 前端静态资源同端口）

启动时会从 `fixtures/mercury-starter.opml` 自动补齐 Mercury 官方 **11 个示例订阅源**（已存在则跳过并后台同步）。

---

## 功能一览

### 必做①

| 能力 | 说明 |
|------|------|
| Feed | 添加 / 列表 / 删除；`feedparser` 解析 RSS/Atom |
| Sync | 单源 / 全量；`(feed_id, guid)` 去重 |
| OPML | 导入 / 导出（扁平 outline） |
| 内容呈现 | 三栏：订阅源 / 文章列表 / 详情（Feed 摘要 + DOMPurify） |

### P1

- 收藏（星标）  
- 侧栏视图：全部 / 未读 / 收藏  
- 底部状态栏：订阅源数 · 文章数 · 未读 · 收藏 · 上次同步  
- 当前范围「全部标为已读」

### P2

- 顶栏关键词搜索（标题 / 摘要）  
- 深色 / 浅色主题、字号 S/M/L（`localStorage` 持久化）  
- 阅读模式：阅读 / 网页（iframe）/ 双栏  

### AI（本期已接入）

- Provider 自配（OpenAI 兼容：DeepSeek / OpenAI / Ollama 等）
- 流式摘要（SSE）+ 缓存
- 段落级双语翻译 + 单段重试
- Token 用量统计（本地 `llm_usages`）
- 顶栏「AI 设置」；阅读区「摘要 / 翻译对照」

**未包含**：内容清洗②、笔记文摘、标签 Agent、Electron 打包。

---

## 技术栈

| 层 | 选型 |
|----|------|
| 前端 | React + Vite + TypeScript + DOMPurify |
| 后端 | Python FastAPI + SQLite |
| Feed | `feedparser` + `httpx` |
| OPML | `xml.etree` |
| 运行 | `127.0.0.1:6789` 单端口 |

---

## 目录结构

```text
test0713/
  run.sh
  fixtures/mercury-starter.opml
  data/app.db                 # 运行后生成
  backend/
    requirements.txt
    app/
      main.py
      db.py                   # 含 is_starred 迁移
      schemas.py
      services/               # feed_parser / opml / sync / bootstrap
      routers/                # feeds / entries / opml / sync / stats
  frontend/
    src/
      App.tsx
      api.ts
      prefs.ts                # 主题 / 字号 / 阅读模式
      styles.css
      components/
        TopBar.tsx
        Sidebar.tsx
        EntryList.tsx
        ReaderPane.tsx
        StatusBar.tsx
```

---

## 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/feeds` | 列表 / 添加 |
| DELETE | `/api/feeds/{id}` | 删除 |
| POST | `/api/feeds/{id}/sync` | 同步单源 |
| POST | `/api/sync` | 同步全部 |
| GET | `/api/entries` | 列表（`feed_id` / `is_read` / `is_starred` / `q`） |
| GET/PATCH | `/api/entries/{id}` | 详情；更新已读 / 收藏 |
| POST | `/api/entries/mark-read` | 批量标已读（可选 `feed_id`） |
| GET | `/api/stats` | 统计 |
| POST/GET | `/api/opml/import` · `/export` | OPML |
| GET | `/api/health` | 健康检查 |
| GET | `/docs` | Swagger |
| GET/POST/PATCH/DELETE | `/api/ai/providers` | LLM Provider 管理 |
| POST | `/api/ai/providers/test` | 连通性测试 |
| GET/PUT | `/api/ai/settings` · `/api/ai/settings/{agent}` | 智能体设置 |
| GET/POST | `/api/ai/summary/{id}` · `/api/ai/summary/stream` | 摘要缓存 / 流式摘要 |
| GET/POST/DELETE | `/api/ai/translate...` | 翻译 / 重试 / 清除 |
| GET | `/api/ai/usages` · `/summary` | Token 用量 |

---

## 环境要求

- Python 3.10+  
- Node.js + npm  
- macOS / Linux；Windows 可用 Git Bash 或 WSL 运行 `run.sh`

---

## 说明

- 数据仅存本机 `data/app.db`，无需登录。  
- 正文本阶段使用 Feed 自带 `summary`/`content`；完整 Readability 清洗属作业②。  
- 部分站点禁止 iframe，「网页 / 双栏」可能空白，可用「打开原文」。
