from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import subprocess
import time
import threading
import datetime
import asyncio
import websockets
from 测试.focus_app import focus_app
from cafe import sleep_mac, set_wake_time, setup_passwordless_sudo

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=60, ping_interval=25)

# ESP32设备配置
ESP32_CONFIG = {
    "ip": "192.168.1.115",  # ESP32的IP地址，请根据实际情况修改
    "port": 80,             # ESP32的WebSocket端口
    "ws_path": "/ws"        # WebSocket路径
}

# 屏幕唤醒状态管理
screen_wake_status = {
    "is_active": False,
    "end_time": None,
    "duration_minutes": 0
}

# 记录今天是否已经有用户触发了屏幕唤醒
first_user_wake_triggered = False
first_user_wake_date = None

# ESP32 WebSocket客户端功能
async def send_key_to_esp32(key_code):
    """发送按键码到ESP32设备"""
    websocket_url = f"ws://{ESP32_CONFIG['ip']}:{ESP32_CONFIG['port']}{ESP32_CONFIG['ws_path']}"
    
    try:
        print(f"正在连接到ESP32: {websocket_url}")
        async with websockets.connect(websocket_url) as websocket:
            await websocket.send(key_code)
            print(f"已发送按键: {key_code}")
            return True
    except Exception as e:
        print(f"发送按键到ESP32失败: {e}")
        return False

def send_key_to_esp32_sync(key_code):
    """同步版本的ESP32按键发送函数"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(send_key_to_esp32(key_code))
        return result
    finally:
        loop.close()

# 控制音量的函数
def change_volume(direction):
    """调整系统音量，每次增减5%"""
    if direction == "up":
        cmd = "osascript -e 'set volume output volume (output volume of (get volume settings) + 5) --100%'"
    else:
        cmd = "osascript -e 'set volume output volume (output volume of (get volume settings) - 5) --100%'"
    subprocess.run(cmd, shell=True)
    return get_current_volume()

def set_volume(volume_level):
    """直接设置系统音量到指定值"""
    # 确保音量在0-100之间
    volume_level = max(0, min(100, volume_level))
    cmd = f"osascript -e 'set volume output volume {volume_level} --100%'"
    subprocess.run(cmd, shell=True)
    return get_current_volume()

def get_current_volume():
    """获取当前系统音量"""
    cmd = "osascript -e 'output volume of (get volume settings)'"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return int(result.stdout.strip())

# 模拟键盘上下键
def press_key(key):
    """模拟按键"""
    key_codes = {
        "up": 126,    # 上箭头
        "down": 125,  # 下箭头
        "left": 123,  # 左箭头
        "right": 124, # 右箭头
        "space": 49,  # 空格键
        "f": 3        # f 键
    }
    
    if key in key_codes:
        cmd = f"osascript -e 'tell application \"System Events\" to key code {key_codes[key]}'"
        subprocess.run(cmd, shell=True)
        return True
    return False

# 切换桌面的函数
def switch_desktop(direction):
    """
    使用Control+方向键切换全屏桌面
    
    参数:
        direction: 字符串，"left" 或 "right"，表示切换方向
    """
    if direction not in ["left", "right"]:
        return False
    
    # 创建AppleScript命令
    apple_script = f'''
    tell application "System Events"
        key down control
        key code {123 if direction == "left" else 124}
        key up control
    end tell
    '''
    
    # 执行AppleScript
    try:
        subprocess.run(['osascript', '-e', apple_script], check=True)
        return True
    except Exception:
        return False

# 暂停播放并切换桌面的函数
def pause_switch_resume(direction):
    """
    切换桌面的逻辑：
    - 左边桌面（浏览器）通过WebSocket控制视频
    - 右边桌面（app）通过空格键控制视频
    
    参数:
        direction: 字符串，"left" 或 "right"，表示切换方向
    """
    if direction not in ["left", "right"]:
        return False
    
    try:
        if direction == "left":
            # 切换到左边桌面（浏览器桌面）
            # 1. 先按空格键暂停当前app的视频
            press_key("space")
            
            # 2. 等待短暂时间
            time.sleep(0.5)
            
            # 3. 切换到浏览器桌面
            success = switch_desktop(direction)
            
            # 4. 等待切换完成
            time.sleep(0.5) 
            
            # 5. 激活 Google Chrome
            focus_app("Google Chrome")
            
            # 6. 通过WebSocket发送播放命令给浏览器
            socketio.emit('video_control_command', {
                "action": "play",
                "timestamp": int(__import__('time').time())
            })
            
        else:  # direction == "right"
            # 切换到右边桌面（app桌面）
            # 1. 通过WebSocket发送暂停命令给浏览器
            socketio.emit('video_control_command', {
                "action": "pause",
                "timestamp": int(__import__('time').time())
            })
            
            # 2. 等待短暂时间，确保浏览器处理暂停命令
            time.sleep(0.5)
             
            # 3. 切换到app桌面
            success = switch_desktop(direction)
            
            # 4. 等待切换完成
            time.sleep(0.5)
            
            # 5. 按空格键恢复app的视频播放
            press_key("space")
            
        return success
    except Exception as e:
        print(f"执行桌面切换过程出错: {e}")
        return False

# 屏幕唤醒相关函数
def wake_screen(duration_minutes):
    """唤醒屏幕并设置持续时间"""
    # 使用全局变量
    global screen_wake_status
    
    # 使用caffeinate命令防止系统睡眠
    # -u 选项特别用于保持屏幕处于唤醒状态
    # -t 选项设置持续时间（秒）
    duration_seconds = duration_minutes * 60
    
    # 设置结束时间
    end_time = datetime.datetime.now() + datetime.timedelta(minutes=duration_minutes)
    
    # 更新唤醒状态
    screen_wake_status["is_active"] = True
    screen_wake_status["end_time"] = end_time
    screen_wake_status["duration_minutes"] = duration_minutes
    
    # 使用线程运行命令，避免阻塞主线程
    def run_caffeinate():
        # 使用全局变量
        global screen_wake_status
        
        try:
            subprocess.run(["caffeinate", "-u", "-t", str(duration_seconds)], check=True)
            print(f"屏幕已唤醒，持续{duration_minutes}分钟")
            
            # 命令执行完成后更新状态
            screen_wake_status["is_active"] = False
            screen_wake_status["end_time"] = None
            screen_wake_status["duration_minutes"] = 0
            
            # 通知所有客户端唤醒结束
            socketio.emit('wake_status_update', get_wake_status())
        except Exception as e:
            print(f"屏幕唤醒出错: {e}")
            # 出错时也更新状态
            screen_wake_status["is_active"] = False
            screen_wake_status["end_time"] = None
            screen_wake_status["duration_minutes"] = 0
            socketio.emit('wake_status_update', get_wake_status())
    
    # 启动线程
    wake_thread = threading.Thread(target=run_caffeinate)
    wake_thread.daemon = True
    wake_thread.start()
    
    return get_wake_status()

def get_wake_status():
    """获取当前屏幕唤醒状态"""
    global screen_wake_status
    
    status = {
        "is_active": screen_wake_status["is_active"],
        "duration_minutes": screen_wake_status["duration_minutes"],
        "remaining_seconds": 0
    }
    
    # 如果唤醒状态活跃，计算剩余时间
    if status["is_active"] and screen_wake_status["end_time"]:
        now = datetime.datetime.now()
        if now < screen_wake_status["end_time"]:
            remaining = screen_wake_status["end_time"] - now
            status["remaining_seconds"] = int(remaining.total_seconds())
        else:
            # 已经过期，但状态未更新
            status["is_active"] = False
            status["remaining_seconds"] = 0
            screen_wake_status["is_active"] = False
    
    return status

# WebSocket事件处理
@socketio.on('connect')
def handle_connect():
    """客户端连接时的处理"""
    global first_user_wake_triggered, first_user_wake_date
    
    # 获取当前状态
    current_volume = get_current_volume()
    wake_status = get_wake_status()
    
    emit('status_update', {
        'status': '已连接',
        'current_volume': current_volume
    })
    
    # 发送当前屏幕唤醒状态
    emit('wake_status_update', wake_status)
    print("客户端已连接")
    
    # 修改逻辑：只要屏幕未处于唤醒状态，无论是哪个用户，都自动唤醒屏幕
    if not wake_status["is_active"]:
        # 唤醒屏幕 (2小时)
        wake_status = wake_screen(120)
        
        # 向当前客户端发送唤醒成功的响应
        emit('wake_screen_response', {
            "success": True,
            "message": "屏幕已自动唤醒，持续120分钟",
            "wake_status": wake_status,
            "auto_triggered": True
        })
        
        # 向所有客户端广播唤醒状态
        socketio.emit('wake_status_update', wake_status)
        print("用户连接触发屏幕唤醒")

@socketio.on('disconnect')
def handle_disconnect():
    """客户端断开连接时的处理"""
    print("客户端已断开")

@socketio.on('key_press')
def handle_key_press(data):
    """处理按键请求"""
    direction = data.get('direction')
    if direction not in ['up', 'down', 'left', 'right', 'f']:
        emit('error', {"error": "无效的按键，请使用 'up'、'down'、'left'、'right' 或 'f'"})
        return
    
    success = press_key(direction)
    emit('key_press_response', {
        "success": success, 
        "direction": direction
    })

@socketio.on('volume_control')
def handle_volume_control(data):
    """处理音量控制请求"""
    direction = data.get('direction')
    if direction not in ['up', 'down']:
        emit('error', {"error": "方向无效，请使用 'up' 或 'down'"})
        return
    
    current_volume = change_volume(direction)
    emit('volume_update', {
        "success": True,
        "direction": direction,
        "current_volume": current_volume
    })
    # 广播给所有连接的客户端
    socketio.emit('volume_broadcast', {
        "current_volume": current_volume
    })

@socketio.on('set_volume')
def handle_set_volume(data):
    """设置特定音量值"""
    try:
        volume = int(data.get('volume', 0))
        if volume < 0 or volume > 100:
            emit('error', {"error": "音量必须在0-100之间"})
            return
            
        current_volume = set_volume(volume)
        emit('volume_update', {
            "success": True,
            "volume": volume,
            "current_volume": current_volume
        })
        # 广播给所有连接的客户端
        socketio.emit('volume_broadcast', {
            "current_volume": current_volume
        })
    except ValueError:
        emit('error', {"error": "无效的音量值"})

@socketio.on('play_pause')
def handle_play_pause():
    """控制媒体播放/暂停"""
    success = press_key("space")
    emit('play_pause_response', {
        "success": success,
        "action": "play_pause"
    })

@socketio.on('get_status')
def handle_get_status():
    """获取当前状态"""
    current_volume = get_current_volume()
    emit('status_update', {
        "status": "运行中",
        "current_volume": current_volume
    })

@socketio.on('open_url')
def handle_open_url(data):
    """处理打开URL的请求"""
    url = data.get('url')
    if not url:
        emit('error', {"error": "URL不能为空"})
        return
    
    # 广播URL给所有连接的客户端
    socketio.emit('open_url_command', {
        "url": url,
        "timestamp": int(__import__('time').time())
    })
    
    emit('open_url_response', {
        "success": True,
        "url": url,
        "message": "URL已发送到浏览器"
    })

@socketio.on('video_control')
def handle_video_control(data):
    """处理视频控制命令（播放/暂停）"""
    action = data.get('action')
    if action not in ['play', 'pause']:
        emit('error', {"error": "无效的操作，支持 'play', 'pause'"})
        return
    
    # 广播视频控制命令给所有客户端
    socketio.emit('video_control_command', {
        "action": action,
        "timestamp": int(__import__('time').time())
    })
    
    emit('video_control_response', {
        "success": True,
        "action": action,
        "message": f"视频控制命令 '{action}' 已发送"
    })

@socketio.on('switch_desktop')
def handle_switch_desktop(data):
    """处理桌面切换请求"""
    direction = data.get('direction')
    
    if direction not in ['left', 'right']:
        emit('error', {"error": "方向无效，请使用 'left' 或 'right'"})
        return
    
    print(f"通过WebSocket请求切换桌面: {direction}")
    success = pause_switch_resume(direction)
        
    emit('switch_desktop_response', {
        "success": success, 
        "direction": direction
    })

@socketio.on('wake_screen')
def handle_wake_screen(data):
    """处理屏幕唤醒请求"""
    duration_minutes = int(data.get('duration_minutes', 120))
    
    # 检查当前是否已经在唤醒状态
    current_status = get_wake_status()
    if current_status["is_active"]:
        emit('error', {"error": "屏幕已经处于唤醒状态"})
        return
    
    # 唤醒屏幕
    wake_status = wake_screen(duration_minutes)
    
    # 向发送请求的客户端发送响应
    emit('wake_screen_response', {
        "success": True,
        "message": f"屏幕已唤醒，持续{duration_minutes}分钟",
        "wake_status": wake_status
    })
    
    # 向所有客户端广播唤醒状态
    socketio.emit('wake_status_update', wake_status)

@socketio.on('get_wake_status')
def handle_get_wake_status():
    """获取屏幕唤醒状态"""
    wake_status = get_wake_status()
    emit('wake_status_update', wake_status)

@socketio.on('system_sleep')
def handle_system_sleep(data):
    """处理系统睡眠请求"""
    try:
        # 通过WebSocket发送暂停命令给所有客户端
        socketio.emit('video_control_command', {
            "action": "pause",
            "timestamp": int(__import__('time').time())
        })
        
        # 等待短暂时间确保命令被执行
        time.sleep(0.5)
        
        # 设置无密码执行pmset的权限
        if setup_passwordless_sudo():
            # 设置10秒后唤醒
            set_wake_time()
            
            # 执行系统睡眠操作
            sleep_mac()
            
            emit('system_sleep_response', {
                "success": True,
                "message": "系统正在进入睡眠状态，10秒后将自动唤醒"
            })
        else:
            emit('system_sleep_response', {
                "success": False,
                "message": "无法配置无密码执行pmset的权限"
            })
    except Exception as e:
        emit('system_sleep_response', {
            "success": False,
            "message": str(e)
        })

@socketio.on('keep_alive')
def handle_keep_alive():
    """处理保持连接的心跳消息"""
    # 仅记录日志，不需要实际处理
    pass

@socketio.on('quick_sleep_wake')
def handle_quick_sleep_wake():
    """处理快速睡眠唤醒请求来停止所有音频"""
    try:
        # 设置10秒后唤醒
        set_wake_time()
        # 立即睡眠
        sleep_mac()
        emit('quick_sleep_wake_response', {
            "success": True,
            "message": "系统将短暂睡眠并自动唤醒"
        })
    except Exception as e:
        emit('quick_sleep_wake_response', {
            "success": False,
            "message": str(e)
        })

@socketio.on('send_esp32_key')
def handle_send_esp32_key(data):
    """处理发送按键到ESP32的请求"""
    key_code = data.get('key_code', 'FLAG')
    # 启动线程发送按键，避免阻塞主线程
    def send_key_thread():
        success = send_key_to_esp32_sync(key_code)
        # 发送结果通知给客户端
        socketio.emit('esp32_key_response', {
            'success': success,
            'key_code': key_code,
            'message': '发送成功' if success else '发送失败'
        })
    
    threading.Thread(target=send_key_thread).start()
    return {'status': 'sending'}

# 主页路由
@app.route('/')
def index():
    """渲染遥控器前端界面"""
    return render_template('index.html')

# 添加HTTP路由接收链接
@app.route('/send-url', methods=['GET', 'POST'])
def send_url_http():
    """通过HTTP请求接收并广播URL"""
    if request.method == 'POST':
        url = request.form.get('url')
    else:  # GET请求
        url = request.args.get('url')
    
    # 验证URL
    if not url:
        return jsonify({
            "success": False,
            "error": "URL不能为空"
        }), 400
    
    # 广播URL给所有连接的客户端
    socketio.emit('open_url_command', {
        "url": url,
        "timestamp": int(__import__('time').time())
    })
    return jsonify({
        "success": True,
        "url": url,
        "message": "URL已发送到浏览器"
    })

# 添加HTTP路由发送ESP32按键
@app.route('/send-esp32-key', methods=['GET'])
def send_esp32_key_http():
    """通过HTTP请求发送按键到ESP32"""
    key_code = request.args.get('key_code')
    if not key_code:
        return jsonify({
            "success": False,
            "error": "key_code参数不能为空"
        }), 400
    
    # 发送按键到ESP32
    success = send_key_to_esp32_sync(key_code)
    
    return jsonify({
        "success": success,
        "key_code": key_code,
        "message": "按键已发送到ESP32" if success else "发送按键失败"
    })

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5003, debug=True)