#!/usr/bin/env python3
"""测试 Enter 键功能"""

import subprocess
import time

def press_key(key):
    """模拟按键"""
    key_codes = {
        "enter": 36,   # Enter键
        "space": 49,   # 空格键
    }

    if key in key_codes:
        cmd = f"osascript -e 'tell application \"System Events\" to key code {key_codes[key]}'"
        subprocess.run(cmd, shell=True)
        return True
    return False

if __name__ == '__main__':
    print("=" * 60)
    print("测试 Enter 键功能")
    print("=" * 60)
    print()
    print("请在 3 秒内切换到一个文本框或搜索框...")
    print("脚本将自动按下 Enter 键")
    print()

    # 倒计时
    for i in range(3, 0, -1):
        print(f"{i}...")
        time.sleep(1)

    # 按下 Enter 键
    print("\n按下 Enter 键...")
    success = press_key("enter")

    if success:
        print("✓ Enter 键已发送")
    else:
        print("✗ Enter 键发送失败")

    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)
