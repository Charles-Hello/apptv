
"""
ESP32 HID Keyboard WebSocket Client
连接到ESP32并每隔5秒发送空格键
"""

import asyncio
import websockets
import time
import sys
import signal

class ESP32KeyboardClient:
    def __init__(self, esp32_ip, port=80):
        self.esp32_ip = esp32_ip
        self.port = port
        self.websocket_url = f"ws://{esp32_ip}:{port}/ws"
        self.websocket = None
        self.running = False
        
    async def connect(self):
        """连接到ESP32 WebSocket服务器"""
        try:
            print(f"正在连接到 {self.websocket_url}...")
            self.websocket = await websockets.connect(self.websocket_url)
            print("✅ WebSocket连接成功!")
            return True
        except Exception as e:
            print(f"❌ 连接失败: {e}")
            return False
            
    async def send_key(self, key_code):
        """发送按键码到ESP32"""
        if self.websocket:
            try:
                await self.websocket.send(key_code)
                print(f"📤 发送按键: {key_code}")
                return True
            except Exception as e:
                print(f"❌ 发送失败: {e}")
                return False
        return False
        
    async def send_space_periodically(self, interval=5):
        """每隔指定时间发送空格键"""
        self.running = True
        counter = 0
        
        while self.running:
            try:
                # 发送空格键
                success = await self.send_key("SPACE")
                if success:
                    counter += 1
                    print(f"⌨️  已发送第 {counter} 次空格键")
                else:
                    print("🔄 尝试重新连接...")
                    if await self.connect():
                        continue
                    else:
                        break
                        
                # 等待指定时间
                print(f"⏰ 等待 {interval} 秒...")
                await asyncio.sleep(interval)
                
            except asyncio.CancelledError:
                print("🛑 任务被取消")
                break
            except Exception as e:
                print(f"❌ 出现错误: {e}")
                print("🔄 尝试重新连接...")
                if not await self.connect():
                    break
                    
    async def close(self):
        """关闭WebSocket连接"""
        self.running = False
        if self.websocket:
            await self.websocket.close()
            print("🔌 WebSocket连接已关闭")

async def main():
    # ESP32的IP地址，请根据实际情况修改
    ESP32_IP = "192.168.1.115"  # 修改为您的ESP32 IP地址
    INTERVAL = 5  # 发送间隔（秒）
    
    print("=" * 50)
    print("🚀 ESP32 HID Keyboard WebSocket 客户端")
    print("=" * 50)
    print(f"📡 目标设备: {ESP32_IP}")
    print(f"⏱️  发送间隔: {INTERVAL} 秒")
    print(f"⌨️  发送按键: SPACE")
    print("按 Ctrl+C 退出程序")
    print("=" * 50)
    
    # 创建客户端实例
    client = ESP32KeyboardClient(ESP32_IP)
    
    try:
        # 尝试连接
        if await client.connect():
            # 开始周期性发送空格键
            await client.send_space_periodically(INTERVAL)
        else:
            print("❌ 无法连接到ESP32，请检查:")
            print("   1. ESP32是否已启动并连接WiFi")
            print("   2. IP地址是否正确")
            print("   3. 防火墙设置是否允许连接")
            
    except KeyboardInterrupt:
        print("\n🛑 用户中断程序")
    except Exception as e:
        print(f"❌ 程序异常: {e}")
    finally:
        await client.close()
        print("👋 程序退出")

def signal_handler(signum, frame):
    """处理信号中断"""
    print("\n🛑 接收到中断信号，正在退出...")
    sys.exit(0)

if __name__ == "__main__":
    # 设置信号处理器
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
     
    # 检查是否安装了websockets库
    try:
        import websockets
    except ImportError:
        print("❌ 缺少websockets库，请安装:")
        print("   pip install websockets")
        sys.exit(1)
    
    # 运行主程序
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 程序已退出") 