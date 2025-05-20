document.addEventListener('DOMContentLoaded', function () {
  // 获取DOM元素
  const volumeLevel = document.getElementById('volume-level');
  const volumeValue = document.getElementById('volume-value');
  const volumeTrack = document.getElementById('volume-track');
  const volumeHandle = document.getElementById('volume-handle');
  const statusText = document.getElementById('status-text');
  const statusDiv = document.getElementById('status');
  const connectBtn = document.getElementById('connect-btn');
  const connectionDot = document.getElementById('connection-indicator');
  const connectionStatus = document.getElementById('connection-status');
  const volumeContainer = document.getElementById('current-volume');

  // 控制按钮
  const playBtn = document.getElementById('play-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const spaceBtn = document.getElementById('space-btn');
  const arrowUpBtn = document.getElementById('arrow-up-btn');
  const arrowDownBtn = document.getElementById('arrow-down-btn');
  const arrowLeftBtn = document.getElementById('arrow-left-btn');
  const arrowRightBtn = document.getElementById('arrow-right-btn');
  const fKeyBtn = document.getElementById('f-key-btn');
  const desktopLeftBtn = document.getElementById('desktop-left-btn');
  const desktopRightBtn = document.getElementById('desktop-right-btn');
  const volumeDownBtn = document.getElementById('volume-down-btn');
  const volumeUpBtn = document.getElementById('volume-up-btn');

  // URL发送相关
  const urlInput = document.getElementById('url-input');
  const sendUrlBtn = document.getElementById('send-url-btn');
  const clearUrlBtn = document.getElementById('clear-url-btn');
  const urlHistoryDiv = document.getElementById('url-history');
  const urlHistoryContainer = document.getElementById('url-history-container');

  // 保存当前音量和URL历史
  let currentVolume = 0;
  let urlHistory = JSON.parse(localStorage.getItem('urlHistory') || '[]');

  // 初始化状态
  let isPlaying = false;
  let isDragging = false;
  let socket = null;
  let isConnected = false;

  // 更新连接状态指示器
  function updateConnectionIndicator(status) {
    // 移除所有状态类
    connectionDot.classList.remove('connected', 'disconnected');
    statusDiv.className = 'status';

    switch (status) {
      case 'connected':
        connectionDot.classList.add('connected');
        connectionStatus.textContent = 'WebSocket已连接';
        statusDiv.classList.add('connected');
        statusDiv.textContent = '已连接';
        break;
      case 'connecting':
        connectionDot.classList.add('disconnected');
        connectionStatus.textContent = '正在连接...';
        statusDiv.classList.add('connecting');
        statusDiv.textContent = '正在连接...';
        break;
      case 'disconnected':
        connectionDot.classList.add('disconnected');
        connectionStatus.textContent = 'WebSocket已断开';
        statusDiv.classList.add('disconnected');
        statusDiv.textContent = '已断开连接';
        break;
      default:
        connectionStatus.textContent = '连接状态未知';
        statusDiv.classList.add('disconnected');
    }
  }

  // 启用/禁用按钮
  function enableButtons(enable) {
    sendUrlBtn.disabled = !enable;
    playBtn.disabled = !enable;
    pauseBtn.disabled = !enable;
    spaceBtn.disabled = !enable;
    arrowUpBtn.disabled = !enable;
    arrowDownBtn.disabled = !enable;
    arrowLeftBtn.disabled = !enable;
    arrowRightBtn.disabled = !enable;
    fKeyBtn.disabled = !enable;
    volumeDownBtn.disabled = !enable;
    volumeUpBtn.disabled = !enable;
    desktopLeftBtn.disabled = !enable;
    desktopRightBtn.disabled = !enable;

    // 检查URL输入框的值，如果为空则禁用发送按钮
    if (urlInput.value.trim() === '') {
      sendUrlBtn.disabled = true;
    }
  }

  // 连接到服务器
  function connectToServer() {
    try {
      if (socket) {
        socket.disconnect();
      }

      updateConnectionIndicator('connecting');

      // 创建连接
      socket = io.connect(window.location.origin, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity
      });

      // 连接事件
      socket.on('connect', function () {
        isConnected = true;
        statusText.textContent = 'WebSocket已连接';
        updateConnectionIndicator('connected');
        connectBtn.textContent = '断开连接';

        // 启用按钮
        enableButtons(true);

        // 请求初始状态
        socket.emit('get_status');

        // 显示音量控制
        volumeContainer.classList.remove('hidden');

        // 显示历史记录
        if (urlHistory.length > 0) {
          updateUrlHistory();
          urlHistoryContainer.classList.remove('hidden');
        }
      });

      // 断开连接事件
      socket.on('disconnect', function () {
        isConnected = false;
        statusText.textContent = 'WebSocket已断开';
        updateConnectionIndicator('disconnected');
        connectBtn.textContent = '连接到服务器';

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

      // 按键响应
      socket.on('key_press_response', function (data) {
        if (data.success) {
          statusText.textContent = `按键 ${data.direction} 执行成功`;
        } else {
          statusText.textContent = `按键 ${data.direction} 执行失败`;
        }
      });

      // 播放/暂停响应
      socket.on('play_pause_response', function (data) {
        if (data.success) {
          statusText.textContent = `播放/暂停执行成功`;
          // 切换播放/暂停图标状态
          isPlaying = !isPlaying;
          if (isPlaying) {
            spaceBtn.innerHTML = '<i class="fas fa-pause"></i>';
          } else {
            spaceBtn.innerHTML = '<i class="fas fa-play"></i>';
          }
        } else {
          statusText.textContent = `播放/暂停执行失败`;
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

      // URL发送响应
      socket.on('open_url_response', function (data) {
        if (data.success) {
          statusText.textContent = `URL已成功打开`;
          // 添加到历史记录
          addToUrlHistory(data.url);
        } else {
          statusText.textContent = `URL打开失败`;
        }
      });

    } catch (e) {
      console.error('连接服务器失败:', e);
      statusText.textContent = '连接失败: ' + e.message;
      updateConnectionIndicator('disconnected');
    }
  }

  // 断开连接
  function disconnectFromServer() {
    if (socket) {
      socket.disconnect();
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
    // 更新进度条
    volumeLevel.style.width = `${volume}%`;
    // 更新滑块位置
    volumeHandle.style.left = `${volume}%`;
    // 更新数字显示
    volumeValue.textContent = `${volume}`;
    // 保存当前音量
    currentVolume = volume;
  }

  // 添加URL到历史记录
  function addToUrlHistory(url) {
    // 防止重复添加
    if (urlHistory.includes(url)) {
      // 移除旧的
      urlHistory = urlHistory.filter(item => item !== url);
    }

    // 添加到开头
    urlHistory.unshift(url);

    // 限制最多保存10条记录
    if (urlHistory.length > 10) {
      urlHistory.pop();
    }

    // 保存到本地存储
    localStorage.setItem('urlHistory', JSON.stringify(urlHistory));

    // 更新显示
    updateUrlHistory();

    // 显示历史记录容器
    urlHistoryContainer.classList.remove('hidden');
  }

  // 更新URL历史记录显示
  function updateUrlHistory() {
    urlHistoryDiv.innerHTML = '';

    urlHistory.forEach(url => {
      const item = document.createElement('div');
      item.className = 'history-item';

      // 创建图标
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('width', '16');
      icon.setAttribute('height', '16');
      icon.setAttribute('viewBox', '0 0 24 24');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z');
      icon.appendChild(path);

      // 创建文本
      const text = document.createElement('span');
      text.textContent = url;

      item.appendChild(icon);
      item.appendChild(text);

      // 点击事件
      item.addEventListener('click', function () {
        urlInput.value = url;
        // 激活发送按钮
        sendUrlBtn.disabled = !isConnected;
      });

      urlHistoryDiv.appendChild(item);
    });
  }

  // 按钮事件监听

  // 连接/断开按钮
  connectBtn.addEventListener('click', function () {
    if (isConnected) {
      disconnectFromServer();
    } else {
      connectToServer();
    }
  });

  // 播放按钮
  playBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('video_control', { action: 'play' });
      statusText.textContent = '发送播放命令';
    } else {
      statusText.textContent = 'WebSocket未连接，无法控制播放';
    }
  });

  // 暂停按钮
  pauseBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('video_control', { action: 'pause' });
      statusText.textContent = '发送暂停命令';
    } else {
      statusText.textContent = 'WebSocket未连接，无法暂停视频';
    }
  });

  // 播放/暂停按钮
  spaceBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('play_pause');
      statusText.textContent = '发送播放/暂停命令';
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
      statusText.textContent = '发送确认键命令';
    } else {
      statusText.textContent = 'WebSocket未连接，无法发送命令';
    }
  });

  // 音量减
  volumeDownBtn.addEventListener('click', function () {
    if (socket && socket.connected) {
      socket.emit('volume_control', { direction: 'down' });
      statusText.textContent = '减小音量';
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

  // 发送URL
  sendUrlBtn.addEventListener('click', function () {
    const url = urlInput.value.trim();
    if (!url) {
      statusText.textContent = '请输入有效的URL';
      return;
    }

    // 确保URL包含http或https
    let finalUrl = url;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
      urlInput.value = finalUrl;
    }

    if (socket && socket.connected) {
      socket.emit('open_url', { url: finalUrl });
      statusText.textContent = '发送URL: ' + finalUrl;
    } else {
      statusText.textContent = 'WebSocket未连接，无法发送URL';
    }
  });

  // 清空URL输入框
  clearUrlBtn.addEventListener('click', function () {
    urlInput.value = '';
    urlInput.focus();
    // 禁用发送按钮
    sendUrlBtn.disabled = true;
  });

  // URL输入框变化事件
  urlInput.addEventListener('input', function () {
    // 如果连接状态为已连接且输入框不为空，则启用发送按钮
    sendUrlBtn.disabled = !(isConnected && this.value.trim() !== '');
  });

  // 自动连接（针对移动设备）
  window.addEventListener('load', function () {
    // 如果在移动设备上，自动连接
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      setTimeout(connectToServer, 500);
    }
  });

  // 初始更新连接状态指示器
  updateConnectionIndicator('disconnected');
  enableButtons(false);
}); 