#!/usr/bin/env python3
"""测试获取本机局域网IP"""

import socket
import subprocess
import re

def get_local_ip():
    """
    获取本机局域网IP地址
    优先返回192.168.x.x网段的IP（家庭/办公室局域网）
    """
    try:
        # 方法1：使用ipconfig命令获取主网卡IP（macOS最可靠的方法）
        # en0 通常是WiFi或以太网主接口
        try:
            result = subprocess.run(
                ['ipconfig', 'getifaddr', 'en0'],
                capture_output=True,
                text=True,
                timeout=2
            )
            if result.returncode == 0 and result.stdout.strip():
                ip = result.stdout.strip()
                # 验证是否是局域网IP
                if ip.startswith('192.168.') or ip.startswith('10.') or ip.startswith('172.'):
                    print(f"✓ 获取到本机IP（en0）: {ip}")
                    return ip
        except Exception as e:
            print(f"✗ 获取en0 IP失败: {e}")

        # 尝试en1接口
        try:
            result = subprocess.run(
                ['ipconfig', 'getifaddr', 'en1'],
                capture_output=True,
                text=True,
                timeout=2
            )
            if result.returncode == 0 and result.stdout.strip():
                ip = result.stdout.strip()
                if ip.startswith('192.168.') or ip.startswith('10.') or ip.startswith('172.'):
                    print(f"✓ 获取到本机IP（en1）: {ip}")
                    return ip
        except Exception as e:
            print(f"✗ 获取en1 IP失败: {e}")

        # 方法2：解析ifconfig输出，优先选择192.168开头的IP
        try:
            result = subprocess.run(
                ['ifconfig'],
                capture_output=True,
                text=True,
                timeout=3
            )
            if result.returncode == 0:
                # 查找所有 inet xxx.xxx.xxx.xxx
                inet_pattern = re.compile(r'inet\s+(\d+\.\d+\.\d+\.\d+)')
                all_ips = inet_pattern.findall(result.stdout)

                print(f"  发现的所有IP地址: {all_ips}")

                # 优先返回192.168开头的
                for ip in all_ips:
                    if ip.startswith('192.168.') and ip != '127.0.0.1':
                        print(f"✓ 获取到本机IP（ifconfig-192.168）: {ip}")
                        return ip

                # 其次返回10开头的
                for ip in all_ips:
                    if ip.startswith('10.') and ip != '127.0.0.1':
                        print(f"✓ 获取到本机IP（ifconfig-10.x）: {ip}")
                        return ip

                # 最后返回172.16-31开头的
                for ip in all_ips:
                    if ip.startswith('172.') and ip != '127.0.0.1':
                        octets = ip.split('.')
                        if len(octets) == 4 and 16 <= int(octets[1]) <= 31:
                            print(f"✓ 获取到本机IP（ifconfig-172.x）: {ip}")
                            return ip
        except Exception as e:
            print(f"✗ 解析ifconfig输出失败: {e}")

        # 方法3：通过socket连接外部地址（备用）
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
            s.close()
            # 只接受局域网IP
            if ip.startswith('192.168.') or ip.startswith('10.') or ip.startswith('172.'):
                print(f"✓ 获取到本机IP（socket）: {ip}")
                return ip
            else:
                print(f"⚠ socket方法获取到非局域网IP，跳过: {ip}")
        except Exception:
            s.close()

    except Exception as e:
        print(f"✗ 获取本机IP失败: {e}")

    # 如果所有方法都失败，返回localhost
    print("✗ 所有方法都失败，返回localhost")
    return 'localhost'

if __name__ == '__main__':
    print("=" * 60)
    print("测试获取本机局域网IP")
    print("=" * 60)

    ip = get_local_ip()

    print("\n" + "=" * 60)
    print(f"最终获取到的IP: {ip}")
    print(f"遥控器访问地址: http://{ip}:5003")
    print("=" * 60)

    # 验证是否是期望的IP
    expected_ip = "192.168.1.16"
    if ip == expected_ip:
        print(f"\n✓ 成功！IP匹配期望值: {expected_ip}")
    elif ip.startswith('192.168.') or ip.startswith('10.'):
        print(f"\n⚠ IP是局域网地址但不是期望值 {expected_ip}")
        print(f"  实际IP: {ip}")
    else:
        print(f"\n✗ 警告！获取到的IP不是局域网地址: {ip}")

