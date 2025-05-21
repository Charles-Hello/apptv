# Apple TV 遥控器

一个基于 Flask 和 Socket.IO 的 Apple TV 远程控制应用，可以通过网页界面控制 Apple TV 或播放设备。

![Apple TV 遥控器界面](readme/index.jpg)

## 功能特点

- 📱 响应式网页界面，适配移动设备
- 🎮 远程控制 Apple TV 和播放设备
- 🔊 音量调节控制
- ⏯️ 播放/暂停控制
- 🖥️ 屏幕唤醒功能
- 📱 双向通信 - 一台设备的操作可同步到所有连接设备
- 🖼️ 桌面切换功能
- 📺 电影/电视切换按钮

## 系统要求

- macOS (支持 `osascript` 命令)
- Python 3.6+
- 连接同一网络的设备用于遥控

## 安装步骤

1. 克隆仓库：

```bash
git clone https://github.com/yourusername/apptv.git
cd apptv
```

2. 安装依赖：

```bash
pip install flask flask-socketio
```

3. 运行服务器：

```bash
python main.py
```

4. 通过浏览器访问：

```
http://[您电脑的IP地址]:5003
```

## 浏览器扩展

项目包含一个油猴脚本，用于在浏览器中接收和处理远程命令：

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 添加 `油猴插件/demo.js` 脚本到 Tampermonkey

## 使用方法

1. 确保您的计算机和控制设备在同一网络中
2. 在计算机上运行服务器
3. 在移动设备浏览器中访问服务器地址
4. 使用界面控制 Apple TV 或播放设备

### 主要功能

- **音量控制**：调整系统音量
- **方向控制**：使用方向键控制导航
- **播放控制**：播放/暂停当前媒体
- **屏幕唤醒**：防止系统进入睡眠状态
- **桌面切换**：在不同桌面间切换，适用于全屏应用

## 技术实现

- 后端：Flask + Flask-SocketIO
- 前端：HTML + CSS + JavaScript + Socket.IO 客户端
- 系统交互：通过 `osascript` 执行 AppleScript 命令

## 项目结构

```
.
├── main.py             # Flask 服务器和主要功能
├── templates/          # HTML 模板
│   └── index.html      # 遥控器界面
├── static/             # 静态资源
│   ├── styles.css      # CSS 样式
│   ├── script.js       # 客户端 JavaScript
│   └── icons/          # 图标资源
└── 油猴插件/            # 浏览器扩展
    └── demo.js         # 油猴脚本
```

## 自定义

您可以根据需要修改以下内容：

- 调整端口号（默认 5003）
- 自定义界面样式
- 添加更多控制功能

## 许可证

MIT 许可证 