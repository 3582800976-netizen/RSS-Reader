# RSS Reader · test0715

> 本地优先（Local-first）的 Web RSS 阅读器。
>
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
- 三栏阅读界面
  - 左侧：订阅源
  - 中间：文章列表
  - 右侧：文章详情

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
test0715/
│
├── run.sh
├── fixtures/
│   └── mercury-starter.opml
│
├── data/
│   ├── app.db
│   └── prompts/
│       └── agents.yaml
│
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── db.py
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
    ├── src/
    │   ├── api.ts
    │   ├── prefs.ts
    │   ├── App.tsx
    │   ├── styles.css
    │   └── components/
    │       ├── Sidebar.tsx
    │       ├── EntryList.tsx
    │       ├── ReaderPane.tsx
    │       ├── MarkdownBody.tsx
    │       ├── StatusBar.tsx
    │       ├── TopBar.tsx
    │       ├── AgentSettingsModal.tsx
    │       └── UsageCharts.tsx
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
cd test0715

chmod +x frontend/node_modules/.bin/*

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

# 更新日志

## 2026-07-15

### OPML 导入线程分离

- OPML 导入后立即返回
- Feed 后台异步同步
- 新增导入进度接口
- 前端轮询同步状态
- UI 全程保持可交互
- 状态栏实时显示同步进度

### AI 摘要/翻译语言独立选择

- 摘要目标语言与翻译目标语言可分别设置
- 摘要面板内独立选择目标语言
- 阅读区翻译按钮独立选择目标语言
- 两种语言互不影响，均默认中文

### 三栏宽度拖拽与阅读区自适应

- 左侧订阅源栏、中间文章列表栏、右侧阅读栏之间新增可拖拽分隔条
- 支持实时调节三栏宽度
- 宽度设置持久化保存到后端
- 刷新后自动恢复上次布局
- 阅读区内容在宽屏/全屏下占满可用宽度，消除右侧留白

### 删除订阅源二次确认

- 左栏删除订阅源时弹出确认弹窗
- 显示待删除订阅源名称及提示信息
- 确认后才执行删除，避免误操作

### 显示设置聚合入口

- TopBar 右上角新增「显示设置」按钮
- 原「Aa 字号」和「主题」按钮收入弹窗
- 弹窗内独立选择字号（小/中/大）和主题（深色/浅色/怀旧/GitHub）

### 三栏标题横线对齐与阅读栏头部固定

- 统一左/中/右三栏 `.pane-head` 高度为 42px，底部横线保持对齐
- 右侧阅读栏操作按钮区改为单行横向滚动，避免按钮换行撑高头部
- 横线位置不再随文章状态或按钮数量变化而上下跳动

### AI 摘要/翻译按钮增加语言下拉选择

- 「摘要」按钮改为「AI摘要」，「翻译对照」按钮改为「AI翻译」
- 鼠标悬停在按钮上时弹出语言选择菜单
- 当前语言项后显示对勾，默认中文
- 直接点击按钮使用当前语言生成
- 选择语言后立即按该语言生成
- 移除 `detail-actions` 中独立的语言选择下拉框

### AI 摘要缓存复用

- 文章已存在某语言摘要缓存时，再次点击对应语言的「AI摘要」仅展开摘要框，不再重复调用 API
- 仅在摘要框内点击「重新生成」时才强制重新生成
- 切换语言或首次生成时仍正常调用 API

### AI 设置弹窗表单项高度统一

- 智能体绑定区域内所有 input 和 select 统一高度为 36px
- Provider、模型名、目标语言、详略、提示词策略等表单项高度保持一致

### 导入/导出按钮移至订阅源栏

- 移除 TopBar 上的「导入」「导出」文字按钮
- 在左侧订阅源栏标题右侧新增导入/导出图标按钮
- 导入使用上传箭头图标，导出使用下载箭头图标

---

# License

This project is intended for educational purposes and course assignments.
