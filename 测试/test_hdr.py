#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
HDR控制测试脚本
用于测试通过HTTP接口控制HDR开关功能
"""

import requests
import time
import argparse

# 服务器地址
SERVER_URL = "http://localhost:5003"

def get_hdr_status():
    """获取当前HDR状态"""
    try:
        response = requests.get(f"{SERVER_URL}/hdr-status")
        if response.status_code == 200:
            data = response.json()
            return data.get("is_on", False)
        else:
            print(f"获取HDR状态失败: HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"获取HDR状态出错: {e}")
        return None

def toggle_hdr(action=None):
    """切换HDR状态
    
    参数:
        action: 可选，'on'表示开启，'off'表示关闭，None表示切换当前状态
    """
    try:
        url = f"{SERVER_URL}/toggle-hdr"
        if action:
            url += f"?action={action}"
        
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success", False):
                print(f"HDR切换成功: {data.get('message', '')}")
                return True
            else:
                print(f"HDR切换失败: {data.get('message', '未知错误')}")
                return False
        else:
            print(f"HDR切换请求失败: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"HDR切换出错: {e}")
        return False

def toggle_sequence():
    """执行一系列切换操作，测试功能完整性"""
    print("开始HDR切换序列测试...")
    
    # 获取当前状态
    current_status = get_hdr_status()
    if current_status is None:
        print("无法获取当前HDR状态，测试终止")
        return False
    
    print(f"当前HDR状态: {'开启' if current_status else '关闭'}")
    
    # 测试1: 切换到开启状态
    print("\n测试1: 切换到开启状态")
    toggle_hdr('on')
    time.sleep(1)
    
    # 验证状态
    new_status = get_hdr_status()
    if new_status is True:
        print("测试1通过: HDR已开启")
    else:
        print("测试1失败: HDR未能开启")
    
    # 测试2: 切换到关闭状态
    print("\n测试2: 切换到关闭状态")
    toggle_hdr('off')
    time.sleep(1)
    
    # 验证状态
    new_status = get_hdr_status()
    if new_status is False:
        print("测试2通过: HDR已关闭")
    else:
        print("测试2失败: HDR未能关闭")
    
    # 测试3: 切换当前状态
    print("\n测试3: 切换当前状态")
    current_status = get_hdr_status()
    toggle_hdr()  # 不指定action，应该切换当前状态
    time.sleep(1)
    
    # 验证状态
    new_status = get_hdr_status()
    if new_status != current_status:
        print(f"测试3通过: HDR状态已从{'开启' if current_status else '关闭'}切换到{'开启' if new_status else '关闭'}")
    else:
        print("测试3失败: HDR状态未能切换")
    
    print("\nHDR切换序列测试完成")
    return True

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='HDR控制测试工具')
    parser.add_argument('--action', choices=['on', 'off', 'toggle', 'status', 'test'], 
                        default='status', help='要执行的操作')
    
    args = parser.parse_args()
    
    if args.action == 'on':
        toggle_hdr('on')
    elif args.action == 'off':
        toggle_hdr('off')
    elif args.action == 'toggle':
        toggle_hdr()
    elif args.action == 'status':
        status = get_hdr_status()
        if status is not None:
            print(f"当前HDR状态: {'开启' if status else '关闭'}")
    elif args.action == 'test':
        toggle_sequence()

if __name__ == "__main__":
    main() 