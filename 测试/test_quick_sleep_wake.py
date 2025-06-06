import requests
import time

def test_quick_sleep_wake():
    """测试快速睡眠唤醒HTTP接口"""
    print("开始测试快速睡眠唤醒HTTP接口...")
    
    try:
        # 发送请求到快速睡眠唤醒接口
        response = requests.get('http://localhost:5003/quick-sleep-wake')
        
        # 输出响应内容
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {response.json()}")
        
        # 检查响应是否成功
        if response.status_code == 200 and response.json().get('success'):
            print("测试成功: 系统应该会短暂睡眠并自动唤醒")
        else:
            print("测试失败: 请求未成功")
            
    except Exception as e:
        print(f"测试出错: {e}")

if __name__ == "__main__":
    test_quick_sleep_wake()
    print("测试完成") 