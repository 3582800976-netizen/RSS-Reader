# RSS Reader（Mercury Web）

本地优先的 RSS 阅读器课程项目，支持 Feed / OPML、内容清洗、AI 问答与翻译。

---

## 仓库结构

| 目录 | 说明 |
|------|------|
| [test0713](https://github.com/3582800976-netizen/RSS-Reader/tree/test/test0713) | 必做① Feed / OPML / Sync |
| [test0714](https://github.com/3582800976-netizen/RSS-Reader/tree/test/test0714) | 必做② 内容清洗 + 阅读渲染 |
| [test0715](https://github.com/3582800976-netizen/RSS-Reader/tree/test/test0715) | 体验优化与 AI 交互增强 |
| [test0716](https://github.com/3582800976-netizen/RSS-Reader/tree/test/test0716) | macOS DMG 打包与分发 |
| [test0721](https://github.com/3582800976-netizen/RSS-Reader/tree/test/test0721) | AI 厂商模板 + DMG（[Release](https://github.com/3582800976-netizen/RSS-Reader/releases/tag/test0721-dmg)） |
| [test0723](https://github.com/3582800976-netizen/RSS-Reader/tree/test/test0723) | 已读延迟设置 + 半屏钻入 + DMG（[Release](https://github.com/3582800976-netizen/RSS-Reader/releases/tag/test0723-dmg)） |
| [test0724](https://github.com/3582800976-netizen/RSS-Reader/tree/test/test0724) | AI 问答 + 划词问 AI + 会话持久化 + 宽屏收起 + DMG（[Release](https://github.com/3582800976-netizen/RSS-Reader/releases/tag/test0724-dmg)） |

开发与联调请切换到 **[test 分支](https://github.com/3582800976-netizen/RSS-Reader/tree/test)**。  
推荐安装包：[Mercury Web-0724-arm64.dmg](https://github.com/3582800976-netizen/RSS-Reader/releases/tag/test0724-dmg)。  
开发进度汇报见 **[report 分支](https://github.com/3582800976-netizen/RSS-Reader/tree/report)**。

---

## 开发者运行（Web 模式）

```bash
git clone -b test https://github.com/3582800976-netizen/RSS-Reader.git
cd RSS-Reader/test0724
./run.sh
# 浏览器打开 http://127.0.0.1:6789
```

---

## License

Educational use — course assignment.
