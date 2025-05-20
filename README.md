# macOS控制服务器

这是一个简单的HTTP服务器，用于远程控制macOS电脑的键盘方向键和音量调节。包含美观的遥控器界面。

## 功能

- 控制键盘上下箭头按键
- 控制系统音量增加和减小（直接拖动滑块）
- 控制媒体播放/暂停（空格键）
- 获取系统状态信息
- 遥控器样式的Web界面

## 安装依赖

```bash
pip install flask
```

## 运行服务器

```bash
python demo.py
```

服务器将在`http://0.0.0.0:5003`上启动，可以从网络中的其他设备访问。

## 使用方法

### Web界面

访问 `http://[你的IP地址]:5003` 即可打开遥控器界面:

- **调节音量**: 直接拖动音量滑块
- **播放/暂停**: 点击紫色的播放/暂停按钮
- **方向控制**: 点击蓝色的上下箭头按钮

### API接口

如果需要直接调用API：

#### 按键控制

- `/key/up` - 模拟按下上箭头键
- `/key/down` - 模拟按下下箭头键

#### 音量控制

- `/volume/up` - 增加系统音量5%
- `/volume/down` - 减少系统音量5%
- `/volume/set` - 直接设置系统音量（POST请求，需要JSON格式的volume参数）

#### 播放控制

- `/play_pause` - 控制媒体播放/暂停（模拟空格键）

#### 状态查询

- `/status` - 获取当前系统状态，包括音量信息

## 项目结构

```
.
├── demo.py          # 后端服务器
├── static/          # 静态资源目录
│   ├── styles.css   # 遥控器样式
│   └── script.js    # 前端交互脚本
├── templates/       # 模板目录
│   └── index.html   # 遥控器界面
└── README.md        # 项目说明
```

## 示例使用

在浏览器访问:
```
http://[你的IP地址]:5003
```

API调用示例:
```
# 获取状态
curl http://[你的IP地址]:5003/status

# 控制播放/暂停
curl http://[你的IP地址]:5003/play_pause

# 设置音量到50%
curl -X POST -H "Content-Type: application/json" -d '{"volume":50}' http://[你的IP地址]:5003/volume/set
``` 