# Mercury Web — macOS 分发说明

## 系统要求

- macOS 12 或更高版本
- Apple Silicon（M 系列）Mac

## 安装

1. 打开 `Mercury Web-0716-arm64.dmg`
2. 将 **Mercury Web.app** 拖入 **Applications** 文件夹
3. 从启动台或「应用程序」中打开 Mercury Web

## 首次打开（Gatekeeper）

本应用未做 Apple 开发者签名。若系统提示「无法验证开发者」：

1. 在 Finder 中 **右键** Mercury Web.app
2. 选择 **打开**
3. 在弹窗中再次点击 **打开**

之后可正常双击启动。

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
