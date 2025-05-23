import requests
import sys

# 设置服务器地址
server_url = "http://47.106.254.103:5003/send-url"

def send_url(url):
    """通过HTTP请求发送URL到服务器"""
    print(f"正在发送URL: {url}")
    
    try:
        # 发送GET请求
        response = requests.get(f"{server_url}", params={"url": url})
        
        # 检查响应
        if response.status_code == 200:
            result = response.json()
            print(f"发送成功: {result['message']}")
            return True
        else:
            print(f"发送失败: HTTP状态码 {response.status_code}")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"请求出错: {e}")
        return False

def main():
    # 从命令行参数获取URL，如果没有提供则使用默认值
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.example.com"
    
    # 发送URL
    send_url(url)

if __name__ == "__main__":
    main() 