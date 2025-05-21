import socketio
import time
import sys

# 创建Socket.IO客户端
sio = socketio.Client()

# 设置WebSocket服务器地址
server_url = "http://47.106.254.103:5003"

# 连接事件处理
@sio.event
def connect():
    print(f"已连接到服务器: {server_url}")

# 断开连接事件处理
@sio.event
def disconnect():
    print("已断开连接")

# 错误事件处理
@sio.event
def connect_error(data):
    print(f"连接错误: {data}")

# 处理open_url_response事件
@sio.on('open_url_response')
def on_open_url_response(data):
    print(f"收到URL发送响应: {data}")
    
# 处理status_update事件
@sio.on('status_update')
def on_status_update(data):
    print(f"收到状态更新: {data}")

def send_url(url):
    """发送URL到服务器"""
    print(f"发送URL: {url}")
    sio.emit('open_url', {'url': url})
    # 等待响应
    time.sleep(2)

def main():
    # 从命令行参数获取URL，如果没有提供则使用默认值
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.example.com"
    
    try:
        # 连接到服务器
        print(f"正在连接到 {server_url}...")
        sio.connect(server_url)
        
        # 发送URL
        send_url(url)
        
        # 保持连接一段时间以接收响应
        time.sleep(3)
        
    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        # 断开连接
        if sio.connected:
            sio.disconnect()

if __name__ == "__main__":
    main() 