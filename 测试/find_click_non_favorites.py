#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import subprocess
import sys
import time
import pyautogui

def find_and_click_non_favorites_window():
    """
    找到APTV窗口，获取窗口信息，然后双击名称不包含"收藏 – 共17个频道"的窗口
    
    这个函数会:
    1. 激活APTV应用
    2. 获取所有窗口的详细信息
    3. 找到不是"收藏 – 共17个频道"的窗口
    4. 检查窗口是否全屏
    5. 在该窗口中央位置双击鼠标
    """
    # 1. 先激活APTV应用
    if not activate_aptv():
        print("激活APTV应用失败")
        return False
    
    # 2. 等待应用激活
    time.sleep(0.5)
    
    # 3. 获取窗口详细信息
    window_details = get_aptv_window_details()
    
    if not window_details:
        print("未能获取窗口信息")
        return False
    
    print("\n==== APTV窗口分析 ====")
    print(f"找到 {len(window_details)} 个APTV窗口")
    
    # 4. 找到不是"收藏 – 共17个频道"的窗口
    target_window = None
    for i, window in enumerate(window_details):
        window_name = window.get("name", "")
        print(f"窗口 {i+1}: {window_name}")
        
        # 排除包含"收藏"、"频道"、"关于"、"配置"、"default"的窗口
        if ("收藏" not in window_name and 
            "频道" not in window_name and 
            "关于" not in window_name and 
            "配置" not in window_name and 
            "default" not in window_name):
            target_window = window
            target_window["index"] = int(window.get("index", i+1))
            print(f"目标窗口: 索引 {target_window['index']}, 名称: {window_name}")
            break
    
    # 5. 如果没有找到合适的窗口，报告失败
    if target_window is None:
        print("未找到符合条件的窗口")
        return False
    
    # 6. 检查窗口是否全屏
    is_fullscreen = check_window_fullscreen(target_window)
    print(f"窗口是否全屏: {'是' if is_fullscreen else '否'}")
    
    # 7. 如果不是全屏，使用pyautogui双击
    if not is_fullscreen:
        success = double_click_with_pyautogui(target_window)
        if success:
            print(f"使用pyautogui在窗口 {target_window['index']} 执行双击操作成功")
        else:
            print(f"使用pyautogui在窗口 {target_window['index']} 执行双击操作失败")
    else:
        # 如果是全屏，使用原来的方法
        success = double_click_window_center(target_window['index'])
        if success:
            print(f"使用AppleScript在窗口 {target_window['index']} 执行双击操作成功")
        else:
            print(f"使用AppleScript在窗口 {target_window['index']} 执行双击操作失败")
    
    return success

def activate_aptv():
    """激活APTV应用"""
    apple_script = '''
    try
        tell application "APTV"
            activate
        end tell
        return true
    on error errMsg
        log errMsg
        return false
    end try
    '''
    
    try:
        result = subprocess.run(['osascript', '-e', apple_script], 
                              check=True, 
                              capture_output=True, 
                              text=True)
        success = result.stdout.strip() == "true"
        print(f"激活APTV应用{'成功' if success else '失败'}")
        return success
    except Exception as e:
        print(f"激活APTV应用失败: {e}")
        return False

def get_aptv_window_details():
    """获取APTV应用的所有窗口详细信息"""
    # 使用更详细的AppleScript获取窗口信息，并改进输出格式
    apple_script = '''
    try
        set windowDetailsList to {}
        
        tell application "System Events"
            tell process "APTV"
                set windowCount to count of windows
                
                repeat with i from 1 to windowCount
                    set targetWindow to window i
                    
                    -- 基本信息
                    set windowName to name of targetWindow
                    set windowPos to position of targetWindow
                    set windowSize to size of targetWindow
                    
                    -- 构建窗口详情字符串，使用分号分隔不同属性，使用管道符分隔不同窗口
                    set windowDetail to "index:" & i & ";name:" & windowName & ";position:" & (item 1 of windowPos) & "," & (item 2 of windowPos) & ";size:" & (item 1 of windowSize) & "," & (item 2 of windowSize) & "|"
                    
                    -- 添加到结果列表
                    copy windowDetail to end of windowDetailsList
                end repeat
                
                -- 返回窗口详情
                return windowDetailsList as text
            end tell
        end tell
    on error errMsg
        log errMsg
        return "错误:" & errMsg
    end try
    '''
    
    try:
        result = subprocess.run(['osascript', '-e', apple_script], 
                              check=True, 
                              capture_output=True, 
                              text=True)
        output = result.stdout.strip()
        
        # 处理输出，将其转换为Python数据结构
        window_details = parse_applescript_output(output)
        return window_details
    except Exception as e:
        print(f"获取窗口详细信息失败: {e}")
        return None

def parse_applescript_output(output):
    """将AppleScript输出解析为Python数据结构"""
    try:
        # 打印原始输出，帮助调试
        print("原始AppleScript输出:")
        print(output)
        print("\n" + "-" * 50 + "\n")
        
        # 处理输出格式
        window_details = []
        
        # 首先按管道符分割不同窗口
        windows = output.split("|")
        
        for window_info in windows:
            if not window_info.strip():
                continue
                
            # 创建新的窗口记录
            window = {}
            
            # 分割各个属性
            attrs = window_info.split(";")
            for attr in attrs:
                if ":" not in attr:
                    continue
                    
                key, value = attr.split(":", 1)
                key = key.strip()
                value = value.strip()
                
                if key == "position" or key == "size":
                    # 处理位置和大小信息
                    if "," in value:
                        x, y = value.split(",", 1)
                        window[key] = f"{x.strip()}, {y.strip()}"
                else:
                    window[key] = value
            
            if window:
                window_details.append(window)
        
        # 打印解析结果
        print("解析后的窗口信息:")
        for window in window_details:
            print(window)
        
        return window_details
    except Exception as e:
        print(f"解析窗口信息失败: {e}")
        print(f"原始输出: {output}")
        return [{"error": str(e), "raw_output": output}]

def double_click_window_center(window_index):
    """在窗口中央位置双击鼠标"""
    apple_script = f'''
    try
        tell application "System Events"
            tell process "APTV"
                if (count of windows) >= {window_index} then
                    # 确保窗口在前台
                    set frontmost to true
                    set targetWindow to window {window_index}
                    
                    # 获取窗口位置和大小
                    set windowPosition to position of targetWindow
                    set windowSize to size of targetWindow
                    
                    # 计算窗口中心位置
                    set clickX to (item 1 of windowPosition) + (item 1 of windowSize) / 2
                    set clickY to (item 2 of windowPosition) + (item 2 of windowSize) / 2
                    
                    # 先单击以确保窗口获得焦点
                    click at {{clickX, clickY}}
                    
                    # 等待短暂时间，确保窗口已获得焦点
                    delay 0.2
                    
                    # 双击窗口中心位置
                    click at {{clickX, clickY}}
                    delay 0.1
                    click at {{clickX, clickY}}
                    
                    # 再次尝试，确保双击成功
                    delay 0.3
                    click at {{clickX, clickY}}
                    delay 0.1
                    click at {{clickX, clickY}}
                    
                    return true
                else
                    return false
                end if
            end tell
        end tell
    on error errMsg
        log errMsg
        return false
    end try
    '''
    
    try:
        result = subprocess.run(['osascript', '-e', apple_script], 
                              check=True, 
                              capture_output=True, 
                              text=True)
        success = result.stdout.strip() == "true"
        print(f"在窗口 {window_index} 中央双击{'成功' if success else '失败'}")
        return success
    except Exception as e:
        print(f"双击窗口失败: {e}")
        return False

def check_window_fullscreen(window):
    """检查窗口是否全屏"""
    try:
        # 获取屏幕分辨率
        screen_width, screen_height = pyautogui.size()
        
        # 获取窗口尺寸
        size_str = window.get("size", "")
        print(f"窗口大小信息: {size_str}")
        
        # 分离宽度和高度
        parts = [part.strip() for part in size_str.split(",")]
        if len(parts) >= 2:
            window_width = int(parts[0])
            window_height = int(parts[1])
            
            print(f"窗口尺寸: {window_width}x{window_height}")
            print(f"屏幕尺寸: {screen_width}x{screen_height}")
            
            # 如果窗口尺寸接近或等于屏幕尺寸，认为是全屏
            return (abs(screen_width - window_width) < 10 and 
                    abs(screen_height - window_height) < 10)
        else:
            print(f"无法解析窗口大小: {size_str}")
            return False
    except Exception as e:
        print(f"检查全屏状态失败: {e}")
        return False

def double_click_with_pyautogui(window):
    """使用pyautogui在窗口中央位置双击鼠标"""
    try:
        # 获取窗口位置和大小
        position_str = window.get("position", "")
        size_str = window.get("size", "")
        
        print(f"窗口位置信息: {position_str}")
        print(f"窗口大小信息: {size_str}")
        
        # 分离位置坐标
        position_parts = [part.strip() for part in position_str.split(",")]
        if len(position_parts) >= 2:
            window_x = int(position_parts[0])
            window_y = int(position_parts[1])
        else:
            raise ValueError(f"无法解析窗口位置: {position_str}")
        
        # 分离尺寸数据
        size_parts = [part.strip() for part in size_str.split(",")]
        if len(size_parts) >= 2:
            window_width = int(size_parts[0])
            window_height = int(size_parts[1])
        else:
            raise ValueError(f"无法解析窗口大小: {size_str}")
        
        print(f"窗口位置: ({window_x}, {window_y})")
        print(f"窗口大小: {window_width}x{window_height}")
        
        # 计算窗口中心位置
        center_x = window_x + window_width // 2
        center_y = window_y + window_height // 2
        
        print(f"目标点击位置: ({center_x}, {center_y})")
        
        # 移动鼠标到中心位置
        pyautogui.moveTo(center_x, center_y, duration=0.2)
        time.sleep(0.1)
        
        # 执行双击
        pyautogui.click(center_x, center_y, clicks=2, interval=0.1)
        time.sleep(0.2)
        
        # 再次双击以确保操作成功
        pyautogui.click(center_x, center_y, clicks=2, interval=0.1)
        
        return True
    except Exception as e:
        print(f"pyautogui双击失败: {e}")
        return False

def main():
    """主函数"""
    print("正在查找APTV窗口并尝试双击非收藏窗口...")
    find_and_click_non_favorites_window()

if __name__ == "__main__":
    main() 