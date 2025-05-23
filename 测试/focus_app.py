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