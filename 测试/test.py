import pyaudio

def list_audio_devices():
    p = pyaudio.PyAudio()
    
    print("音频设备信息:")
    print("-" * 50)
    
    # 获取设备数量
    device_count = p.get_device_count()
    print(f"找到 {device_count} 个音频设备\n")
    
    # 遍历所有设备
    for i in range(device_count):
        device_info = p.get_device_info_by_index(i)
        print(f"设备 #{i}")
        print(f"    设备名称: {device_info['name']}")
        print(f"    输入通道数: {device_info['maxInputChannels']}")
        print(f"    输出通道数: {device_info['maxOutputChannels']}")
        print(f"    默认采样率: {device_info['defaultSampleRate']} Hz")
        print(f"    是否为默认输入设备: {'是' if i == p.get_default_input_device_info()['index'] else '否'}")
        print(f"    是否为默认输出设备: {'是' if i == p.get_default_output_device_info()['index'] else '否'}")
        print("-" * 50)
    
    # 释放 PyAudio 实例
    p.terminate()

if __name__ == "__main__":
    list_audio_devices()
