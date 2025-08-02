// ==UserScript==
// @name         电影+广东浏览器远程控制 - 链接接收器
// @namespace    http://tampermonkey.net/
// @version      0.1.4
// @description  通过WebSocket连接到本地服务器，接收并打开视频链接，自动全屏视频，支持远程视频控制，支持央视直播频道切换
// @author       You
// @match        *://*/*
// @match        https://movie.tnanko.top/*
// @match        https://www.gdtv.cn/*
// @match        https://tv.cctv.com/live/cctv*
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      cdn.socket.io
// @connect      192.168.1.115
// @require      https://cdn.socket.io/4.6.0/socket.io.min.js
// ==/UserScript==



(function () {
  'use strict';

  // 连接到本地Flask Socket.IO服务器
  const WS_URL = 'http://localhost:5003';
  let socket;
  let connectionStatus = '未连接';

  // WebSocket重连相关变量
  let wsReconnectAttempts = 0;
  let wsMaxReconnectAttempts = 10;
  let wsReconnectDelay = 1000; // 初始重连延迟1秒
  let wsMaxReconnectDelay = 30000; // 最大重连延迟30秒
  let wsReconnectTimer = null;
  let wsHeartbeatTimer = null;
  let wsHeartbeatInterval = 30000; // 心跳检测间隔30秒

  // 检查是否在目标网站上
  const isTargetWebsite = /movie\.tnanko\.top|www\.gdtv\.cn|tv\.cctv\.com/.test(window.location.href);

  fetch('https://tv.tnanko.top/send-esp32-key?key_code=F')
    .then(response => {
      if (response.ok) {
        console.log('已向ESP32发送F键指令');
      } else {
        console.warn('发送F键指令失败', response.status);
      }
    })
    .catch(err => {
      console.error('发送F键指令时发生错误', err);
    });

  // 创建控制面板
  createControlPanel();

  // WebSocket功能只在目标网站上启用
  if (isTargetWebsite) {
    console.log('在目标网站上启用WebSocket远程控制功能');
    // 连接WebSocket
    connectWebSocket();

    // 添加自动全屏功能
    setupAutoFullscreen();

    // 添加页面可见性变化监听
    document.addEventListener('visibilitychange', handleVisibilityChange);
  } else {
    console.log('不在目标网站上，仅保留基本功能');
    // 移除WebSocket相关UI元素
    const panel = document.getElementById('ws-control-panel');
    if (panel) {
      panel.style.display = 'none';
    }
  }

  // 处理页面可见性变化
  function handleVisibilityChange() {
    if (!document.hidden && socket && !socket.connected) {
      console.log('页面恢复可见，检测到WebSocket断开，尝试重连...');
      reconnectWebSocket();
    }
  }

  // 设置自动全屏功能
  function setupAutoFullscreen() {
    // 监听键盘按键F触发全屏
    document.addEventListener('keydown', function (e) {
      if (e.keyCode === 70 && !e.ctrlKey) { // F键，但不是Ctrl+F
        e.preventDefault();
        toggleFullscreen();
      }
    });

    // 设置自动全屏
    setTimeout(function () {
      // 检查页面是否有视频元素
      const videoElements = document.querySelectorAll('video');
      if (videoElements.length > 0) {
        console.log('找到视频元素，尝试自动全屏');
        requestFullscreen(videoElements[0]);
      } else {
        console.log('未找到视频元素，等待视频加载');
        // 使用MutationObserver监听DOM变化，等待视频元素出现
        waitForVideoElement();
      }
    }, 3000); // 等待3秒，确保页面加载完成
  }

  // 等待视频元素出现
  function waitForVideoElement() {
    const observer = new MutationObserver(function (mutations) {
      const videoElements = document.querySelectorAll('video');
      if (videoElements.length > 0) {
        console.log('视频元素已加载，尝试自动全屏');
        requestFullscreen(videoElements[0]);
        observer.disconnect(); // 停止监听
      }
    });

    // 监听整个文档的变化
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 60秒后停止监听，避免无限等待
    setTimeout(function () {
      observer.disconnect();
      console.log('停止等待视频元素');
    }, 60000);
  }

  // 切换全屏状态
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      const videoElements = document.querySelectorAll('video');
      if (videoElements.length > 0) {
        requestFullscreen(videoElements[0]);
      } else {
        console.log('未找到视频元素');
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }

  // 请求全屏
  function requestFullscreen(element) {
    try {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.webkitRequestFullScreen) {
        element.webkitRequestFullScreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      } else {
        console.log('浏览器不支持全屏API');
      }
    } catch (error) {
      console.error('全屏请求失败:', error);
    }
  }

  // 播放视频
  function playVideo() {
    const videoElements = document.querySelectorAll('video');
    if (videoElements.length > 0) {
      try {
        videoElements[0].play()
          .then(() => console.log('视频播放成功'))
          .catch(error => console.error('视频播放失败:', error));
      } catch (error) {
        console.error('播放视频时出错:', error);
      }
    } else {
      console.log('未找到视频元素');
    }
  }

  // 暂停视频
  function pauseVideo() {
    const videoElements = document.querySelectorAll('video');
    if (videoElements.length > 0) {
      try {
        videoElements[0].pause();
        console.log('视频已暂停');
      } catch (error) {
        console.error('暂停视频时出错:', error);
      }
    } else {
      console.log('未找到视频元素');
    }
  }

  // 处理视频控制命令
  function handleVideoControl(action) {
    console.log('处理视频控制命令:', action);

    switch (action) {
      case 'play':
        playVideo();
        break;
      case 'pause':
        pauseVideo();
        break;
      default:
        console.log('未知的视频控制命令:', action);
    }

    // 显示通知
    GM_notification({
      title: '视频控制',
      text: `执行命令: ${action}`,
      timeout: 3000
    });
  }

  // 连接WebSocket
  function connectWebSocket() {
    try {
      // 重置重连尝试次数
      wsReconnectAttempts = 0;

      // 清除可能存在的定时器
      clearReconnectTimer();
      clearHeartbeatTimer();

      // 初始化Socket.IO连接
      initSocketConnection();

      // 设置心跳检测
      setupHeartbeat();
    } catch (e) {
      console.error('创建WebSocket连接失败:', e);
      connectionStatus = '连接失败';
      updateStatus();

      // 尝试重连
      scheduleReconnect();
    }
  }

  // 重连WebSocket
  function reconnectWebSocket() {
    // 如果已达到最大重连次数，停止重连
    if (wsReconnectAttempts >= wsMaxReconnectAttempts) {
      console.log(`已达到最大重连次数(${wsMaxReconnectAttempts})，停止重连`);
      connectionStatus = `重连失败(${wsReconnectAttempts}/${wsMaxReconnectAttempts})`;
      updateStatus();
      return;
    }

    // 增加重连尝试次数
    wsReconnectAttempts++;

    // 更新状态
    connectionStatus = `正在重连(${wsReconnectAttempts}/${wsMaxReconnectAttempts})`;
    updateStatus();

    console.log(`尝试重连WebSocket(${wsReconnectAttempts}/${wsMaxReconnectAttempts})...`);

    // 清除旧的Socket连接
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    // 初始化新的Socket连接
    initSocketConnection();
  }

  // 安排重连
  function scheduleReconnect() {
    // 清除可能存在的重连定时器
    clearReconnectTimer();

    // 计算指数退避重连延迟（最大不超过wsMaxReconnectDelay）
    const delay = Math.min(wsReconnectDelay * Math.pow(1.5, wsReconnectAttempts), wsMaxReconnectDelay);

    console.log(`将在${delay / 1000}秒后尝试重连...`);

    // 设置重连定时器
    wsReconnectTimer = setTimeout(reconnectWebSocket, delay);
  }

  // 清除重连定时器
  function clearReconnectTimer() {
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
  }

  // 设置心跳检测
  function setupHeartbeat() {
    // 清除可能存在的心跳定时器
    clearHeartbeatTimer();

    // 设置新的心跳定时器
    wsHeartbeatTimer = setInterval(checkConnection, wsHeartbeatInterval);
  }

  // 清除心跳定时器
  function clearHeartbeatTimer() {
    if (wsHeartbeatTimer) {
      clearInterval(wsHeartbeatTimer);
      wsHeartbeatTimer = null;
    }
  }

  // 检查连接状态
  function checkConnection() {
    if (socket && !socket.connected) {
      console.log('心跳检测：WebSocket连接已断开，尝试重连...');
      reconnectWebSocket();
    } else if (socket && socket.connected) {
      console.log('心跳检测：WebSocket连接正常');
      // 发送心跳包
      socket.emit('heartbeat', { timestamp: Date.now() });
    }
  }

  // 初始化Socket.IO连接
  function initSocketConnection() {
    try {
      socket = io(WS_URL, {
        reconnection: true,            // 启用Socket.IO自动重连
        reconnectionAttempts: 0,       // 不限制Socket.IO内部重连次数，由我们自己控制
        reconnectionDelay: 1000,       // 初始重连延迟
        reconnectionDelayMax: 5000,    // 最大重连延迟
        timeout: 10000,
        // 强制使用长轮询而不是WebSocket，绕过Safari的安全限制
        transports: ['polling'],
        secure: false,
        rejectUnauthorized: false
      });

      socket.on('connect', function () {
        console.log('WebSocket连接已建立');
        connectionStatus = '已连接';
        updateStatus();

        // 连接成功，重置重连尝试次数
        wsReconnectAttempts = 0;

        // 清除可能存在的重连定时器
        clearReconnectTimer();

        // 重新设置心跳检测
        setupHeartbeat();

        // 显示连接成功通知
        if (wsReconnectAttempts > 0) {
          GM_notification({
            title: 'WebSocket重连成功',
            text: '与服务器的连接已恢复',
            timeout: 3000
          });
        }
      });

      // 处理来自服务器的命令
      socket.on('open_url_command', function (data) {
        console.log('收到打开URL命令:', data);
        handleOpenUrl(data.url);
      });

      // 处理视频控制命令
      socket.on('video_control_command', function (data) {
        console.log('收到视频控制命令:', data);
        handleVideoControl(data.action);
      });

      // 处理ESP32按键响应
      socket.on('esp32_key_response', function (data) {
        console.log('收到ESP32按键响应:', data);
        // 显示通知
        GM_notification({
          title: 'ESP32按键响应',
          text: `${data.key_code}按键: ${data.success ? '成功' : '失败'} - ${data.message}`,
          timeout: 3000
        });
      });

      // 处理心跳响应
      socket.on('heartbeat_response', function (data) {
        console.log('收到心跳响应:', data);
      });

      socket.on('disconnect', function () {
        console.log('WebSocket连接已断开');
        connectionStatus = '连接已断开';
        updateStatus();

        // 安排重连
        scheduleReconnect();
      });

      socket.on('error', function (error) {
        console.error('Socket.IO错误:', error);
        connectionStatus = '连接错误';
        updateStatus();

        // 如果发生错误且未连接，尝试重连
        if (!socket.connected) {
          scheduleReconnect();
        }
      });

      socket.on('reconnect_attempt', function (attemptNumber) {
        console.log(`Socket.IO内部重连尝试 #${attemptNumber}`);
      });

      socket.on('reconnect_error', function (error) {
        console.error('Socket.IO重连错误:', error);
      });

      socket.on('reconnect_failed', function () {
        console.error('Socket.IO内部重连失败');
        // 交由我们自己的重连机制处理
        scheduleReconnect();
      });

      // 获取状态
      socket.emit('get_status');
    } catch (e) {
      console.error('初始化Socket.IO连接失败:', e);
      connectionStatus = '连接失败';
      updateStatus();

      // 安排重连
      scheduleReconnect();
    }
  }

  // 处理打开URL命令
  function handleOpenUrl(url) {
    try {
      if (isValidUrl(url)) {
        // 显示通知
        GM_notification({
          title: '正在打开链接',
          text: url,
          timeout: 3000
        });

        // 在跳转前保存一个标记，用于识别是通过插件跳转的
        sessionStorage.setItem('urlReceived', 'true');
        sessionStorage.setItem('receivedUrl', url);

        // 添加到历史记录
        addToHistory(url);

        // 直接在当前窗口打开URL，而不是新标签页
        window.location.href = url;
      } else {
        console.error('收到无效URL:', url);
      }
    } catch (e) {
      console.error('处理打开URL命令失败:', e);
    }
  }

  // 通过WebSocket或HTTP发送按键到ESP32
  function sendKeyToESP32(keyCode) {
    try {
      // 检查WebSocket连接状态
      if (socket && socket.connected) {
        console.log(`通过WebSocket发送按键到ESP32: ${keyCode}`);

        // 使用WebSocket发送按键请求
        socket.emit('send_esp32_key', { key_code: keyCode });

        // 显示发送通知
        GM_notification({
          title: 'ESP32按键',
          text: `正在发送${keyCode}按键到ESP32...`,
          timeout: 2000
        });
      }
    } catch (e) {
      console.error("发送ESP32按键请求失败:", e);
    }
  }

  // 发送按键操作到服务端
  function sendKeyPressToServer(key) {
    try {
      if (socket && socket.connected) {
        console.log('发送按键操作到服务端:', key);

        socket.emit('key_press', {
          direction: key
        });

        // 监听服务端响应
        socket.once('key_press_response', function (response) {
          console.log('按键操作响应:', response);
          if (response.success) {
            console.log(`按键 ${key} 操作成功`);
          } else {
            console.error(`按键 ${key} 操作失败`);
          }
        });

        // 监听错误响应
        socket.once('error', function (error) {
          console.error('按键操作错误:', error);
        });

        // 显示通知
        GM_notification({
          title: '按键操作',
          text: `已发送按键 ${key.toUpperCase()} 到服务端`,
          timeout: 2000
        });
      } else {
        console.warn('WebSocket未连接，无法发送按键操作');
        GM_notification({
          title: '按键操作失败',
          text: 'WebSocket未连接',
          timeout: 2000
        });
      }
    } catch (e) {
      console.error('发送按键操作失败:', e);
    }
  }

  // 更新状态显示
  function updateStatus() {
    const statusElement = document.getElementById('ws-connection-status');
    if (statusElement) {
      statusElement.textContent = connectionStatus;
      statusElement.className = getStatusClass(connectionStatus);
    }
  }

  // 根据状态文本获取对应的CSS类
  function getStatusClass(status) {
    switch (status) {
      case '已连接': return 'status-connected';
      case '连接错误':
      case '连接失败': return 'status-error';
      default:
        // 检查是否包含"重连"字样
        if (status.includes('重连') || status.includes('正在重连')) {
          return 'status-reconnecting';
        }
        return 'status-disconnected';
    }
  }

  // 验证URL
  function isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 创建控制面板
  function createControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'ws-control-panel';

    // 如果不在目标网站上，默认隐藏
    if (!isTargetWebsite) {
      panel.style.display = 'none';
    }

    panel.innerHTML = `
              <div class="ws-header">远程链接接收器 <span class="ws-close-btn">&times;</span></div>
              <div class="ws-body">
                  <div class="ws-status-row">
                      <span>连接状态:</span>
                      <span id="ws-connection-status" class="status-disconnected">未连接</span>
                      <button id="btn-reconnect" title="重新连接">🔄</button>
                  </div>
                  <div class="ws-info">
                      <p>服务器地址: ${WS_URL}</p>
                  </div>
                  <div class="ws-controls">
                      <button id="btn-play">播放</button>
                      <button id="btn-pause">暂停</button>
                      <button id="btn-key-f">按键F</button>
                  </div>
                  <div class="url-history">
                      <h4>历史记录</h4>
                      <ul id="history-list"></ul>
                  </div>
              </div>
          `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
              #ws-control-panel {
                  position: fixed;
                  bottom: 20px;
                  right: 20px;
                  width: 280px;
                  background: #ffffff;
                  border: 1px solid #bbbbbb;
                  border-radius: 8px;
                  box-shadow: 0 0 10px rgba(0,0,0,0.3);
                  z-index: 9999;
                  font-family: Arial, sans-serif;
                  transition: all 0.3s ease;
                  font-size: 14px;
                  color: #222222;
              }
              .ws-header {
                  padding: 10px 12px;
                  background: #3a75c4;
                  color: white;
                  font-weight: bold;
                  border-radius: 8px 8px 0 0;
                  display: flex;
                  justify-content: space-between;
                  font-size: 15px;
              }
              .ws-close-btn {
                  cursor: pointer;
                  font-size: 18px;
                  color: white;
              }
              .ws-body {
                  padding: 12px;
                  background: #ffffff;
                  color: #222222;
                  border-radius: 0 0 8px 8px;
              }
              .ws-status-row {
                  margin-bottom: 10px;
                  display: flex;
                  align-items: center;
                  color: #222222;
                  font-weight: 500;
              }
              .ws-status-row span:first-child {
                  margin-right: 8px;
                  font-weight: bold;
                  width: 70px;
                  color: #222222;
              }
              #btn-reconnect {
                  margin-left: 8px;
                  background: #f0f0f0;
                  border: 1px solid #dddddd;
                  border-radius: 50%;
                  width: 24px;
                  height: 24px;
                  cursor: pointer;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  font-size: 14px;
                  padding: 0;
              }
              #btn-reconnect:hover {
                  background: #e0e0e0;
              }
              .status-connected {
                  color: #006600;
                  font-weight: bold;
              }
              .status-disconnected {
                  color: #444444;
                  font-weight: bold;
              }
              .status-error {
                  color: #cc0000;
                  font-weight: bold;
              }
              .status-reconnecting {
                  color: #ff6600;
                  font-weight: bold;
              }
              .ws-info {
                  margin: 10px 0;
                  font-size: 13px;
                  background: #f0f0f0;
                  padding: 10px;
                  border-radius: 5px;
                  color: #222222;
                  border: 1px solid #dddddd;
              }
              .ws-info p {
                  margin: 4px 0;
                  color: #222222;
                  font-weight: 500;
              }
              .ws-controls {
                  display: flex;
                  justify-content: space-between;
                  margin: 10px 0;
                  flex-wrap: wrap;
                  gap: 5px;
              }
              .ws-controls button {
                  flex: 1;
                  min-width: 45%;
                  margin: 0 0 5px 0;
                  padding: 8px 0;
                  border: none;
                  border-radius: 4px;
                  background: #3a75c4;
                  color: white;
                  font-weight: bold;
                  cursor: pointer;
              }
              .ws-controls button:hover {
                  background: #2a5594;
              }
              .url-history {
                  margin-top: 12px;
                  background: #f0f0f0;
                  padding: 10px;
                  border-radius: 5px;
                  max-height: 150px;
                  overflow-y: auto;
                  border: 1px solid #dddddd;
              }
              .url-history h4 {
                  margin: 0 0 10px 0;
                  font-size: 14px;
                  color: #222222;
                  font-weight: bold;
              }
              #history-list {
                  margin: 0;
                  padding: 0;
                  list-style: none;
                  color: #222222;
              }
              #history-list li {
                  padding: 6px 0;
                  border-bottom: 1px solid #dddddd;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  font-size: 13px;
                  color: #222222;
              }
              #history-list li a {
                  flex: 1;
                  color: #0055aa;
                  text-decoration: none;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  margin-right: 8px;
                  font-weight: 500;
              }
              #history-list li a:hover {
                  text-decoration: underline;
                  color: #003377;
              }
              #history-list li button {
                  background: #dddddd;
                  border: none;
                  border-radius: 4px;
                  padding: 3px 8px;
                  font-size: 12px;
                  cursor: pointer;
                  color: #222222;
                  font-weight: 500;
              }
              #history-list li button:hover {
                  background: #cccccc;
              }
              .ws-minimized {
                  width: 45px;
                  height: 45px;
                  overflow: hidden;
                  border-radius: 50%;
              }
              .ws-minimized .ws-body {
                  display: none;
              }
              .ws-minimized .ws-header {
                  border-radius: 50%;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 45px;
              }
              .ws-minimized .ws-close-btn {
                  display: none;
              }
          `;

    document.body.appendChild(style);
    document.body.appendChild(panel);

    // 添加事件监听
    const closeBtn = panel.querySelector('.ws-close-btn');
    closeBtn.addEventListener('click', function () {
      panel.classList.toggle('ws-minimized');
    });

    // 添加控制按钮事件监听
    if (isTargetWebsite) {
      const playBtn = document.getElementById('btn-play');
      const pauseBtn = document.getElementById('btn-pause');
      const keyFBtn = document.getElementById('btn-key-f');
      const reconnectBtn = document.getElementById('btn-reconnect');

      if (playBtn) {
        playBtn.addEventListener('click', function () {
          handleVideoControl('play');
        });
      }

      if (pauseBtn) {
        pauseBtn.addEventListener('click', function () {
          handleVideoControl('pause');
        });
      }

      if (keyFBtn) {
        keyFBtn.addEventListener('click', function () {
          sendKeyPressToServer('f');
        });
      }

      if (reconnectBtn) {
        reconnectBtn.addEventListener('click', function () {
          // 手动触发重连
          console.log('手动触发WebSocket重连');
          // 重置重连计数
          wsReconnectAttempts = 0;
          // 连接WebSocket
          connectWebSocket();

          // 显示通知
          GM_notification({
            title: 'WebSocket重连',
            text: '正在尝试重新连接到服务器...',
            timeout: 2000
          });
        });
      }
    }

    // 加载历史记录
    loadHistory();

    // 自动连接
    if (isTargetWebsite) {
      setTimeout(connectWebSocket, 1000);
    }
  }

  // 添加到历史记录
  function addToHistory(url) {
    try {
      // 获取现有历史记录
      let history = getHistory();

      // 防止重复添加，如果已存在则删除旧的
      history = history.filter(item => item !== url);

      // 添加到最前面
      history.unshift(url);

      // 只保留最近的10条记录
      if (history.length > 10) {
        history = history.slice(0, 10);
      }

      // 保存历史记录
      localStorage.setItem('urlHistory', JSON.stringify(history));

      // 刷新历史记录显示
      loadHistory();
    } catch (e) {
      console.error('添加历史记录失败:', e);
    }
  }

  // 获取历史记录
  function getHistory() {
    try {
      const historyStr = localStorage.getItem('urlHistory');
      return historyStr ? JSON.parse(historyStr) : [];
    } catch (e) {
      console.error('获取历史记录失败:', e);
      return [];
    }
  }

  // 从历史记录中删除
  function removeFromHistory(url) {
    try {
      let history = getHistory();
      history = history.filter(item => item !== url);
      localStorage.setItem('urlHistory', JSON.stringify(history));
      loadHistory();
    } catch (e) {
      console.error('删除历史记录失败:', e);
    }
  }

  // 加载历史记录
  function loadHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    const history = getHistory();

    // 清空现有记录
    historyList.innerHTML = '';

    if (history.length === 0) {
      historyList.innerHTML = '<li style="color: #666666; text-align: center; font-style: italic;">暂无历史记录</li>';
      return;
    }

    // 添加记录到列表
    history.forEach(url => {
      const li = document.createElement('li');

      const a = document.createElement('a');
      a.href = 'javascript:void(0)';
      a.title = url;
      a.textContent = url;
      a.addEventListener('click', function () {
        handleOpenUrl(url);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '删除';
      deleteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeFromHistory(url);
      });

      li.appendChild(a);
      li.appendChild(deleteBtn);
      historyList.appendChild(li);
    });
  }

  //广东荔枝网自动播放
  (function () {
    'use strict';

    // --- Part 1: Generic Video Control Functions ---

    /**
     * 寻找页面上最可能被用户观看的视频。
     * 优先选择尺寸较大且在可视区域内的视频。
     * @returns {HTMLVideoElement|null} 返回找到的视频元素，如果找不到则返回 null。
     */
    function findActiveVideo() {
      const videos = Array.from(document.querySelectorAll('video'));
      if (videos.length === 0) {
        return null;
      }

      let bestVideo = null;
      let maxScore = -1;

      for (const video of videos) {
        const rect = video.getBoundingClientRect();
        // 必须是可见的，并且有有效尺寸
        if (rect.width > 100 && rect.height > 100) {
          const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
          const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

          // 计算视频在视口中的可见区域面积
          const visibleX = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
          const visibleY = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
          const visibleArea = visibleX * visibleY;

          // 简单的评分系统：可见面积越大，分数越高
          if (visibleArea > 0) {
            let score = visibleArea;
            // 如果视频正在播放，给予更高权重
            if (!video.paused) {
              score *= 1.5;
            }
            if (score > maxScore) {
              maxScore = score;
              bestVideo = video;
            }
          }
        }
      }
      // 如果没有视频在视口内，则返回第一个有尺寸的视频
      return bestVideo || videos.find(v => v.offsetWidth > 100 && v.offsetHeight > 100) || null;
    }

    /**
     * 切换视频的播放/暂停状态。
     * @param {HTMLVideoElement} video - 目标视频元素。
     */
    function togglePlayPause(video) {
      if (video.paused) {
        video.play().catch(error => console.error("脚本播放视频失败:", error));
      } else {
        video.pause();
      }
    }


    // --- Part 2: Main Keyboard Event Listener ---

    window.addEventListener('keydown', function (e) {
      const target = e.target;
      const key = e.key.toLowerCase();

      // 如果焦点在输入框、文本区域或可编辑元素中，则禁用所有快捷键
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // 根据按键执行不同操作
      switch (key) {
        // --- 通用功能: 空格键播放/暂停 ---
        case ' ':
          // 阻止空格键的默认行为（例如页面滚动）
          e.preventDefault();
          e.stopPropagation();
          const activeVideo = findActiveVideo();
          if (activeVideo) {
            togglePlayPause(activeVideo);
          }
          break;

        // --- 荔枝网(gdtv.cn) 专属功能 ---
        case 'f':
        case 'arrowup':
        case 'arrowdown':
          // 仅在荔枝网的频道详情页执行
          if (window.location.href.startsWith('https://www.gdtv.cn/tvChannelDetail/')) {
            e.preventDefault(); // 阻止默认行为 (如滚动页面)

            if (key === 'f') {
              // 'f'键: 全屏
              const fullscreenButton = document.querySelector('.vjs-fullscreen-control');
              if (fullscreenButton) {
                fullscreenButton.click();
              }
            } else {
              // 上/下方向键: 切换频道
              const channels = Array.from(document.querySelectorAll('a.index__tag-channel___3jA7i'));
              if (channels.length === 0) break;

              const currentIndex = channels.findIndex(channel => channel.classList.contains('index__current-channel___1fCTH'));
              if (currentIndex === -1) break;

              let nextIndex;
              if (key === 'arrowdown') {
                nextIndex = (currentIndex + 1) % channels.length;
              } else { // arrowup
                nextIndex = (currentIndex - 1 + channels.length) % channels.length;
              }

              const nextChannel = channels[nextIndex];
              if (nextChannel) {
                nextChannel.click();
              }
            }
          }
          // --- 央视直播(tv.cctv.com) 专属功能 ---
          else if (window.location.href.startsWith('https://tv.cctv.com/live/cctv')) {
            e.preventDefault(); // 阻止默认行为 (如滚动页面)

            if (key === 'f') {
              // 'f'键: 全屏
              const fullscreenButton = document.getElementById('player_fullscreen_no_mouseover_player');
              if (fullscreenButton) {
                fullscreenButton.click();
              }

            } else {
              // 上/下方向键: 切换央视频道 (1-17)
              const currentUrl = window.location.href;

              // 处理CCTV-9纪录频道的特殊情况
              if (currentUrl.includes('/live/cctvjilu/')) {
                let nextChannel;
                if (key === 'arrowdown') {
                  // 下键: 切换到下一个频道 (CCTV-10)
                  nextChannel = 10;
                } else { // arrowup
                  // 上键: 切换到上一个频道 (CCTV-8)
                  nextChannel = 8;
                }
                const newUrl = `https://tv.cctv.com/live/cctv${nextChannel}/`;
                window.location.href = newUrl;
                return;
              }

              // 处理CCTV-14少儿频道的特殊情况
              if (currentUrl.includes('/live/cctvchild/')) {
                let nextChannel;
                if (key === 'arrowdown') {
                  // 下键: 切换到下一个频道 (CCTV-15)
                  nextChannel = 15;
                } else { // arrowup
                  // 上键: 切换到上一个频道 (CCTV-13)
                  nextChannel = 13;
                }
                const newUrl = `https://tv.cctv.com/live/cctv${nextChannel}/`;
                window.location.href = newUrl;
                return;
              }

              // 处理其他频道的正常情况
              const match = currentUrl.match(/\/live\/cctv(\d+)/);
              if (match) {
                let currentChannel = parseInt(match[1]);
                let nextChannel;

                if (key === 'arrowdown') {
                  // 下键: 切换到下一个频道
                  if (currentChannel === 8) {
                    // 从CCTV-8切换到CCTV-9纪录频道
                    nextChannel = 'jilu';
                  } else if (currentChannel === 13) {
                    // 从CCTV-13切换到CCTV-14少儿频道
                    nextChannel = 'child';
                  } else if (currentChannel === 15) {
                    // 从CCTV-15切换到CCTV-16
                    nextChannel = 16;
                  } else {
                    nextChannel = currentChannel >= 17 ? 1 : currentChannel + 1;
                  }
                } else { // arrowup
                  // 上键: 切换到上一个频道
                  if (currentChannel === 10) {
                    // 从CCTV-10切换到CCTV-9纪录频道
                    nextChannel = 'jilu';
                  } else if (currentChannel === 15) {
                    // 从CCTV-15切换到CCTV-14少儿频道
                    nextChannel = 'child';
                  } else if (currentChannel === 13) {
                    // 从CCTV-13切换到CCTV-12
                    nextChannel = 12;
                  } else {
                    nextChannel = currentChannel <= 1 ? 17 : currentChannel - 1;
                  }
                }

                // 跳转到新的频道页面
                const newUrl = `https://tv.cctv.com/live/cctv${nextChannel}/`;
                window.location.href = newUrl;
              }
            }
          }
          break;
      }
    }, true); // 使用捕获阶段以确保能优先处理事件

  })();

  //设置浏览器标签页静音
  (function () {
    'use strict';

    // Detect which visibility API the browser uses
    let hidden, visibilityChange;
    if (typeof document.hidden !== "undefined") {
      hidden = "hidden";
      visibilityChange = "visibilitychange";
    } else if (typeof document.webkitHidden !== "undefined") {
      hidden = "webkitHidden";
      visibilityChange = "webkitvisibilitychange";
    } else if (typeof document.msHidden !== "undefined") {
      hidden = "msHidden";
      visibilityChange = "msvisibilitychange";
    }

    // Function to handle tab visibility changes
    function handleVisibilityChange() {
      const mediaElements = document.querySelectorAll("audio, video");

      if (document[hidden]) {
        // Tab is hidden, mute all media
        mediaElements.forEach(element => {
          if (!element.dataset.wasMuted) {
            element.dataset.wasMuted = element.muted;
            element.muted = true;
          }
        });
      } else {
        // Tab is visible again, restore previous mute state
        mediaElements.forEach(element => {
          if (element.dataset.wasMuted !== undefined) {
            element.muted = (element.dataset.wasMuted === "true");
            delete element.dataset.wasMuted;
          }
        });
      }
    }

    // Add event listener for visibility changes
    document.addEventListener(visibilityChange, handleVisibilityChange, false);
  })();
  //movie页面左右快进后退
  (function () {
    'use strict';
    document.addEventListener('keydown', (e) => {
      const video = document.querySelector('.dplayer-video');
      if (video && e.key === 'ArrowRight') {
        video.currentTime += 5;
        e.stopPropagation();
      } else if (video && e.key === 'ArrowLeft') {
        video.currentTime -= 5;
        e.stopPropagation();
      }
    }, true);
  })();
  // 执行点击最高分辨率按钮的主要函数
  function clickHighestResolution() {
    // 定位分辨率选择器容器
    const resolutionBar = document.getElementById('player_resolution_bar_player');

    if (resolutionBar) {
      // 获取所有分辨率按钮
      const resolutionButtons = resolutionBar.querySelectorAll('[id^="resolution_item_"][id$="_player"]');

      let highestResolutionButton = null;
      let highestLevel = -Infinity;

      // 遍历所有按钮，找到最高分辨率（level最大的）
      resolutionButtons.forEach(button => {
        const level = parseInt(button.getAttribute('level'));
        // 排除自动选项（level为-1）
        if (level > highestLevel && level >= 0) {
          highestLevel = level;
          highestResolutionButton = button;
        }
      });

      // 点击最高分辨率按钮
      if (highestResolutionButton) {
        highestResolutionButton.click();
        console.log(`已点击最高分辨率按钮: ${highestResolutionButton.id}, level: ${highestLevel}`);
        return true;
      } else {
        console.log('未找到合适的分辨率按钮');
        return false;
      }
    } else {
      console.log('未找到分辨率选择器容器');
      return false;
    }
  }


  function clickWithRetry(maxRetries = 5, delay = 1000) {
    let attempts = 0;

    function tryClick() {
      attempts++;
      if (clickHighestResolution()) {
        console.log(`成功执行，尝试次数: ${attempts}`);
      } else if (attempts < maxRetries) {
        console.log(`第${attempts}次尝试失败，${delay}ms后重试...`);
        setTimeout(tryClick, delay);
      } else {
        console.log(`达到最大重试次数(${maxRetries})，执行失败`);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryClick);
    } else {
      tryClick();
    }
  }

  clickWithRetry();



})();
