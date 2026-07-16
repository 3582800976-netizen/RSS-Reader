# Mercury Web — macOS 分发说明

## 系统要求

- macOS 12 或更高版本
- Apple Silicon（M 系列）Mac

## 安装

1. 打开 `Mercury Web-0716-arm64.dmg`
2. 将 **Mercury Web.app** 拖入 **Applications** 文件夹
3. 从启动台或「应用程序」中打开 Mercury Web（见下方「首次打开」）

## 首次打开（Gatekeeper）— 必读

本应用为课程项目打包产物，**未做 Apple 开发者签名与公证**。从 GitHub 等网站下载后，macOS 会给文件加上「来自网络」标记，首次启动时可能出现以下提示之一：

- 「Apple 无法验证“Mercury Web”是否包含可能危害 Mac 安全或泄漏隐私的恶意软件。」
- 「无法打开“Mercury Web”，因为无法验证开发者。」

**这是 macOS 对未签名应用的正常拦截，不代表应用含有病毒。**

### 正确打开方式（首次必做）

1. 打开 **应用程序（Applications）** 文件夹
2. 找到 **Mercury Web.app**
3. **不要直接双击**；请 **按住 Control 键点击**（或 **右键点击**）该图标
4. 在菜单中选择 **打开**
5. 在弹出的对话框中再次点击 **打开**
6. 首次放行后，以后可像普通应用一样双击启动

### 为什么本机构建的 DMG 有时能直接打开？

在本机 `release/` 目录中直接打开 DMG，文件往往没有「来自网络」标记，或您此前已手动放行过一次，因此表现可能与从 GitHub 下载不同。**从 Releases 下载的用户请务必按上文「右键 → 打开」。**

## 使用

- 启动后会自动在默认浏览器中打开 `http://127.0.0.1:6789`
- 无需安装 Python、Node.js 或其他依赖
- 订阅数据、AI 设置等保存在本机：

```
~/Library/Application Support/Mercury Web/
```

- 运行日志：

```
~/Library/Logs/Mercury Web/launcher.log
```

## 退出应用

在 Dock 中右键 Mercury Web 图标，选择 **退出**（或按 Cmd+Q）。

仅关闭浏览器标签页不会停止后台服务，请通过上述方式退出。

## 端口占用

默认使用 `127.0.0.1:6789`。若该端口已被占用，应用会自动尝试相邻端口。

## 开发者构建 DMG

在项目根目录执行：

```bash
./packaging/build_dmg.sh
```

产物位于 `release/Mercury Web-0716-arm64.dmg`。
