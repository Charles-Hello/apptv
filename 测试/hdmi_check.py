#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import subprocess
import json
import re
import time
import pprint

def get_display_info_detailed():
    """获取显示器详细连接信息"""
    try:
        # 使用system_profiler获取显示器信息，以JSON格式输出
        cmd = ["system_profiler", "SPDisplaysDataType", "-json"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        
        return data
    except Exception as e:
        print(f"获取显示器信息时出错: {e}")
        return {}

def get_display_info():
    """获取显示器连接信息"""
    try:
        data = get_display_info_detailed()
        
        # 解析显示器信息
        displays_info = []
        if 'SPDisplaysDataType' in data:
            for gpu in data['SPDisplaysDataType']:
                if 'spdisplays_ndrvs' in gpu:
                    for display in gpu['spdisplays_ndrvs']:
                        display_type = display.get('_spdisplays_display-type', '')
                        display_name = display.get('_name', 'Unknown Display')
                        connection = display.get('_spdisplays_connection_type', '')
                        
                        # 提取更多信息
                        resolution = display.get('_spdisplays_resolution', '')
                        pixel_resolution = display.get('_spdisplays_pixels', '')
                        refresh_rate = display.get('_spdisplays_refresh_rate', '')
                        
                        displays_info.append({
                            'name': display_name,
                            'type': display_type,
                            'connection': connection,
                            'resolution': resolution,
                            'pixel_resolution': pixel_resolution,
                            'refresh_rate': refresh_rate
                        })
        
        return displays_info
    except Exception as e:
        print(f"解析显示器信息时出错: {e}")
        return []

def check_external_displays():
    """检查所有外接显示器"""
    displays = get_display_info()
    
    external_displays = []
    for display in displays:
        # 排除内置显示器
        if 'internal' not in display.get('type', '').lower():
            external_displays.append(display)
    
    return external_displays

def check_hdmi_connection():
    """检查HDMI连接状态"""
    displays = get_display_info()
    
    hdmi_displays = []
    for display in displays:
        # 检查连接类型是否包含HDMI
        if 'HDMI' in display.get('connection', ''):
            hdmi_displays.append(display)
    
    return hdmi_displays

def get_all_display_info():
    """获取所有显示器的详细信息"""
    try:
        # 使用多种方法获取显示器信息
        cmd1 = ["system_profiler", "SPDisplaysDataType"]
        result1 = subprocess.run(cmd1, capture_output=True, text=True)
        
        cmd2 = ["ioreg", "-l", "-d", "2", "-c", "IODisplay"]
        result2 = subprocess.run(cmd2, capture_output=True, text=True)
        
        return {
            'system_profiler': result1.stdout,
            'ioreg': result2.stdout
        }
    except Exception as e:
        print(f"获取显示器详细信息时出错: {e}")
        return {}

def monitor_displays(interval=2):
    """持续监控显示器连接状态"""
    print("开始监控显示器连接状态 (按Ctrl+C退出)...")
    try:
        while True:
            external_displays = check_external_displays()
            
            if external_displays:
                print("\n检测到外接显示器:")
                for display in external_displays:
                    print(f"  - 名称: {display['name']}")
                    print(f"    类型: {display['type']}")
                    print(f"    连接: {display.get('connection', '未知')}")
                    print(f"    分辨率: {display.get('resolution', '未知')}")
                    print(f"    像素: {display.get('pixel_resolution', '未知')}")
                    print(f"    刷新率: {display.get('refresh_rate', '未知')}")
            else:
                print("\n未检测到外接显示器")
            
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n监控已停止")

def main():
    print("macOS 显示器检测工具")
    print("-" * 30)
    
    # 检查当前显示器状态
    external_displays = check_external_displays()
    hdmi_displays = check_hdmi_connection()
    
    if external_displays:
        print("检测到以下外接显示器:")
        for display in external_displays:
            print(f"  - 名称: {display['name']}")
            print(f"    类型: {display['type']}")
            print(f"    连接: {display.get('connection', '未知')}")
            print(f"    分辨率: {display.get('resolution', '未知')}")
            print(f"    像素: {display.get('pixel_resolution', '未知')}")
            print(f"    刷新率: {display.get('refresh_rate', '未知')}")
    else:
        print("未检测到外接显示器")
    
    if hdmi_displays:
        print("\n其中HDMI连接的显示器:")
        for display in hdmi_displays:
            print(f"  - 名称: {display['name']}")
    
    print("\n选择操作:")
    print("1. 持续监控显示器连接状态")
    print("2. 显示详细的原始显示器信息")
    print("3. 退出")
    
    choice = input("请选择 (1-3): ")
    
    if choice == '1':
        monitor_displays()
    elif choice == '2':
        print("\n获取详细显示器信息...")
        detailed_info = get_all_display_info()
        
        print("\n=== System Profiler 输出 ===")
        print(detailed_info['system_profiler'])
        
        print("\n=== IORegistry 输出 ===")
        print(detailed_info['ioreg'])
        
        print("\n=== JSON 格式数据 ===")
        pprint.pprint(get_display_info_detailed())

if __name__ == "__main__":
    main() 