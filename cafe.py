import subprocess
import time

def wake_screen():
    # 使用caffeinate命令防止系统睡眠
    # -u 选项特别用于保持屏幕处于唤醒状态
    # 我们运行它一秒钟，这足以唤醒屏幕
    subprocess.run(["caffeinate", "-u", "-t", "10"], check=True)
    print("屏幕已唤醒")

if __name__ == "__main__":
    wake_screen()