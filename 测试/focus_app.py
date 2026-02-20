#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import subprocess
import sys

def focus_app(app_name):
    """
    查找并激活指定的应用程序窗口，将其置于前台
    
    参数:
        app_name: 字符串，应用程序的名称，例如 "Google Chrome" 或 "Safari"
    """
    # 创建AppleScript命令
    apple_script = f'''
    tell application "{app_name}"
        activate
    end tell
    '''
    
    # 执行AppleScript
    try:
        subprocess.run(['osascript', '-e', apple_script], check=True)
        print(f"已激活应用程序: {app_name}")
        return True
    except Exception as e:
        print(f"激活应用程序 {app_name} 失败: {e}")
        return False

def focus_chrome_window_by_url(url_pattern):
    """
    在 Chrome 所有窗口和标签页中查找包含指定 URL 的窗口并聚焦。
    找到后将该窗口置于最前并激活 Chrome。

    参数:
        url_pattern: 字符串，URL 中包含的关键词，例如 "gdtv.cn" 或 "bilibili.com"
    返回:
        True 表示找到并聚焦成功，False 表示未找到
    """
    apple_script = f'''
    tell application "Google Chrome"
        set wCount to count of windows
        repeat with i from 1 to wCount
            set w to item i of windows
            repeat with t in tabs of w
                if URL of t contains "{url_pattern}" then
                    set active tab index of w to tab index of t
                    set index of w to 1
                    activate
                    return true
                end if
            end repeat
        end repeat
    end tell
    return false
    '''
    try:
        result = subprocess.run(['osascript', '-e', apple_script], capture_output=True, text=True, check=False)
        success = result.stdout.strip() == 'true'
        if success:
            print(f"已聚焦包含 '{url_pattern}' 的 Chrome 窗口")
        else:
            print(f"未找到包含 '{url_pattern}' 的 Chrome 窗口")
        return success
    except Exception as e:
        print(f"Chrome 窗口聚焦失败: {e}")
        return False


def main():
    """主函数，处理命令行参数"""
    if len(sys.argv) != 2:
        print("用法: python focus_app.py [应用程序名称]")
        print("例如: python focus_app.py 'Google Chrome'")
        print("      python focus_app.py Safari")
        return
    
    app_name = sys.argv[1]
    print(f"正在激活应用程序: {app_name}...")
    
    # 执行应用程序激活
    focus_app(app_name)

if __name__ == "__main__":
    main() 