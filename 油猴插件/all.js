// ==UserScript==
// @name         超级无敌控制器
// @namespace    http://tampermonkey.net/
// @version      0.2.0
// @description  通过WebSocket连接到本地服务器，接收并打开视频链接，自动全屏视频，支持远程视频控制，支持央视直播频道切换
// @author       You
// @match        *://*/*
// @match        https://movie.tnanko.top/*
// @match        https://www.gdtv.cn/*
// @match        https://tv.cctv.com/live/cctv*
// @match        https://www.bilibili.com/*
// @match        https://tv.dogegg.online/*
// @noframes
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      cdn.socket.io
// @connect      192.168.1.115
// @connect      tv.dogegg.online
// @require      https://cdn.socket.io/4.6.0/socket.io.min.js
// @require      https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js
// ==/UserScript==



(function () {
  'use strict';
  // 防止脚本重复注入（@match *://*/* 和具体 URL 规则可能同时匹配导致执行两次）
  if (window.__apptvRemoteLoaded) return;
  window.__apptvRemoteLoaded = true;
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
  const isTargetWebsite = /movie\.tnanko\.top|www\.gdtv\.cn|tv\.cctv\.com|bilibili\.com|tv\.dogegg\.online/.test(window.location.href);

  console.log('=== 油猴脚本启动 ===');
  console.log('当前URL:', window.location.href);
  console.log('是否在目标网站:', isTargetWebsite);
  console.log('==================');

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

  // 创建简化的控制面板（只显示二维码）
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

  // Dogegg页面导航 - 基于视觉位置的简单导航
  let dogeggFocusedIndex = -1; // 当前聚焦卡片在可见列表中的索引

  function getDogeggColumnCount() {
    const grid = document.querySelector('[role="grid"]');
    if (grid) {
      const count = parseInt(grid.getAttribute('aria-colcount'));
      if (!isNaN(count) && count > 0) return count;
    }
    return 4;
  }

  function getAllVisibleCellsSorted() {
    // 获取所有可见 gridcell，按视觉位置排序（从上到下，从左到右）
    const cells = Array.from(document.querySelectorAll('[role="gridcell"]'));

    return cells.map(cell => {
      const rect = cell.getBoundingClientRect();
      return {
        cell,
        top: Math.round(rect.top),
        left: Math.round(rect.left)
      };
    }).sort((a, b) => {
      // 先按行排序（top 坐标，容差30px认为是同一行）
      const rowDiff = Math.floor(a.top / 30) - Math.floor(b.top / 30);
      if (rowDiff !== 0) return rowDiff;
      // 同一行内按列排序（left 坐标）
      return a.left - b.left;
    }).map(item => item.cell); // 只返回 cell 元素
  }

  function clearDogeggFocus() {
    document.querySelectorAll('[role="gridcell"]').forEach(cell => {
      const card = cell.querySelector('.video-card-visibility') || cell.firstElementChild;
      if (card) {
        card.style.outline = '';
        card.style.boxShadow = '';
      }
    });
  }

  function applyDogeggFocus(cell, index) {
    if (!cell) return;
    const card = cell.querySelector('.video-card-visibility') || cell.firstElementChild;
    if (!card) return;

    card.style.outline = '3px solid rgba(74, 222, 128, 0.85)';
    card.style.boxShadow = '0 0 0 5px rgba(74, 222, 128, 0.25)';
    card.style.borderRadius = '8px';
    cell.scrollIntoView({ behavior: 'smooth', block: 'center' });

    dogeggFocusedIndex = index;

    const cols = getDogeggColumnCount();
    const row = Math.floor(index / cols);
    const col = index % cols;
    console.log(`Dogegg: 聚焦 index=${index}, row=${row}, col=${col}`);
  }

  function dogeggNavigate(direction) {
    const cols = getDogeggColumnCount();
    const visibleCells = getAllVisibleCellsSorted();

    if (!visibleCells.length) {
      console.log('Dogegg: 没有找到可见的卡片');
      return;
    }

    // 初始化：聚焦第一个卡片
    if (dogeggFocusedIndex < 0 || dogeggFocusedIndex >= visibleCells.length) {
      clearDogeggFocus();
      applyDogeggFocus(visibleCells[0], 0);
      console.log('Dogegg: 初始化，聚焦第一个卡片');
      return;
    }

    let targetIndex = dogeggFocusedIndex;

    if (direction === 'left') {
      // 向左：index - 1，可以跨行（到达行首时跳到上一行末尾）
      const newIndex = dogeggFocusedIndex - 1;
      if (newIndex >= 0) {
        targetIndex = newIndex;
      }
    } else if (direction === 'right') {
      // 向右：index + 1，可以跨行（到达行末时跳到下一行开头）
      const newIndex = dogeggFocusedIndex + 1;
      if (newIndex < visibleCells.length) {
        targetIndex = newIndex;
      }
    } else if (direction === 'up') {
      // 向上：index - cols
      targetIndex = dogeggFocusedIndex - cols;
    } else if (direction === 'down') {
      // 向下：index + cols
      targetIndex = dogeggFocusedIndex + cols;
    }

    // 检查目标索引是否在可见范围内
    if (targetIndex >= 0 && targetIndex < visibleCells.length) {
      // 目标卡片可见，直接聚焦
      clearDogeggFocus();
      applyDogeggFocus(visibleCells[targetIndex], targetIndex);
    } else if ((direction === 'up' && targetIndex < 0) || (direction === 'down' && targetIndex >= visibleCells.length)) {
      // 需要滚动
      const scrollAmount = direction === 'down' ? 350 : -350;
      window.scrollBy({ top: scrollAmount, behavior: 'smooth' });

      console.log(`Dogegg: 滚动 ${direction}, 等待新卡片渲染`);

      // 滚动后重新获取卡片列表并尝试聚焦
      setTimeout(() => {
        const newVisibleCells = getAllVisibleCellsSorted();

        // 重新计算目标索引（保持同一列）
        const currentCol = dogeggFocusedIndex % cols;
        let newTargetIndex = -1;

        if (direction === 'down') {
          // 向下滚动后，找到第一行的同一列
          newTargetIndex = currentCol;
        } else if (direction === 'up') {
          // 向上滚动后，找到最后一行的同一列
          const lastRowStart = Math.floor((newVisibleCells.length - 1) / cols) * cols;
          newTargetIndex = Math.min(lastRowStart + currentCol, newVisibleCells.length - 1);
        }

        if (newTargetIndex >= 0 && newTargetIndex < newVisibleCells.length) {
          clearDogeggFocus();
          applyDogeggFocus(newVisibleCells[newTargetIndex], newTargetIndex);
        }
      }, 450);
    }
  }

  function dogeggClick() {
    const visibleCells = getAllVisibleCellsSorted();

    if (dogeggFocusedIndex < 0 || dogeggFocusedIndex >= visibleCells.length) {
      console.log('Dogegg: 没有聚焦的卡片');
      return;
    }

    const cell = visibleCells[dogeggFocusedIndex];
    if (!cell) return;

    // 点击播放按钮 div[data-button="true"]（第一个匹配的）
    const playBtn = cell.querySelector('[data-button="true"]');
    if (playBtn) {
      console.log(`Dogegg: 点击播放按钮 index=${dogeggFocusedIndex}`);
      playBtn.click();
      return;
    }

    // 降级：点击整个卡片
    const card = cell.querySelector('.video-card-visibility') || cell.firstElementChild;
    if (card) {
      card.click();
      console.log(`Dogegg: 降级点击卡片 index=${dogeggFocusedIndex}`);
    }
  }

  // Dogegg播放页面播放源切换功能
  let dogeggPlaySourceIndex = -1;
  let cachedDogeggSources = null;

  // === 播放页面 Tab 工具函数 ===
  function findPlayTab(tabText) {
    const span = Array.from(document.querySelectorAll('span')).find(
      el => el.textContent?.trim() === tabText
    );
    return span ? span.closest('.cursor-pointer') : null;
  }

  function getActiveTabName() {
    const episodeTab = findPlayTab('选集');
    if (!episodeTab) return '换源';
    // Active tab has 'text-primary-600' as a standalone token
    // Inactive tab only has 'hover:text-primary-600' (different token) + 'text-gray-700'
    const classes = episodeTab.className.split(/\s+/);
    if (classes.includes('text-primary-600')) return '选集';
    return '换源';
  }

  function switchToPlayTab(tabText) {
    const tab = findPlayTab(tabText);
    if (!tab) { console.log('Dogegg播放页: 未找到Tab:', tabText); return false; }
    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    tab.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
    tab.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
    cachedDogeggSources = null; dogeggPlaySourceIndex = -1;
    cachedDogeggEpisodes = null; dogeggEpisodeIndex = -1;
    console.log('Dogegg播放页: 已切换到Tab:', tabText);
    return true;
  }

  // === 选集功能 ===
  let dogeggEpisodeIndex = -1;
  let cachedDogeggEpisodes = null;

  function getDogeggEpisodes() {
    if (cachedDogeggEpisodes && cachedDogeggEpisodes.length > 0 &&
        cachedDogeggEpisodes.every(el => document.body.contains(el))) {
      return cachedDogeggEpisodes;
    }
    cachedDogeggEpisodes = null; dogeggEpisodeIndex = -1;

    const episodeLabel = Array.from(document.querySelectorAll('span')).find(
      el => el.textContent?.trim() === '选集'
    );
    if (!episodeLabel) { console.log('Dogegg播放页: 未找到"选集"标签'); return []; }

    let container = null;
    let anc = episodeLabel.parentElement;
    while (anc && anc.tagName !== 'BODY') {
      const found = anc.querySelector('[class*="content-start"]');
      if (found) { container = found; break; }
      anc = anc.parentElement;
    }
    if (!container) { console.log('Dogegg播放页: 未找到集数列表容器'); return []; }

    const btns = Array.from(container.querySelectorAll('button'));
    console.log('Dogegg播放页: 找到', btns.length, '个集数按钮');
    cachedDogeggEpisodes = btns;
    return btns;
  }

  function highlightDogeggEpisode(index) {
    const episodes = getDogeggEpisodes();
    if (index < 0 || index >= episodes.length) return;
    episodes.forEach(b => { b.style.outline = ''; b.style.boxShadow = ''; });
    const current = episodes[index];
    current.style.outline = '3px solid rgba(74, 222, 128, 0.85)';
    current.style.boxShadow = '0 0 0 6px rgba(74, 222, 128, 0.2)';
    current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    console.log('Dogegg播放页: 高亮集数 [' + (index + 1) + '/' + episodes.length + '] ' + current.textContent?.trim());
  }

  function dogeggEpisodeNavigate(direction) {
    if (!window.location.href.includes('tv.dogegg.online/play')) return;
    const episodes = getDogeggEpisodes();
    if (episodes.length === 0) { console.log('Dogegg播放页: 找不到集数列表'); return; }
    if (dogeggEpisodeIndex < 0) {
      const currentIdx = episodes.findIndex(btn =>
        btn.className.includes('from-primary-500') || btn.className.includes('scale-105')
      );
      dogeggEpisodeIndex = currentIdx >= 0 ? currentIdx : 0;
      highlightDogeggEpisode(dogeggEpisodeIndex);
      return;
    }
    if (direction === 'up') dogeggEpisodeIndex = Math.max(0, dogeggEpisodeIndex - 1);
    else if (direction === 'down') dogeggEpisodeIndex = Math.min(episodes.length - 1, dogeggEpisodeIndex + 1);
    highlightDogeggEpisode(dogeggEpisodeIndex);
  }

  function dogeggEpisodeClick() {
    if (!window.location.href.includes('tv.dogegg.online/play')) return;
    const episodes = getDogeggEpisodes();
    if (dogeggEpisodeIndex < 0 || dogeggEpisodeIndex >= episodes.length) { console.log('Dogegg播放页: 没有选中的集数'); return; }
    const btn = episodes[dogeggEpisodeIndex];
    console.log('Dogegg播放页: 点击集数 ' + btn.textContent?.trim());
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    btn.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
    btn.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
    cachedDogeggEpisodes = null; dogeggEpisodeIndex = -1;
  }

  function getDogeggPlaySources() {
    // 缓存有效直接返回
    if (cachedDogeggSources && cachedDogeggSources.length > 0 &&
        cachedDogeggSources.every(el => document.body.contains(el))) {
      return cachedDogeggSources;
    }
    cachedDogeggSources = null;
    dogeggPlaySourceIndex = -1;

    // Step1: 找文本严格等于"换源"的 span
    const sourceLabel = Array.from(document.querySelectorAll('span')).find(
      el => el.textContent?.trim() === '换源'
    );
    if (!sourceLabel) {
      console.log('Dogegg播放页: 未找到"换源"标签，请确认换源面板已打开');
      return [];
    }

    // Step2: 从"换源"span 向上遍历，找到包含 overflow-y-auto 子元素的祖先
    let listContainer = null;
    let ancestor = sourceLabel.parentElement;
    while (ancestor && ancestor !== document.body) {
      const found = ancestor.querySelector('.overflow-y-auto');
      if (found) {
        listContainer = found;
        break;
      }
      ancestor = ancestor.parentElement;
    }

    if (!listContainer) {
      console.log('Dogegg播放页: 未找到资源列表容器');
      return [];
    }

    // Step3: 取列表直接子 div 中包含 img 的（即资源卡片，排除底部"影片匹配有误"按钮）
    const items = Array.from(listContainer.children).filter(
      el => el.tagName === 'DIV' && el.querySelector('img')
    );

    if (items.length === 0) {
      console.log('Dogegg播放页: 未找到资源卡片，listContainer.children:', listContainer.children.length);
      return [];
    }

    console.log(`Dogegg播放页: 找到 ${items.length} 个资源卡片`);
    cachedDogeggSources = items;
    return items;
  }

  function highlightDogeggPlaySource(index) {
    const sources = getDogeggPlaySources();
    if (index < 0 || index >= sources.length) return;

    // 清除所有高亮
    sources.forEach(source => {
      source.style.outline = '';
      source.style.boxShadow = '';
    });

    // 高亮当前选中的资源条目
    const current = sources[index];
    current.style.outline = '3px solid rgba(74, 222, 128, 0.85)';
    current.style.boxShadow = '0 0 0 6px rgba(74, 222, 128, 0.2)';

    // 滚动到可见区域
    current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 读取资源名称用于日志
    const nameEl = current.querySelector('span[class*="border"]');
    const name = nameEl ? nameEl.textContent?.trim() : `第${index + 1}项`;
    console.log(`Dogegg播放页: 高亮资源 [${index + 1}/${sources.length}] ${name}`);
  }

  function dogeggPlaySourceNavigate(direction) {
    if (!window.location.href.includes('tv.dogegg.online/play')) return;

    const sources = getDogeggPlaySources();
    if (sources.length === 0) {
      console.log('Dogegg播放页: 找不到换源列表，请确认换源面板已打开');
      return;
    }

    // 初始化：定位到当前正在播放的那个资源（有"当前源"标签）
    if (dogeggPlaySourceIndex < 0) {
      const currentIdx = sources.findIndex(el =>
        el.textContent?.includes('当前源')
      );
      dogeggPlaySourceIndex = currentIdx >= 0 ? currentIdx : 0;
      highlightDogeggPlaySource(dogeggPlaySourceIndex);
      return;
    }

    if (direction === 'up') {
      dogeggPlaySourceIndex = Math.max(0, dogeggPlaySourceIndex - 1);
    } else if (direction === 'down') {
      dogeggPlaySourceIndex = Math.min(sources.length - 1, dogeggPlaySourceIndex + 1);
    }

    highlightDogeggPlaySource(dogeggPlaySourceIndex);
  }

  function dogeggPlaySourceClick() {
    if (!window.location.href.includes('tv.dogegg.online/play')) return;

    const sources = getDogeggPlaySources();
    if (dogeggPlaySourceIndex < 0 || dogeggPlaySourceIndex >= sources.length) {
      console.log('Dogegg播放页: 没有选中的资源');
      return;
    }

    const item = sources[dogeggPlaySourceIndex];
    const nameEl = item.querySelector('span[class*="border"]');
    const name = nameEl ? nameEl.textContent?.trim() : `第${dogeggPlaySourceIndex + 1}项`;
    console.log(`Dogegg播放页: 点击资源 ${name}`);

    // React 应用需要真实的 MouseEvent 才能触发合成事件
    item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    item.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
    item.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));

    // 点击后清空缓存，等待页面更新
    cachedDogeggSources = null;
    dogeggPlaySourceIndex = -1;
  }

  // === B站历史页导航 ===
  let bilibiliHistoryFocusedIndex = -1;
  let cachedBilibiliHistoryItems = null;

  function getBilibiliHistoryItems() {
    if (cachedBilibiliHistoryItems && cachedBilibiliHistoryItems.length > 0 &&
        cachedBilibiliHistoryItems.every(el => el.isConnected)) {
      return cachedBilibiliHistoryItems;
    }
    cachedBilibiliHistoryItems = null;
    bilibiliHistoryFocusedIndex = -1;
    // BewlyCat 使用 open Shadow DOM，Vue 应用挂载在 #bewly.shadowRoot 内
    const bewly = document.getElementById('bewly');
    if (!bewly) { console.log('B站历史页: 未找到 #bewly 容器'); return []; }
    const root = bewly.shadowRoot;
    if (!root) { console.log('B站历史页: 未找到 shadowRoot'); return []; }
    const items = Array.from(root.querySelectorAll('a.group')).filter(
      a => a.querySelector('section') && a.href && a.href.includes('bilibili')
    );
    console.log('B站历史页: 找到', items.length, '个历史记录');
    cachedBilibiliHistoryItems = items;
    return items;
  }

  function highlightBilibiliHistoryItem(index) {
    const items = getBilibiliHistoryItems();
    if (index < 0 || index >= items.length) return;
    // 清除所有高亮（作用在 <section> 上）
    items.forEach(item => {
      const sec = item.querySelector('section');
      if (sec) { sec.style.outline = ''; sec.style.boxShadow = ''; sec.style.background = ''; }
    });
    const current = items[index];
    const sec = current.querySelector('section');
    if (sec) {
      sec.style.outline = '3px solid rgba(251, 114, 153, 0.85)';
      sec.style.boxShadow = '0 0 0 6px rgba(251, 114, 153, 0.2)';
      sec.style.background = 'rgba(251, 114, 153, 0.08)';
    }
    current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const imgEl = current.querySelector('img');
    console.log('B站历史: 高亮 [' + (index + 1) + '/' + items.length + '] ' + (imgEl ? imgEl.alt || '' : ''));
  }

  function bilibiliHistoryNavigate(direction) {
    const items = getBilibiliHistoryItems();
    if (items.length === 0) { console.log('B站历史页: 找不到历史记录'); return; }
    if (bilibiliHistoryFocusedIndex < 0) {
      bilibiliHistoryFocusedIndex = 0;
    } else if (direction === 'up') {
      bilibiliHistoryFocusedIndex = Math.max(0, bilibiliHistoryFocusedIndex - 1);
    } else if (direction === 'down') {
      if (bilibiliHistoryFocusedIndex >= items.length - 1) {
        // 已到末尾，清除缓存重新查询，获取 BewlyCat 已加载的新条目
        const prevCount = items.length;
        cachedBilibiliHistoryItems = null;
        const newItems = getBilibiliHistoryItems();
        if (newItems.length > prevCount) {
          bilibiliHistoryFocusedIndex = prevCount; // 跳到原列表之后的第一个新条目
          console.log('B站历史: 加载新条目，共', newItems.length, '个');
        } else {
          console.log('B站历史: 已到最末，暂无更多');
        }
      } else {
        bilibiliHistoryFocusedIndex = bilibiliHistoryFocusedIndex + 1;
      }
    }
    highlightBilibiliHistoryItem(bilibiliHistoryFocusedIndex);
  }

  function bilibiliHistoryClick() {
    const items = getBilibiliHistoryItems();
    if (bilibiliHistoryFocusedIndex < 0 || bilibiliHistoryFocusedIndex >= items.length) { console.log('B站历史: 没有选中的项目'); return; }
    const item = items[bilibiliHistoryFocusedIndex];
    console.log('B站历史: 打开视频', item.href);
    item.click(); // 触发 BewlyCat ALink 点击处理
    cachedBilibiliHistoryItems = null;
    bilibiliHistoryFocusedIndex = -1;
  }

  // 处理B站搜索命令
  function handleBilibiliSearch(keyword) {
    console.log('处理B站搜索命令, 关键词:', keyword);

    if (!keyword || keyword.trim() === '') {
      console.warn('搜索关键词为空');
      return;
    }

    try {
      // 构建B站搜索URL（使用 bilibili.com 的搜索参数格式）
      const searchUrl = `https://www.bilibili.com/?page=SearchResults&keyword=${encodeURIComponent(keyword.trim())}`;
      console.log('即将跳转到:', searchUrl);

      // 显示通知
      GM_notification({
        title: 'B站搜索',
        text: `正在搜索: ${keyword}`,
        timeout: 3000
      });

      // 在当前页面跳转
      window.location.href = searchUrl;
    } catch (e) {
      console.error('处理B站搜索失败:', e);
      GM_notification({
        title: 'B站搜索失败',
        text: e.message,
        timeout: 3000
      });
    }
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

        // 连接成功后，检测并回传当前模式
        detectAndReportMode();
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

      // 处理B站搜索命令
      socket.on('bilibili_search_command', function (data) {
        console.log('收到B站搜索命令:', data);
        handleBilibiliSearch(data.keyword);
      });

      // 处理B站首页命令
      socket.on('bilibili_home_command', function (data) {
        console.log('收到B站首页命令:', data);
        console.log('即将跳转到:', data.url);

        // 显示通知
        GM_notification({
          title: 'B站首页',
          text: '正在跳转到首页...',
          timeout: 2000
        });

        // 执行跳转
        setTimeout(() => {
          window.location.href = data.url;
          console.log('已执行跳转命令');
        }, 100);
      });


      // 处理B站观看历史命令
      socket.on('bilibili_history_command', function (data) {
        if (!window.location.href.includes('bilibili.com')) return;
        const cmdId = 'bhist_' + data.timestamp;
        const lastCmd = localStorage.getItem('__bilibili_cmd__');
        if (lastCmd === cmdId) return;
        localStorage.setItem('__bilibili_cmd__', cmdId);
        console.log('收到B站观看历史命令');
        window.location.href = data.url;
      });

      // 处理B站我的收藏命令
      socket.on('bilibili_favorites_command', function (data) {
        if (!window.location.href.includes('bilibili.com')) return;
        const cmdId = 'bfav_' + data.timestamp;
        const lastCmd = localStorage.getItem('__bilibili_cmd__');
        if (lastCmd === cmdId) return;
        localStorage.setItem('__bilibili_cmd__', cmdId);
        console.log('收到B站我的收藏命令');
        window.location.href = 'https://www.bilibili.com/?page=Favorites';
      });


      // 处理央视频道切换命令
      socket.on('cctv_channel_command', function (data) {
        if (!window.location.href.includes('tv.cctv.com')) return;
        const cmdId = 'cctv_' + data.timestamp;
        const lastCmd = localStorage.getItem('__cctv_cmd__');
        if (lastCmd === cmdId) return;
        localStorage.setItem('__cctv_cmd__', cmdId);
        console.log('收到央视频道切换命令:', data.name, data.url);
        GM_notification({
          title: '央视频道',
          text: '切换到 ' + data.name,
          timeout: 2000
        });
        window.location.href = data.url;
      });


      // 处理广东频道切换命令
      socket.on('guangdong_channel_command', function (data) {
        if (!window.location.href.includes('gdtv.cn')) return;
        const cmdId = 'gd_' + data.timestamp;
        const lastCmd = localStorage.getItem('__gd_cmd__');
        if (lastCmd === cmdId) return;
        localStorage.setItem('__gd_cmd__', cmdId);
        console.log('收到广东频道切换命令:', data.name, data.url);
        GM_notification({
          title: '广东频道',
          text: '切换到 ' + data.name,
          timeout: 2000
        });
        window.location.href = data.url;
      });

      // 处理B站历史页导航命令
      socket.on('bilibili_history_navigate_command', function (data) {
        if (!window.location.href.includes('bilibili.com') || !window.location.href.includes('page=History')) return;
        const cmdId = 'bhnav_' + data.timestamp + '_' + data.direction;
        const lastCmd = localStorage.getItem('__bilibili_cmd__');
        if (lastCmd === cmdId) return;
        localStorage.setItem('__bilibili_cmd__', cmdId);
        console.log('收到B站历史导航命令:', data.direction);
        if (data.direction === 'click') {
          bilibiliHistoryClick();
        } else {
          bilibiliHistoryNavigate(data.direction);
        }
      });


  // === Dogegg 播放页视频快进/快退 ===
  function dogeggVideoSeek(direction) {
    const video = document.querySelector('video');
    if (!video) {
      console.log('Dogegg播放页: 未找到视频元素');
      return;
    }
    const seekAmount = 10; // 快进/快退秒数
    if (direction === 'left') {
      video.currentTime = Math.max(0, video.currentTime - seekAmount);
      console.log('Dogegg播放页: 后退', seekAmount, '秒，当前', Math.floor(video.currentTime), '/', Math.floor(video.duration || 0));
    } else if (direction === 'right') {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + seekAmount);
      console.log('Dogegg播放页: 前进', seekAmount, '秒，当前', Math.floor(video.currentTime), '/', Math.floor(video.duration || 0));
    }
  }

      // 处理Dogegg导航命令
      socket.on('dogegg_navigate_command', function (data) {
        if (!window.location.href.includes('tv.dogegg.online'))
          return;
        // 用 localStorage 跨 iframe 去重，防止多个脚本实例重复执行
        const cmdId = 'nav_' + data.timestamp + '_' + data.direction;
        const lastCmd = localStorage.getItem('__dogegg_cmd__');
        if (lastCmd === cmdId) return;
        localStorage.setItem('__dogegg_cmd__', cmdId);
        console.log('收到Dogegg导航命令:', data.direction);

        // 判断是否在播放页面
        if (window.location.href.includes('/play')) {
          // 播放页面：上下键根据当前激活Tab决定行为
          if (data.direction === 'up' || data.direction === 'down') {
            const activeTab = getActiveTabName();
            console.log('当前激活Tab:', activeTab);
            if (activeTab === '选集') {
              dogeggEpisodeNavigate(data.direction);
            } else {
              dogeggPlaySourceNavigate(data.direction);
            }
          } else if (data.direction === 'left' || data.direction === 'right') {
            // 左右键：控制视频播放器快进/快退
            dogeggVideoSeek(data.direction);
          } else {
            dogeggNavigate(data.direction);
          }
        } else {
          // 非播放页面：卡片导航
          dogeggNavigate(data.direction);
        }
      });

      // 处理Dogegg点击命令
      socket.on('dogegg_click_command', function (data) {
        if (!window.location.href.includes('tv.dogegg.online'))
          return;
        const cmdId = 'click_' + data.timestamp;
        const lastCmd = localStorage.getItem('__dogegg_cmd__');
        if (lastCmd === cmdId) return;
        localStorage.setItem('__dogegg_cmd__', cmdId);
        console.log('收到Dogegg点击命令');

        // 判断是否在播放页面
        if (window.location.href.includes('/play')) {
          const activeTab = getActiveTabName();
          if (activeTab === '选集') {
            dogeggEpisodeClick();
          } else {
            dogeggPlaySourceClick();
          }
        } else {
          dogeggClick();
        }
      });

      // 处理Dogegg Tab切换命令
      socket.on('dogegg_tab_command', function (data) {
        if (!window.location.href.includes('tv.dogegg.online/play')) return;
        const cmdId = 'tab_' + data.timestamp;
        const lastCmd = localStorage.getItem('__dogegg_cmd__');
        if (lastCmd === cmdId) return;
        localStorage.setItem('__dogegg_cmd__', cmdId);
        console.log('收到Dogegg Tab切换命令:', data.tab);
        switchToPlayTab(data.tab);
      });

      // 处理Dogegg首页命令
      socket.on('dogegg_home_command', function (data) {
        const cmdId = 'home_' + data.timestamp;
        const lastCmd = localStorage.getItem('__dogegg_cmd__');
        if (lastCmd === cmdId) return;
        localStorage.setItem('__dogegg_cmd__', cmdId);
        console.log('收到Dogegg首页命令:', data.url);
        window.location.href = data.url;
      });

      // 处理Dogegg搜索命令
      socket.on('dogegg_search_command', function (data) {
        const cmdId = 'search_' + data.timestamp;
        const lastCmd = localStorage.getItem('__dogegg_cmd__');
        if (lastCmd === cmdId) return;
        localStorage.setItem('__dogegg_cmd__', cmdId);

        const keyword = data.keyword;
        console.log('收到Dogegg搜索命令, 关键词:', keyword);

        // 构建搜索URL
        const searchUrl = `https://tv.dogegg.online/search?q=${encodeURIComponent(keyword)}`;
        console.log('即将跳转到:', searchUrl);

        // 显示通知
        GM_notification({
          title: 'Dogegg搜索',
          text: `正在搜索: ${keyword}`,
          timeout: 3000
        });

        // 跳转到搜索页面
        window.location.href = searchUrl;
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

        // 直接在当前窗口打开URL，而不是新标签页
        window.location.href = url;

        // 跳转后会触发页面刷新，在新页面的 detectAndReportMode 中自动检测模式
      } else {
        console.error('收到无效URL:', url);
      }
    } catch (e) {
      console.error('处理打开URL命令失败:', e);
    }
  }

  // 检测当前页面模式并回传给服务器
  function detectAndReportMode() {
    if (!socket || !socket.connected) return;

    const currentUrl = window.location.href;
    let mode = 'normal';
    let subMode = 'normal';

    if (currentUrl.includes('bilibili.com')) {
      mode = 'bilibili';
      if (currentUrl.includes('page=History')) subMode = 'history';
    } else if (currentUrl.includes('tv.dogegg.online')) {
      mode = 'dogegg';
    } else if (currentUrl.includes('tv.cctv.com')) {
      mode = 'cctv';
    } else if (currentUrl.includes('gdtv.cn')) {
      mode = 'guangdong';
    }

    console.log('当前模式:', mode, '子模式:', subMode);
    socket.emit('report_mode', { mode: mode });
    socket.emit('bilibili_sub_mode', { sub_mode: subMode });
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

  // 从 server 获取本机局域网IP
  async function getLocalIP() {
    console.log('[IP获取] 开始获取本机IP...');

    try {
      // 从本地 server 获取 IP
      console.log('[IP获取] 尝试从服务器获取: http://localhost:5003/get-local-ip');
      const response = await fetch('http://localhost:5003/get-local-ip', {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });

      console.log('[IP获取] 服务器响应状态:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[IP获取] 服务器返回数据:', data);

        if (data.success && data.ip) {
          console.log('[IP获取] ✓ 从服务器获取到本机IP:', data.ip);
          return data.ip;
        } else {
          console.warn('[IP获取] 服务器返回数据格式不正确');
        }
      } else {
        console.warn('[IP获取] 服务器响应状态异常:', response.status);
      }
    } catch (e) {
      console.error('[IP获取] ✗ 从服务器获取本机IP失败:', e.message);
    }

    console.log('[IP获取] 服务器方法失败，尝试WebRTC备用方案...');

    // 如果服务器获取失败，尝试通过WebRTC获取本地IP（备用方案）
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      return new Promise((resolve) => {
        let ipFound = false;

        pc.onicecandidate = (ice) => {
          if (ipFound) return;

          if (!ice || !ice.candidate || !ice.candidate.candidate) {
            if (!ipFound) {
              pc.close();
              console.warn('[IP获取] WebRTC未找到候选地址，返回localhost');
              resolve('localhost');
            }
            return;
          }

          const candidateStr = ice.candidate.candidate;
          console.log('[IP获取] WebRTC候选地址:', candidateStr);

          const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
          const ipMatch = ipRegex.exec(candidateStr);

          if (ipMatch && ipMatch[1]) {
            const ip = ipMatch[1];
            // 过滤掉127.0.0.1，优先192.168开头的
            if (ip !== '127.0.0.1' && !ipFound) {
              ipFound = true;
              pc.close();
              console.log('[IP获取] ✓ 通过WebRTC获取到本机IP:', ip);
              resolve(ip);
              return;
            }
          }
        };

        // 5秒超时
        setTimeout(() => {
          if (!ipFound) {
            pc.close();
            console.warn('[IP获取] WebRTC超时，返回localhost');
            resolve('localhost');
          }
        }, 5000);
      });
    } catch (e) {
      console.error('[IP获取] ✗ WebRTC获取本地IP失败:', e.message);
      return 'localhost';
    }
  }

  // 创建简化的控制面板（只显示二维码）
  function createControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'ws-control-panel';

    // 如果不在目标网站上，默认隐藏
    if (!isTargetWebsite) {
      panel.style.display = 'none';
    }

    panel.innerHTML = `
      <div class="ws-header">
        远程控制
        <span class="ws-close-btn">&times;</span>
      </div>
      <div class="ws-body">
        <div class="ws-status-row">
          <span>连接状态:</span>
          <span id="ws-connection-status" class="status-disconnected">未连接</span>
          <button id="btn-reconnect" title="重新连接">🔄</button>
        </div>
        <div class="qr-container">
          <h4>扫码打开遥控器</h4>
          <div id="qrcode-holder" class="qrcode-wrapper"></div>
          <p class="qr-hint">使用手机扫描二维码访问遥控器</p>
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
      .qr-container {
        margin-top: 15px;
        text-align: center;
      }
      .qr-container h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #222222;
        font-weight: bold;
      }
      .qrcode-wrapper {
        display: inline-block;
        padding: 10px;
        background: white;
        border: 2px solid #3a75c4;
        border-radius: 8px;
        margin: 10px 0;
      }
      .qr-hint {
        margin: 10px 0 0 0;
        font-size: 12px;
        color: #666666;
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

    // 添加重连按钮事件
    if (isTargetWebsite) {
      const reconnectBtn = document.getElementById('btn-reconnect');
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

    // 生成二维码
    generateQRCode();

    // 自动连接
    if (isTargetWebsite) {
      setTimeout(connectWebSocket, 1000);
    }
  }

  // 生成二维码
  async function generateQRCode() {
    const qrcodeHolder = document.getElementById('qrcode-holder');
    if (!qrcodeHolder) {
      console.error('未找到二维码容器');
      return;
    }

    // 显示加载中
    qrcodeHolder.innerHTML = '<p style="color: #666; margin: 20px 0; font-size: 13px;">正在获取本机IP...</p>';

    // 获取本机局域网IP
    const localIP = await getLocalIP();
    const controlUrl = `http://${localIP}:5003`;

    console.log('[二维码] 生成二维码URL:', controlUrl);

    // 清空容器
    qrcodeHolder.innerHTML = '';

    // 使用QRCode.js生成二维码
    try {
      new QRCode(qrcodeHolder, {
        text: controlUrl,
        width: 180,
        height: 180,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
      console.log('[二维码] ✓ 二维码生成成功');

      // 在二维码下方显示URL
      const urlText = document.createElement('p');
      urlText.style.cssText = 'margin: 8px 0 0 0; font-size: 11px; color: #666; word-break: break-all;';
      urlText.textContent = controlUrl;
      qrcodeHolder.appendChild(urlText);
    } catch (error) {
      console.error('[二维码] ✗ 生成二维码失败:', error);
      qrcodeHolder.innerHTML = '<p style="color: #cc0000; margin: 20px 0; font-size: 12px;">二维码生成失败</p>';
    }
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
