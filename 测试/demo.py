#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import subprocess
import sys

def switch_desktop(direction):
    """
    使用Control+方向键切换全屏桌面
    
    参数:
        direction: 字符串，"left" 或 "right"，表示切换方向
    """
    if direction.lower() not in ["left", "right"]:
        print("错误: 方向必须是 'left' 或 'right'")
        return False
    
    # 确定键名
    key_name = "left arrow" if direction.lower() == "left" else "right arrow"
    
    # 创建AppleScript命令
    apple_script = f'''
    tell application "System Events"
        key down control
        key code {123 if direction.lower() == "left" else 124}
        key up control
    end tell
    '''
    
    # 执行AppleScript
    try:
        subprocess.run(['osascript', '-e', apple_script], check=True)
        print(f"已切换到{direction}侧桌面")
        return True
    except subprocess.CalledProcessError as e:
        print(f"错误: 无法执行桌面切换: {e}")
        return False

def main():
    """主函数，处理命令行参数"""
    if len(sys.argv) != 2 or sys.argv[1].lower() not in ["left", "right"]:
        print("用法: python demo.py [left|right]")
        print("例如: python demo.py left  # 切换到左侧桌面")
        print("      python demo.py right # 切换到右侧桌面")
        return
    
    direction = sys.argv[1].lower()
    print(f"正在切换到{direction}侧桌面...")
    
    # 执行桌面切换
    switch_desktop(direction)

if __name__ == "__main__":
    main()
