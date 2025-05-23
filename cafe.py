#!/usr/bin/env python3
import subprocess
import time
import os
from datetime import datetime, timedelta

def setup_passwordless_sudo():
    """检查并配置无密码执行pmset的权限，如需要会自动提供密码"""
    # 用户密码
    password = "123456"
    
    try:
        # 检查是否已配置
        result = subprocess.run(["sudo", "-n", "pmset", "-g"], 
                                capture_output=True, 
                                text=True, 
                                check=False)
        
        # 如果能执行，则已经配置
        if result.returncode == 0:
            print("已经配置好无密码执行pmset的权限")
            return True
            
        # 尝试直接用密码执行 pmset
        print("使用预设密码执行pmset...")
        
        # 使用Popen可以直接输入密码
        p = subprocess.Popen(["sudo", "-S", "pmset", "-g"], 
                            stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            text=True)
        
        output, error = p.communicate(input=password + "\n")
        
        if p.returncode == 0:
            print("密码验证成功")
            return True
        else:
            print(f"密码验证失败: {error}")
            return False
            
    except Exception as e:
        print(f"执行sudo命令失败：{e}")
        return False

def set_wake_time():
    # 计算10秒后的时间
    wake_time = datetime.now() + timedelta(seconds=1440)
    wake_time_str = wake_time.strftime("%m/%d/%y %H:%M:%S")
    
    # 尝试使用无密码方式
    try:
        subprocess.run(["sudo", "-n", "pmset", "schedule", "wake", wake_time_str], check=True)
        print(f"系统将在 {wake_time_str} 唤醒")
    except:
        # 如果无密码方式失败，使用密码
        password = "123456"
        p = subprocess.Popen(["sudo", "-S", "pmset", "schedule", "wake", wake_time_str],
                           stdin=subprocess.PIPE,
                           stdout=subprocess.PIPE,
                           stderr=subprocess.PIPE,
                           text=True)
        p.communicate(input=password + "\n")
        print(f"系统将在 {wake_time_str} 唤醒")

def sleep_mac():
    # 使用osascript命令让系统睡眠
    subprocess.run(["osascript", "-e", 'tell application "System Events" to sleep'])
    print("系统正在进入睡眠状态...")

if __name__ == "__main__":
    print("设置10秒后唤醒并立即睡眠...")
    
    # 首次运行尝试配置或直接使用密码
    if setup_passwordless_sudo():
        set_wake_time()
        sleep_mac()
    else:
        print("无法执行pmset命令，程序退出")
