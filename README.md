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

### 重要：从 GitHub 下载后首次打开

本安装包**未做 Apple 开发者签名**。从网页下载后，macOS 可能提示：

> Apple 无法验证「Mercury Web」是否包含可能危害 Mac 安全或泄漏隐私的恶意软件。

**这是未签名应用的正常提示，不代表检测到病毒。** 请按以下方式首次打开：

1. 打开 DMG，将 **Mercury Web** 拖入 **应用程序（Applications）**
2. 打开 **应用程序** 文件夹，找到 **Mercury Web**
3. **按住 Control 键点击**（或 **右键**）该 App，选择 **打开**
4. 在弹窗中再次点击 **打开**
5. 首次放行后，以后可正常双击启动；应用会自动在浏览器打开 `http://127.0.0.1:6789`

> 请勿因上述提示放弃安装。若仅双击图标，系统可能直接拦截而无法打开。

### 其他说明

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
