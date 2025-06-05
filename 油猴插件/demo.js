// ==UserScript==
// @name         浏览器远程控制 - 链接接收器
// @namespace    http://tampermonkey.net/
// @version      0.1.3
// @description  通过WebSocket连接到本地服务器，接收并打开视频链接，自动全屏视频，支持远程视频控制
// @author       You
// @match        *://*/*
// @match        https://movie.tnanko.top/*
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      cdn.socket.io
// @connect      192.168.1.115
// @require      https://cdn.socket.io/4.6.0/socket.io.min.js
// ==/UserScript==

// todo 
// sendKeyToESP32("F");


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
  const isTargetWebsite = window.location.href.includes('movie.tnanko.top');

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
})();
