document.addEventListener('DOMContentLoaded', function () {
  // Tab切换相关元素
  const tabItems = document.querySelectorAll('.tab-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const movieIframe = document.getElementById('movie-iframe');

  // Tab切换函数
  function switchTab(targetTab) {
    // 移除所有active类
    tabItems.forEach(item => item.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    // 添加active类到目标tab
    const targetTabItem = document.querySelector(`[data-tab="${targetTab}"]`);
    const targetTabContent = document.getElementById(`${targetTab}-content`);

    if (targetTabItem && targetTabContent) {
      targetTabItem.classList.add('active');
      targetTabContent.classList.add('active');

      // 如果切换到电影tab，确保iframe已加载
      if (targetTab === 'movie' && movieIframe) {
        // 如果iframe还没有加载过，设置src
        if (!movieIframe.src || movieIframe.src === 'about:blank') {
          movieIframe.src = 'https://movie.tnanko.top/';
        }
      }
    }
  }

  // 添加tab点击事件监听器
  tabItems.forEach(item => {
    item.addEventListener('click', function () {
      const targetTab = this.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // 初始化 - 默认显示遥控器tab
  switchTab('remote');

  // 获取DOM元素
  const volumeLevel = document.getElementById('volume-level');
  const volumeValue = document.getElementById('volume-value');
  const volumeTrack = document.getElementById('volume-track');
  const volumeHandle = document.getElementById('volume-handle');
  const statusText = document.getElementById('status-text');
  const connectBtn = document.getElementById('connect-btn');
  const connectionDot = document.getElementById('connection-indicator');
  const connectionStatus = document.getElementById('connection-status');
  const volumeContainer = document.getElementById('current-volume');
  const muteBtn = document.getElementById('mute-btn');

  // WebSocket连接检测变量
  let wsCheckInterval = null;
  let wsReconnectAttempts = 0;
  let wsMaxReconnectAttempts = 10;
  let isPageVisible = true; // 添加页面可见性跟踪变量

  // 控制按钮
  const playPauseBtn = document.getElementById('play-pause-btn');
  const arrowUpBtn = document.getElementById('arrow-up-btn');
  const arrowDownBtn = document.getElementById('arrow-down-btn');
  const arrowLeftBtn = document.getElementById('arrow-left-btn');
  const arrowRightBtn = document.getElementById('arrow-right-btn');
  const fKeyBtn = document.getElementById('f-key-btn');
  const spaceBtn = document.getElementById('space-btn');
  const desktopLeftBtn = document.getElementById('desktop-left-btn');
  const desktopRightBtn = document.getElementById('desktop-right-btn');
  const volumeDownBtn = document.getElementById('volume-down-btn');
  const volumeUpBtn = document.getElementById('volume-up-btn');

  // 屏幕唤醒相关
  const wakeScreenBtn = document.getElementById('wake-screen-btn');
  const wakeCountdownContainer = document.getElementById('wake-countdown-container');
  const wakeCountdown = document.getElementById('wake-countdown');
  const wakeProgressBar = document.getElementById('wake-progress-bar');

  // 保存当前音量
  let currentVolume = 0;
  let lastNonZeroVolume = 50; // 存储上一次非零音量值

  // 初始化状态
  let isPlaying = false;
  let isDragging = false;
  let socket = null;
  let isConnected = false;
  let isMuted = false; // 添加静音状态标志

  // 屏幕唤醒状态
  let isScreenAwake = false;
  let wakeEndTime = null;
  let wakeCountdownTimer = null;
  let wakeTotalSeconds = 0;
  let wakeRemainingSeconds = 0;

  // 更新连接状态指示器
  function updateConnectionIndicator(status) {
    // 移除所有状态类
    connectionDot.classList.remove('connected', 'disconnected');

    switch (status) {
      case 'connected':
        connectionDot.classList.add('connected');
        connectionStatus.textContent = '已连接';
        break;
      case 'connecting':
        connectionDot.classList.add('disconnected');
        connectionStatus.textContent = '连接中...';
        break;
      case 'disconnected':
        connectionDot.classList.add('disconnected');
        connectionStatus.textContent = '未连接';
        break;
      default:
        connectionStatus.textContent = '未知';
    }
  }

  // 启用/禁用按钮
  function enableButtons(enable) {
    playPauseBtn.disabled = !enable;
    arrowUpBtn.disabled = !enable;
    arrowDownBtn.disabled = !enable;
    arrowLeftBtn.disabled = !enable;
    arrowRightBtn.disabled = !enable;
    fKeyBtn.disabled = !enable;
    spaceBtn.disabled = !enable;
    volumeDownBtn.disabled = !enable;
    volumeUpBtn.disabled = !enable;
    desktopLeftBtn.disabled = !enable;
    desktopRightBtn.disabled = !enable;
    muteBtn.disabled = !enable;

    // 唤醒按钮不再根据唤醒状态禁用，只根据连接状态
    wakeScreenBtn.disabled = !enable;
  }

  // 更新播放/暂停按钮状态
  function updatePlayPauseButton() {
    if (isPlaying) {
      playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      playPauseBtn.setAttribute('aria-label', '暂停');
    } else {
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      playPauseBtn.setAttribute('aria-label', '播放');
    }
  }

  // 连接到服务器
  function connectToServer() {
    try {
      if (socket) {
        socket.disconnect();
      }

      updateConnectionIndicator('connecting');

      // 创建连接 - 自动检测HTTP/HTTPS
      const protocol = window.isHttps ? 'https://' : 'http://';
      const wsProtocol = window.isHttps ? 'wss://' : 'ws://';
      const host = window.location.hostname;
      const port = window.location.port;
      const wsUrl = port ? `${wsProtocol}${host}:${port}` : `${wsProtocol}${host}`;
      
      console.log(`连接到WebSocket服务器: ${wsUrl}`);
      //如果等于wss://tvcontrol.tnanko.top则替换为wss://tv.tnanko.top
      if (wsUrl == 'wss://tvcontrol.tnanko.top') {
        wsUrl = 'wss://tv.tnanko.top';
      }
      console.log(`debug：二次连接到WebSocket服务器: ${wsUrl}`);
      socket = io.connect(wsUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        // 添加心跳设置，防止移动设备切换应用时连接断开
        pingInterval: 25000,  // 减少ping间隔（默认25000）
        pingTimeout: 60000,   // 增加ping超时（默认5000）
        timeout: 60000        // 增加连接超时
      });

      // 连接事件
      socket.on('connect', function () {
        isConnected = true;
        statusText.textContent = 'WebSocket已连接';
        updateConnectionIndicator('connected');
        connectBtn.textContent = '断开';

        // 启用按钮
        enableButtons(true);

        // 请求初始状态
        socket.emit('get_status');

        // 显示音量控制
        volumeContainer.classList.remove('hidden');

        // 不再需要获取唤醒状态
        // socket.emit('get_wake_status');
      });

      // 断开连接事件
      socket.on('disconnect', function () {
        isConnected = false;
        statusText.textContent = 'WebSocket已断开';
        updateConnectionIndicator('disconnected');
        connectBtn.textContent = '连接';

        // 禁用按钮
        enableButtons(false);

        // 隐藏音量控制
        volumeContainer.classList.add('hidden');
      });

      // 连接错误
      socket.on('connect_error', function (error) {
        statusText.textContent = `WebSocket连接错误: ${error.message}`;
        updateConnectionIndicator('disconnected');
        console.error('WebSocket连接错误:', error);
      });

      // 错误处理
      socket.on('error', function (data) {
        statusText.textContent = `错误: ${data.error || '未知错误'}`;
      });

      // 状态更新
      socket.on('status_update', function (data) {
        updateVolumeDisplay(data.current_volume);
        statusText.textContent = `${data.status}`;

        // 更新播放状态
        if (data.is_playing !== undefined) {
          isPlaying = data.is_playing;
          updatePlayPauseButton();
        }

        // 如果初始音量为0，确保lastNonZeroVolume不为0
        if (data.current_volume === 0 && lastNonZeroVolume === 0) {
          lastNonZeroVolume = 50; // 默认值
        }
      });

      // 音量更新
      socket.on('volume_update', function (data) {
        updateVolumeDisplay(data.current_volume);
        statusText.textContent = `音量已设置为 ${data.current_volume}%`;
      });

      // 广播音量变化
      socket.on('volume_broadcast', function (data) {
        if (!isDragging) { // 如果没在拖动，则更新
          updateVolumeDisplay(data.current_volume);
        }
      });

      // 视频播放状态更新
      socket.on('playback_state_update', function (data) {
        isPlaying = data.is_playing;
        updatePlayPauseButton();
        statusText.textContent = isPlaying ? '正在播放' : '已暂停';
      });

      // 按键响应
      socket.on('key_press_response', function (data) {
        if (data.success) {
          statusText.textContent = `按键 ${data.direction} 执行成功`;
        } else {
          statusText.textContent = `按键 ${data.direction} 执行失败`;
        }
      });

      // 视频控制响应
      socket.on('video_control_response', function (data) {
        if (data.success) {
          statusText.textContent = `视频${data.action === 'play' ? '播放' : '暂停'}成功`;
        } else {
          statusText.textContent = `视频控制失败`;
        }
      });

      // 桌面切换响应
      socket.on('switch_desktop_response', function (data) {
        if (data.success) {
          statusText.textContent = `已切换到${data.direction === 'left' ? '电影' : '电视'}桌面`;
        } else {
          statusText.textContent = `桌面切换失败`;
        }
      });

      // 屏幕唤醒状态更新
      socket.on('wake_status_update', function (data) {
        updateWakeScreenStatus(data);
      });

      // 屏幕唤醒响应
      socket.on('wake_screen_response', function (data) {
        if (data.success) {
          // 如果是自动触发的，显示不同的消息
          if (data.auto_triggered) {
            statusText.textContent = "已自动唤醒屏幕";
          } else {
            statusText.textContent = data.message;
          }
          updateWakeScreenStatus(data.wake_status);
        } else {
          statusText.textContent = `屏幕唤醒失败: ${data.error || '未知错误'}`;
        }
      });

    } catch (e) {
      console.error('连接服务器失败:', e);
      statusText.textContent = '连接失败: ' + e.message;
      updateConnectionIndicator('disconnected');
    }
  }

  // 检查WebSocket连接状态
  function checkWebSocketConnection() {
    if (!socket || !socket.connected) {
      console.log('WebSocket连接断开，尝试重新连接...');
      // 如果未达到最大重连次数，尝试重连
      if (wsReconnectAttempts < wsMaxReconnectAttempts) {
        wsReconnectAttempts++;
        statusText.textContent = `连接断开，正在尝试重连 (${wsReconnectAttempts}/${wsMaxReconnectAttempts})`;
        connectToServer();
      } else {
        statusText.textContent = `重连失败，已达到最大尝试次数 (${wsMaxReconnectAttempts})`;
        // 停止定时检测
        clearInterval(wsCheckInterval);
      }
    } else {
      // 连接正常，重置重连计数
      wsReconnectAttempts = 0;
    }
  }

  // 断开连接
  function disconnectFromServer() {
    if (socket) {
      socket.disconnect();
    }

    // 清除连接检测定时器
    if (wsCheckInterval) {
      clearInterval(wsCheckInterval);
      wsCheckInterval = null;
    }
  }

  // 音量控制拖动事件
  volumeTrack.addEventListener('mousedown', startVolumeChange);
  volumeTrack.addEventListener('touchstart', startVolumeChange, { passive: false });

  window.addEventListener('mousemove', moveVolumeChange);
  window.addEventListener('touchmove', moveVolumeChange, { passive: false });

  window.addEventListener('mouseup', endVolumeChange);
  window.addEventListener('touchend', endVolumeChange);

  // 开始拖动
  function startVolumeChange(e) {
    e.preventDefault();
    isDragging = true;
    document.body.style.cursor = 'grabbing';

    // 立即更新位置
    updateVolumeFromEvent(e);
  }

  // 拖动过程中
  function moveVolumeChange(e) {
    if (isDragging) {
      e.preventDefault();
      updateVolumeFromEvent(e);
    }
  }

  // 结束拖动
  function endVolumeChange() {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';

      // 发送命令到服务器
      if (socket && socket.connected) {
        socket.emit('set_volume', { volume: currentVolume });
      } else {
        statusText.textContent = 'WebSocket未连接，无法设置音量';
      }
    }
  }

  // 根据鼠标/触摸位置更新音量
  function updateVolumeFromEvent(e) {
    let clientX;

    // 判断是鼠标事件还是触摸事件
    if (e.type.startsWith('touch')) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }

    // 获取音量条的位置和尺寸
    const rect = volumeTrack.getBoundingClientRect();

    // 计算百分比位置 (0-100之间)
    let volumePercent = ((clientX - rect.left) / rect.width) * 100;
    volumePercent = Math.max(0, Math.min(100, volumePercent));

    // 四舍五入到最接近的5的倍数
    volumePercent = Math.round(volumePercent / 5) * 5;

    // 更新显示
    updateVolumeDisplay(volumePercent);

    // 保存当前值
    currentVolume = volumePercent;
  }

  // 更新音量显示
  function updateVolumeDisplay(volume) {
    // 如果音量不为零，保存为上次非零音量
    if (volume > 0) {
      lastNonZeroVolume = volume;
    }

    // 更新进度条
    volumeLevel.style.width = `${volume}%`;
    // 更新滑块位置
    volumeHandle.style.left = `${volume}%`;
    // 更新数字显示
    volumeValue.textContent = `${volume}`;
    // 保存当前音量
    currentVolume = volume;

    // 更新静音状态
    isMuted = volume === 0;

    // 更新静音按钮图标
    if (isMuted) {
      muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    } else {
      muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
    }
  }

  // 按钮事件监听

  // 连接/断开按钮
  connectBtn.addEventListener('click', function () {
    if (isConnected) {
      disconnectFromServer();
      connectBtn.textContent = '连接';
    } else {
      connectToServer();
      connectBtn.textContent = '断开';

      // 启动WebSocket连接状态检测
      if (!wsCheckInterval) {
        wsCheckInterval = setInterval(checkWebSocketConnection, 10000);
      }
    }
  });

  // 播放/暂停按钮
  playPauseBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      if (isPlaying) {
        // 当前是播放状态，发送暂停命令
        socket.emit('video_control', { action: 'pause' });
        statusText.textContent = '发送暂停命令';
        isPlaying = false;
      } else {
        // 当前是暂停状态，发送播放命令
        socket.emit('video_control', { action: 'play' });
        statusText.textContent = '发送播放命令';
        isPlaying = true;
      }
      // 更新按钮状态
      updatePlayPauseButton();
    } else {
      statusText.textContent = 'WebSocket未连接，无法控制播放';
    }
  });

  // 方向键上
  arrowUpBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('key_press', { direction: 'up' });
      statusText.textContent = '发送方向上键命令';
    } else {
      statusText.textContent = 'WebSocket未连接，无法发送命令';
    }
  });

  // 方向键下
  arrowDownBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('key_press', { direction: 'down' });
      statusText.textContent = '发送方向下键命令';
    } else {
      statusText.textContent = 'WebSocket未连接，无法发送命令';
    }
  });

  // 方向键左
  arrowLeftBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('key_press', { direction: 'left' });
      statusText.textContent = '发送方向左键命令';
    } else {
      statusText.textContent = 'WebSocket未连接，无法发送命令';
    }
  });

  // 方向键右
  arrowRightBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('key_press', { direction: 'right' });
      statusText.textContent = '发送方向右键命令';
    } else {
      statusText.textContent = 'WebSocket未连接，无法发送命令';
    }
  });

  // 确认键 (F)
  fKeyBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('key_press', { direction: 'f' });
      statusText.textContent = '发送全屏命令';
    } else {
      statusText.textContent = 'WebSocket未连接，无法发送命令';
    }
  });

  // 空格键
  spaceBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('play_pause');
      statusText.textContent = '发送空格键命令';
    } else {
      statusText.textContent = 'WebSocket未连接，无法发送命令';
    }
  });

  // 音量减
  volumeDownBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('volume_control', { direction: 'down' });
      statusText.textContent = '减小音量';

      // 如果音量可能会降到0，确保已记录最后的非零音量
      if (currentVolume <= 5 && currentVolume > 0) {
        lastNonZeroVolume = currentVolume;
      }
    } else {
      statusText.textContent = 'WebSocket未连接，无法控制音量';
    }
  });

  // 音量加
  volumeUpBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('volume_control', { direction: 'up' });
      statusText.textContent = '增大音量';
    } else {
      statusText.textContent = 'WebSocket未连接，无法控制音量';
    }
  });

  // 静音按钮
  muteBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      if (isMuted) {
        // 如果当前是静音状态，恢复到上次的非零音量
        socket.emit('set_volume', { volume: lastNonZeroVolume });
        statusText.textContent = '恢复音量';
      } else {
        // 如果当前不是静音状态，设置为静音
        socket.emit('set_volume', { volume: 0 });
        statusText.textContent = '已静音';
      }
    } else {
      statusText.textContent = 'WebSocket未连接，无法设置静音';
    }
  });

  // 桌面切换 - 电影
  desktopLeftBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('switch_desktop', { direction: 'left' });
      statusText.textContent = '切换到电影桌面';
    } else {
      statusText.textContent = 'WebSocket未连接，无法切换桌面';
    }
  });

  // 桌面切换 - 电视
  desktopRightBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('switch_desktop', { direction: 'right' });
      statusText.textContent = '切换到电视桌面';
    } else {
      statusText.textContent = 'WebSocket未连接，无法切换桌面';
    }
  });

  // 自动连接（针对移动设备）
  window.addEventListener('load', function () {
    // 如果在移动设备上，自动连接
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      setTimeout(connectToServer, 100);
    }

    // 启动WebSocket连接状态检测
    wsCheckInterval = setInterval(checkWebSocketConnection, 10000); // 每10秒检测一次
  });

  // 初始更新连接状态指示器
  updateConnectionIndicator('disconnected');
  enableButtons(false);

  // 更新屏幕唤醒状态 - 简化此函数，不再处理唤醒状态
  function updateWakeScreenStatus(status) {
    // 不再需要此函数的大部分功能
    console.log("收到唤醒状态更新，但不再使用");
  }

  // 更新倒计时显示 - 不再需要
  function updateWakeCountdown() {
    // 此函数不再需要
    console.log("倒计时函数不再使用");
  }

  // 屏幕唤醒按钮 - 修改为发送空格键
  wakeScreenBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      // 发送空格键到ESP32
      socket.emit('send_esp32_key', { key_code: "SPACE" });
      statusText.textContent = '已发送空格键到ESP32';
    } else {
      statusText.textContent = 'WebSocket未连接，无法发送空格键';
    }
  });

  // 添加页面可见性变化事件处理
  document.addEventListener('visibilitychange', function () {
    isPageVisible = document.visibilityState === 'visible';
    console.log(`页面可见性变化: ${isPageVisible ? '可见' : '不可见'}`);

    if (isPageVisible) {
      // 页面变为可见时，检查连接状态
      if (socket && !socket.connected) {
        console.log('页面恢复可见，检测到WebSocket断开，尝试重连...');
        connectToServer();
      }
    } else {
      // 页面变为不可见时，发送保持连接的消息
      if (socket && socket.connected) {
        console.log('页面进入后台，发送保持连接消息...');
        // 可以添加一个空的事件来保持连接活跃
        socket.emit('keep_alive');
      }
    }
  });

  // 在iOS设备上，添加额外的事件监听器
  window.addEventListener('pagehide', function () {
    isPageVisible = false;
    console.log('页面隐藏 (iOS特定事件)');
    if (socket && socket.connected) {
      socket.emit('keep_alive');
    }
  });

  window.addEventListener('pageshow', function () {
    isPageVisible = true;
    console.log('页面显示 (iOS特定事件)');
    if (socket && !socket.connected) {
      connectToServer();
    }
  });

  // 关机按钮的事件监听器
  const sleepButton = document.getElementById('sleepButton');
  sleepButton.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('system_sleep', {});
      statusText.textContent = '正在关闭所有媒体并进入睡眠...';

      // 监听睡眠响应事件
      socket.once('system_sleep_response', function (data) {
        if (data.success) {
          statusText.textContent = data.message;
        } else {
          statusText.textContent = '睡眠操作失败: ' + data.message;
        }
      });
    } else {
      statusText.textContent = 'WebSocket未连接，无法执行关机操作';
    }
  });
}); 