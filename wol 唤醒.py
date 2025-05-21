import socket
import struct


def send_wol_packet(mac_address, broadcast_ip='255.255.255.255', port=9):
    """
    发送Wake-on-LAN魔术包唤醒指定MAC地址的设备

    参数:
        mac_address: 目标设备的MAC地址，格式如"00:11:22:33:44:55"
        broadcast_ip: 广播IP地址，默认为255.255.255.255
        port: WOL使用的端口，通常为7或9，默认为9
    """
    # 移除MAC地址中的分隔符并转换为字节
    mac_bytes = bytes.fromhex(mac_address.replace(':', ''))

    # 创建魔术包 (6个0xFF字节，然后是目标MAC地址重复16次)
    magic_packet = b'\xff' * 6 + mac_bytes * 16

    # 发送魔术包
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.sendto(magic_packet, (broadcast_ip, port))

    print(f"已发送WOL魔术包到 {mac_address}")


if __name__ == "__main__":
    # 替换为目标设备的MAC地址
    target_mac = "34:29:8f:70:d5:6d"  # 示例MAC地址，请替换为实际地址
    send_wol_packet(target_mac)
