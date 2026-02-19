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
  const backBtn = document.getElementById('back-btn');
  const cctvliveBtn = document.getElementById('switch_cctv_live');
  const cctvChannelsContainer = document.getElementById('cctv-channels-container');
  const cctvChannelsGrid = document.getElementById('cctv-channels-grid');
  const cctvToggleBtn = document.getElementById('cctv-toggle-btn');
  const cctvChannelsTitle = document.querySelector('.cctv-channels-title');
  const guangdongChannelsContainer = document.getElementById('guangdong-channels-container');
  const guangdongChannelsGrid = document.getElementById('guangdong-channels-grid');
  const guangdongToggleBtn = document.getElementById('guangdong-toggle-btn');
  const guangdongChannelsTitle = document.querySelector('.guangdong-channels-title');
  const guangdongLiveBtn = document.getElementById('guangdong-live-btn');
  const bilibiliBtn = document.getElementById('bilibili-btn');
  const lunaTvBtn = document.getElementById('lunatv-btn');
  const modeLabel = document.getElementById('mode-label');
  const bilibiliSearchContainer = document.getElementById('bilibili-search-container');
  const bilibiliSearchInput = document.getElementById('bilibili-search-input');
  const bilibiliSearchBtn = document.getElementById('bilibili-search-btn');
  const lunatvSearchContainer = document.getElementById('lunatv-search-container');
  const lunatvSearchInput = document.getElementById('lunatv-search-input');
  const lunatvSearchBtn = document.getElementById('lunatv-search-btn');
  const bilibiliHistoryBtn = document.getElementById('bilibili-history-btn');
  const bilibiliFavoritesBtn = document.getElementById('bilibili-favorites-btn');
  const lunatvTabEpisodeBtn = document.getElementById('lunatv-tab-episode-btn');
  const lunatvTabSourceBtn = document.getElementById('lunatv-tab-source-btn');
  const lunatvHistoryContainer = document.getElementById('lunatv-history-container');
  const lunatvHistoryList = document.getElementById('lunatv-history-list');
  const lunatvClearHistoryBtn = document.getElementById('lunatv-clear-history-btn');
  const lunatvHistoryPrevBtn = document.getElementById('lunatv-history-prev-btn');
  const lunatvHistoryNextBtn = document.getElementById('lunatv-history-next-btn');
  const lunatvHistoryPageInfo = document.getElementById('lunatv-history-page-info');
  const lunatvHistoryPagination = document.getElementById('lunatv-history-pagination');
  const searchHistoryContainer = document.getElementById('search-history-container');
  const searchHistoryList = document.getElementById('search-history-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const historyPrevBtn = document.getElementById('history-prev-btn');
  const historyNextBtn = document.getElementById('history-next-btn');
  const historyPageInfo = document.getElementById('history-page-info');
  const historyPagination = document.getElementById('history-pagination');
  const volumeDownBtn = document.getElementById('volume-down-btn');
  const volumeUpBtn = document.getElementById('volume-up-btn');

  // 屏幕唤醒相关
  const wakeScreenBtn = document.getElementById('wake-screen-btn');

  // HDR切换按钮
  const toggleHdrBtn = document.getElementById('toggle-hdr-btn');

  // 保存当前音量
  let currentVolume = 0;
  let lastNonZeroVolume = 50; // 存储上一次非零音量值

  // HDR状态
  let isHdrOn = false;

  // 初始化状态
  let isPlaying = false;
  let isDragging = false;
  let socket = null;
  let isConnected = false;
  let isMuted = false; // 添加静音状态标志
  let isBilibiliMode = false; // B站模式状态
  let isBilibiliHistoryMode = false; // B站历史页子模式
  let isLunaTVMode = false; // LunaTV模式状态
  let isCCTVMode = false; // 央视直播模式状态
  let isGuangdongMode = false; // 广东直播模式状态

  // 央视频道列表
  const cctvChannels = [
    { name: "CCTV-1 综合", url: "https://tv.cctv.com/live/cctv1/" },
    { name: "CCTV-2 财经", url: "https://tv.cctv.com/live/cctv2/" },
    { name: "CCTV-3 综艺", url: "https://tv.cctv.com/live/cctv3/" },
    { name: "CCTV-4 中文国际（亚）", url: "https://tv.cctv.com/live/cctv4/" },
    { name: "CCTV-5 体育", url: "https://tv.cctv.com/live/cctv5/" },
    { name: "CCTV-5+ 体育赛事", url: "https://tv.cctv.com/live/cctv5plus/" },
    { name: "CCTV-6 电影", url: "https://tv.cctv.com/live/cctv6/" },
    { name: "CCTV-7 国防军事", url: "https://tv.cctv.com/live/cctv7/" },
    { name: "CCTV-8 电视剧", url: "https://tv.cctv.com/live/cctv8/" },
    { name: "CCTV-9 纪录", url: "https://tv.cctv.com/live/cctvjilu/" },
    { name: "CCTV-10 科教", url: "https://tv.cctv.com/live/cctv10/" },
    { name: "CCTV-11 戏曲", url: "https://tv.cctv.com/live/cctv11/" },
    { name: "CCTV-12 社会与法", url: "https://tv.cctv.com/live/cctv12/" },
    { name: "CCTV-13 新闻", url: "https://tv.cctv.com/live/cctv13/" },
    { name: "CCTV-14 少儿", url: "https://tv.cctv.com/live/cctvchild/" },
    { name: "CCTV-15 音乐", url: "https://tv.cctv.com/live/cctv15/" },
    { name: "CCTV-16 奥林匹克", url: "https://tv.cctv.com/live/cctv16/" },
    { name: "CCTV-17 农业农村", url: "https://tv.cctv.com/live/cctv17/" },
    { name: "CCTV-4 中文国际（欧）", url: "https://tv.cctv.com/live/cctveurope/index.shtml" },
    { name: "CCTV-4 中文国际（美）", url: "https://tv.cctv.com/live/cctvamerica/" }
  ];

  // 广东频道列表
  const guangdongChannels = [
    { name: "广东卫视", url: "https://www.gdtv.cn/tvChannelDetail/43" },
    { name: "广东珠江", url: "https://www.gdtv.cn/tvChannelDetail/44" },
    { name: "广东新闻", url: "https://www.gdtv.cn/tvChannelDetail/45" },
    { name: "广东民生", url: "https://www.gdtv.cn/tvChannelDetail/48" },
    { name: "广东体育", url: "https://www.gdtv.cn/tvChannelDetail/47" },
    { name: "大湾区卫视", url: "https://www.gdtv.cn/tvChannelDetail/51" },
    { name: "大湾区卫视（海外版）", url: "https://www.gdtv.cn/tvChannelDetail/46" },
    { name: "广东影视", url: "https://www.gdtv.cn/tvChannelDetail/53" },
    { name: "4K超高清", url: "https://www.gdtv.cn/tvChannelDetail/16" },
    { name: "广东少儿", url: "https://www.gdtv.cn/tvChannelDetail/54" },
    { name: "嘉佳卡通", url: "https://www.gdtv.cn/tvChannelDetail/66" },
    { name: "南方购物", url: "https://www.gdtv.cn/tvChannelDetail/42" },
    { name: "岭南戏曲", url: "https://www.gdtv.cn/tvChannelDetail/15" },
    { name: "广东移动", url: "https://www.gdtv.cn/tvChannelDetail/74" },
    { name: "现代教育", url: "https://www.gdtv.cn/tvChannelDetail/111" },
    { name: "广东台经典剧", url: "https://www.gdtv.cn/tvChannelDetail/100" },
    { name: "纪录片", url: "https://www.gdtv.cn/tvChannelDetail/94" },
    { name: "GRTN健康频道", url: "https://www.gdtv.cn/tvChannelDetail/99" },
    { name: "GRTN文化频道", url: "https://www.gdtv.cn/tvChannelDetail/75" },
    { name: "GRTN生活频道", url: "https://www.gdtv.cn/tvChannelDetail/102" }
  ];

  // 更新模式标签显示
  function updateModeLabel() {
    if (!modeLabel) return;

    modeLabel.classList.remove('bilibili-active', 'lunatv-active');

    if (isBilibiliMode) {
      modeLabel.textContent = 'B站模式';
      modeLabel.classList.add('bilibili-active');
    } else if (isLunaTVMode) {
      modeLabel.textContent = 'LunaTV模式';
      modeLabel.classList.add('lunatv-active');
    } else if (isCCTVMode) {
      modeLabel.textContent = '央视直播';
    } else if (isGuangdongMode) {
      modeLabel.textContent = '广东直播';
    } else {
      modeLabel.textContent = '普通模式';
    }
  }

  // 搜索历史管理
  const SEARCH_HISTORY_KEY = 'bilibili_search_history';
  const LUNATV_HISTORY_KEY = 'lunatv_search_history';
  const ITEMS_PER_PAGE = 3;
  let currentHistoryPage = 1;
  let currentLunaTVHistoryPage = 1;

  // 获取搜索历史
  function getSearchHistory() {
    try {
      const history = localStorage.getItem(SEARCH_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (e) {
      console.error('读取搜索历史失败:', e);
      return [];
    }
  }

  // 保存搜索历史
  function saveSearchHistory(history) {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('保存搜索历史失败:', e);
    }
  }

  // 添加搜索记录
  function addSearchHistory(keyword) {
    if (!keyword || !keyword.trim()) return;

    let history = getSearchHistory();

    // 移除重复项（如果存在）
    history = history.filter(item => item !== keyword);

    // 添加到开头
    history.unshift(keyword);

    // 保存所有历史（不限制数量）
    saveSearchHistory(history);

    // 重置到第一页
    currentHistoryPage = 1;

    // 更新显示
    renderSearchHistory();
  }

  // 清空搜索历史
  function clearSearchHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    currentHistoryPage = 1;
    renderSearchHistory();
    statusText.textContent = '搜索历史已清空';
  }

  // 渲染搜索历史
  function renderSearchHistory() {
    if (!searchHistoryList) return;

    const history = getSearchHistory();

    // 如果没有历史记录，隐藏容器
    if (history.length === 0) {
      if (searchHistoryContainer) {
        searchHistoryContainer.style.display = 'none';
      }
      return;
    }

    // 显示容器
    if (searchHistoryContainer) {
      searchHistoryContainer.style.display = 'block';
    }

    // 计算分页
    const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
    const startIndex = (currentHistoryPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageHistory = history.slice(startIndex, endIndex);

    // 清空列表
    searchHistoryList.innerHTML = '';

    // 渲染当前页的历史记录
    pageHistory.forEach(keyword => {
      const item = document.createElement('div');
      item.className = 'search-history-item';
      item.innerHTML = `<i class="fas fa-history"></i><span>${keyword}</span>`;
      item.addEventListener('click', function() {
        if (bilibiliSearchInput) {
          bilibiliSearchInput.value = keyword;
        }
        // 直接触发搜索
        performSearch(keyword);
      });
      searchHistoryList.appendChild(item);
    });

    // 更新分页控制
    if (historyPagination && totalPages > 1) {
      historyPagination.style.display = 'flex';
      if (historyPageInfo) {
        historyPageInfo.textContent = `${currentHistoryPage}/${totalPages}`;
      }
      if (historyPrevBtn) {
        historyPrevBtn.disabled = currentHistoryPage === 1;
      }
      if (historyNextBtn) {
        historyNextBtn.disabled = currentHistoryPage === totalPages;
      }
    } else {
      if (historyPagination) {
        historyPagination.style.display = 'none';
      }
    }
  }

  // 执行搜索（提取为独立函数）
  function performSearch(keyword) {
    if (!keyword || !keyword.trim()) {
      statusText.textContent = '请输入搜索关键词';
      return;
    }

    if (socket && socket.connected) {
      console.log('发送B站搜索请求:', keyword);
      socket.emit('bilibili_search', { keyword: keyword });
      statusText.textContent = `搜索: ${keyword}`;

      // 添加到搜索历史
      addSearchHistory(keyword);
    } else {
      statusText.textContent = 'WebSocket未连接，无法搜索';
    }
  }

  // LunaTV搜索历史管理
  // 获取LunaTV搜索历史
  function getLunaTVSearchHistory() {
    try {
      const history = localStorage.getItem(LUNATV_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (e) {
      console.error('读取LunaTV搜索历史失败:', e);
      return [];
    }
  }

  // 保存LunaTV搜索历史
  function saveLunaTVSearchHistory(history) {
    try {
      localStorage.setItem(LUNATV_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('保存LunaTV搜索历史失败:', e);
    }
  }

  // 添加LunaTV搜索记录
  function addLunaTVSearchHistory(keyword) {
    if (!keyword || !keyword.trim()) return;

    let history = getLunaTVSearchHistory();

    // 移除重复项（如果存在）
    history = history.filter(item => item !== keyword);

    // 添加到开头
    history.unshift(keyword);

    // 保存所有历史（不限制数量）
    saveLunaTVSearchHistory(history);

    // 重置到第一页
    currentLunaTVHistoryPage = 1;

    // 更新显示
    renderLunaTVSearchHistory();
  }

  // 清空LunaTV搜索历史
  function clearLunaTVSearchHistory() {
    localStorage.removeItem(LUNATV_HISTORY_KEY);
    currentLunaTVHistoryPage = 1;
    renderLunaTVSearchHistory();
    statusText.textContent = 'LunaTV搜索历史已清空';
  }

  // 渲染LunaTV搜索历史
  function renderLunaTVSearchHistory() {
    if (!lunatvHistoryList) return;

    const history = getLunaTVSearchHistory();

    // 如果没有历史记录，隐藏容器
    if (history.length === 0) {
      if (lunatvHistoryContainer) {
        lunatvHistoryContainer.style.display = 'none';
      }
      return;
    }

    // 显示容器
    if (lunatvHistoryContainer) {
      lunatvHistoryContainer.style.display = 'block';
    }

    // 计算分页
    const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
    const startIndex = (currentLunaTVHistoryPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageHistory = history.slice(startIndex, endIndex);

    // 清空列表
    lunatvHistoryList.innerHTML = '';

    // 渲染当前页的历史记录
    pageHistory.forEach(keyword => {
      const item = document.createElement('div');
      item.className = 'lunatv-history-item';
      item.innerHTML = `<i class="fas fa-history"></i><span>${keyword}</span>`;
      item.addEventListener('click', function() {
        if (lunatvSearchInput) {
          lunatvSearchInput.value = keyword;
        }
        // 直接触发搜索
        performLunaTVSearch(keyword);
      });
      lunatvHistoryList.appendChild(item);
    });

    // 更新分页控制
    if (lunatvHistoryPagination && totalPages > 1) {
      lunatvHistoryPagination.style.display = 'flex';
      if (lunatvHistoryPageInfo) {
        lunatvHistoryPageInfo.textContent = `${currentLunaTVHistoryPage}/${totalPages}`;
      }
      if (lunatvHistoryPrevBtn) {
        lunatvHistoryPrevBtn.disabled = currentLunaTVHistoryPage === 1;
      }
      if (lunatvHistoryNextBtn) {
        lunatvHistoryNextBtn.disabled = currentLunaTVHistoryPage === totalPages;
      }
    } else {
      if (lunatvHistoryPagination) {
        lunatvHistoryPagination.style.display = 'none';
      }
    }
  }

  // 执行LunaTV搜索（提取为独立函数）
  function performLunaTVSearch(keyword) {
    if (!keyword || !keyword.trim()) {
      statusText.textContent = '请输入搜索关键词';
      return;
    }

    if (socket && socket.connected) {
      console.log('发送LunaTV搜索请求:', keyword);
      socket.emit('lunatv_search', { keyword: keyword });
      statusText.textContent = `LunaTV搜索: ${keyword}`;

      // 添加到搜索历史
      addLunaTVSearchHistory(keyword);
    } else {
      statusText.textContent = 'WebSocket未连接，无法搜索';
    }
  }


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
    // 添加空值检查，防止因为找不到元素而报错
    if (playPauseBtn) playPauseBtn.disabled = !enable;
    if (arrowUpBtn) arrowUpBtn.disabled = !enable;
    if (arrowDownBtn) arrowDownBtn.disabled = !enable;
    if (arrowLeftBtn) arrowLeftBtn.disabled = !enable;
    if (arrowRightBtn) arrowRightBtn.disabled = !enable;
    if (fKeyBtn) fKeyBtn.disabled = !enable;
    if (spaceBtn) spaceBtn.disabled = !enable;
    if (backBtn) backBtn.disabled = !enable;
    if (volumeDownBtn) volumeDownBtn.disabled = !enable;
    if (volumeUpBtn) volumeUpBtn.disabled = !enable;
    if (cctvliveBtn) cctvliveBtn.disabled = !enable;
    if (guangdongLiveBtn) guangdongLiveBtn.disabled = !enable;
    if (bilibiliBtn) bilibiliBtn.disabled = !enable;
    if (lunaTvBtn) lunaTvBtn.disabled = !enable;
    if (bilibiliSearchInput) bilibiliSearchInput.disabled = !enable;
    if (bilibiliSearchBtn) bilibiliSearchBtn.disabled = !enable;
    if (bilibiliHistoryBtn) bilibiliHistoryBtn.disabled = !enable;
    if (bilibiliFavoritesBtn) bilibiliFavoritesBtn.disabled = !enable;
    if (lunatvSearchInput) lunatvSearchInput.disabled = !enable;
    if (lunatvSearchBtn) lunatvSearchBtn.disabled = !enable;
    if (lunatvTabEpisodeBtn) lunatvTabEpisodeBtn.disabled = !enable;
    if (lunatvTabSourceBtn) lunatvTabSourceBtn.disabled = !enable;
    // 央视频道按钮
    if (cctvChannelsGrid) {
      const channelBtns = cctvChannelsGrid.querySelectorAll('.cctv-channel-btn');
      channelBtns.forEach(btn => btn.disabled = !enable);
    }
    // 广东频道按钮
    if (guangdongChannelsGrid) {
      const channelBtns = guangdongChannelsGrid.querySelectorAll('.guangdong-channel-btn');
      channelBtns.forEach(btn => btn.disabled = !enable);
    }
    if (muteBtn) muteBtn.disabled = !enable;
    if (toggleHdrBtn) toggleHdrBtn.disabled = !enable; // 添加HDR按钮

    // 唤醒按钮不再根据唤醒状态禁用，只根据连接状态
    if (wakeScreenBtn) wakeScreenBtn.disabled = !enable;
  }

  // 更新播放/暂停按钮状态
  function updatePlayPauseButton() {
    if (!playPauseBtn) return; // 添加空值检查

    if (isPlaying) {
      playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      playPauseBtn.setAttribute('aria-label', '暂停');
    } else {
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      playPauseBtn.setAttribute('aria-label', '播放');
    }
  }

  // 更新HDR按钮状态
  function updateHdrButton() {
    if (!toggleHdrBtn) return; // 添加空值检查

    if (isHdrOn) {
      toggleHdrBtn.innerHTML = '<i class="fas fa-adjust"></i> HDR: 开';
      toggleHdrBtn.classList.add('active');
    } else {
      toggleHdrBtn.innerHTML = '<i class="fas fa-adjust"></i> HDR: 关';
      toggleHdrBtn.classList.remove('active');
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
        updateModeLabel(); // 初始化模式标签显示

        // 启用按钮
        enableButtons(true);

        // 请求初始状态
        socket.emit('get_status');

        // 显示音量控制
        if (volumeContainer) {
          volumeContainer.classList.remove('hidden');
        }

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
        if (volumeContainer) {
          volumeContainer.classList.add('hidden');
        }
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

      // 监听模式状态更新（由油猴脚本回传）
      socket.on('mode_update', function (data) {
        const mode = data.mode;
        console.log('收到模式更新:', mode);

        // 更新模式状态
        if (mode === 'bilibili') {
          isBilibiliMode = true;
          isLunaTVMode = false;
          isCCTVMode = false;
          isGuangdongMode = false;
        } else if (mode === 'lunatv') {
          isBilibiliMode = false;
          isLunaTVMode = true;
          isCCTVMode = false;
          isGuangdongMode = false;
        } else if (mode === 'cctv') {
          isBilibiliMode = false;
          isLunaTVMode = false;
          isCCTVMode = true;
          isGuangdongMode = false;
        } else if (mode === 'guangdong') {
          isBilibiliMode = false;
          isLunaTVMode = false;
          isCCTVMode = false;
          isGuangdongMode = true;
        } else {
          isBilibiliMode = false;
          isLunaTVMode = false;
          isCCTVMode = false;
          isGuangdongMode = false;
        }

        // 更新UI
        const controlsCard = document.querySelector('.controls-card');
        if (controlsCard) {
          controlsCard.classList.remove('bilibili-mode-active', 'lunatv-mode-active');
          if (isBilibiliMode) {
            controlsCard.classList.add('bilibili-mode-active');
            if (bilibiliSearchContainer) bilibiliSearchContainer.style.display = 'block';
            if (lunatvSearchContainer) lunatvSearchContainer.style.display = 'none';
            if (cctvChannelsContainer) cctvChannelsContainer.style.display = 'none';
            if (guangdongChannelsContainer) guangdongChannelsContainer.style.display = 'none';
            if (backBtn) backBtn.style.display = 'inline-flex';
          } else if (isLunaTVMode) {
            controlsCard.classList.add('lunatv-mode-active');
            if (bilibiliSearchContainer) bilibiliSearchContainer.style.display = 'none';
            if (lunatvSearchContainer) lunatvSearchContainer.style.display = 'block';
            if (cctvChannelsContainer) cctvChannelsContainer.style.display = 'none';
            if (guangdongChannelsContainer) guangdongChannelsContainer.style.display = 'none';
            if (backBtn) backBtn.style.display = 'inline-flex';
          } else if (isCCTVMode) {
            // 央视模式：显示央视频道列表
            if (bilibiliSearchContainer) bilibiliSearchContainer.style.display = 'none';
            if (lunatvSearchContainer) lunatvSearchContainer.style.display = 'none';
            if (cctvChannelsContainer) cctvChannelsContainer.style.display = 'block';
            if (guangdongChannelsContainer) guangdongChannelsContainer.style.display = 'none';
            if (backBtn) backBtn.style.display = 'none';
          } else if (isGuangdongMode) {
            // 广东模式：显示广东频道列表
            if (bilibiliSearchContainer) bilibiliSearchContainer.style.display = 'none';
            if (lunatvSearchContainer) lunatvSearchContainer.style.display = 'none';
            if (cctvChannelsContainer) cctvChannelsContainer.style.display = 'none';
            if (guangdongChannelsContainer) guangdongChannelsContainer.style.display = 'block';
            if (backBtn) backBtn.style.display = 'none';
          } else {
            // 普通模式
            if (bilibiliSearchContainer) bilibiliSearchContainer.style.display = 'none';
            if (lunatvSearchContainer) lunatvSearchContainer.style.display = 'none';
            if (cctvChannelsContainer) cctvChannelsContainer.style.display = 'none';
            if (guangdongChannelsContainer) guangdongChannelsContainer.style.display = 'none';
            if (backBtn) backBtn.style.display = 'none';
          }
        }

        // 更新标签显示
        updateModeLabel();
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

        // 更新HDR状态
        if (data.hdr_status !== undefined) {
          isHdrOn = data.hdr_status;
          updateHdrButton();
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



      // 屏幕唤醒响应
      socket.on('wake_screen_response', function (data) {
        if (data.success) {
          // 如果是自动触发的，显示不同的消息
          if (data.auto_triggered) {
            statusText.textContent = "已自动唤醒屏幕";
          } else {
            statusText.textContent = data.message;
          }
        } else {
          statusText.textContent = `屏幕唤醒失败: ${data.error || '未知错误'}`;
        }
      });

      // HDR状态更新
      socket.on('hdr_status_update', function (data) {
        isHdrOn = data.is_on;
        updateHdrButton();
        statusText.textContent = `HDR已${isHdrOn ? '开启' : '关闭'}`;
      });

      // HDR切换响应
      socket.on('hdr_toggle_response', function (data) {
        if (data.success) {
          isHdrOn = data.is_on;
          updateHdrButton();
          statusText.textContent = data.message;
        } else {
          statusText.textContent = `HDR切换失败: ${data.message || '未知错误'}`;
        }
      });

      // B站搜索响应
      socket.on('bilibili_search_response', function (data) {
        console.log('收到B站搜索响应:', data);
        if (data.success) {
          statusText.textContent = data.message || `B站搜索成功: ${data.keyword}`;
          // 清空搜索框
          if (bilibiliSearchInput) {
            bilibiliSearchInput.value = '';
          }
        } else {
          statusText.textContent = `B站搜索失败: ${data.message || '未知错误'}`;
        }
      });

      socket.on('lunatv_search_response', function (data) {
        console.log('收到LunaTV搜索响应:', data);
        if (data.success) {
          statusText.textContent = data.message || `LunaTV搜索成功: ${data.keyword}`;
          // 清空搜索框
          if (lunatvSearchInput) {
            lunatvSearchInput.value = '';
          }
        } else {
          statusText.textContent = `LunaTV搜索失败: ${data.message || '未知错误'}`;
        }
      });

      // B站子模式更新（例如进入历史页）
      socket.on('bilibili_sub_mode_update', function (data) {
        isBilibiliHistoryMode = (data.sub_mode === 'history');
        console.log('B站子模式:', data.sub_mode);
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
        wsCheckInterval = setInterval(checkWebSocketConnection, 500);
      }
    }
  });

  // 播放/暂停按钮
  if (playPauseBtn) {
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
  }

  // 方向键上
  if (arrowUpBtn) {
    arrowUpBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        if (isLunaTVMode) {
          socket.emit('lunatv_navigate', { direction: 'up' });
          statusText.textContent = 'LunaTV: 上';
        } else if (isBilibiliMode && isBilibiliHistoryMode) {
          socket.emit('bilibili_history_navigate', { direction: 'up' });
          statusText.textContent = 'B站历史: 上';
        } else {
          socket.emit('key_press', { direction: 'up' });
          statusText.textContent = '发送方向上键命令';
        }
      } else {
        statusText.textContent = 'WebSocket未连接，无法发送命令';
      }
    });
  }

  // 方向键下
  if (arrowDownBtn) {
    arrowDownBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        if (isLunaTVMode) {
          socket.emit('lunatv_navigate', { direction: 'down' });
          statusText.textContent = 'LunaTV: 下';
        } else if (isBilibiliMode && isBilibiliHistoryMode) {
          socket.emit('bilibili_history_navigate', { direction: 'down' });
          statusText.textContent = 'B站历史: 下';
        } else {
          socket.emit('key_press', { direction: 'down' });
          statusText.textContent = '发送方向下键命令';
        }
      } else {
        statusText.textContent = 'WebSocket未连接，无法发送命令';
      }
    });
  }

  // 方向键左
  if (arrowLeftBtn) {
    arrowLeftBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        if (isLunaTVMode) {
          socket.emit('lunatv_navigate', { direction: 'left' });
          statusText.textContent = 'LunaTV: 左';
        } else {
          socket.emit('key_press', { direction: 'left' });
          statusText.textContent = '发送方向左键命令';
        }
      } else {
        statusText.textContent = 'WebSocket未连接，无法发送命令';
      }
    });
  }

  // 方向键右
  if (arrowRightBtn) {
    arrowRightBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        if (isLunaTVMode) {
          socket.emit('lunatv_navigate', { direction: 'right' });
          statusText.textContent = 'LunaTV: 右';
        } else {
          socket.emit('key_press', { direction: 'right' });
          statusText.textContent = '发送方向右键命令';
        }
      } else {
        statusText.textContent = 'WebSocket未连接，无法发送命令';
      }
    });
  }

  // 确认键 (F)
  if (fKeyBtn) {
    fKeyBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        socket.emit('key_press', { direction: 'f' });
        statusText.textContent = '发送全屏命令';
      } else {
        statusText.textContent = 'WebSocket未连接，无法发送命令';
      }
    });
  }

  // 空格键/Enter键（根据B站模式切换）
  if (spaceBtn) {
    spaceBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        if (isBilibiliMode && isBilibiliHistoryMode) {
          // B站历史模式：点击选中项
          socket.emit('bilibili_history_navigate', { direction: 'click' });
          statusText.textContent = '打开历史记录';
        } else if (isBilibiliMode) {
          // B站模式：发送 Enter 键
          socket.emit('key_press', { direction: 'enter' });
          statusText.textContent = '发送Enter键命令';
        } else if (isLunaTVMode) {
          // LunaTV模式：发送点击命令
          socket.emit('lunatv_click');
          statusText.textContent = '发送点击命令';
        } else {
          // 普通模式：发送空格键
          socket.emit('play_pause');
          statusText.textContent = '发送空格键命令';
        }
      } else {
        statusText.textContent = 'WebSocket未连接，无法发送命令';
      }
    });
  }

  // 首页按钮（根据模式决定跳转目标）
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        if (isLunaTVMode) {
          socket.emit('lunatv_home');
          statusText.textContent = '跳转LunaTV首页';
        } else {
          socket.emit('bilibili_home');
          statusText.textContent = '跳转B站首页';
        }
      } else {
        statusText.textContent = 'WebSocket未连接，无法跳转';
      }
    });
  }

  // 音量减
  if (volumeDownBtn) {
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
  }

  // 音量加
  if (volumeUpBtn) {
    volumeUpBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        socket.emit('volume_control', { direction: 'up' });
        statusText.textContent = '增大音量';
      } else {
        statusText.textContent = 'WebSocket未连接，无法控制音量';
      }
    });
  }

  // 静音按钮
  if (muteBtn) {
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
  }

  // cctv 直播
  if (cctvliveBtn) {
    cctvliveBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        socket.emit('switch_cctv_live');
        statusText.textContent = '切换到中央直播';
      } else {
        statusText.textContent = 'WebSocket未连接，无法切换桌面';
      }
    });
  }

  if (guangdongLiveBtn) {
    guangdongLiveBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        socket.emit('switch_guangdong_live');
        statusText.textContent = '切换到广东直播';
      } else {
        statusText.textContent = 'WebSocket未连接，无法切换桌面';
      }
    });
  }

  // 哔哩哔哩按钮 - 只发送命令，模式由油猴脚本回传
  if (bilibiliBtn) {
    bilibiliBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        socket.emit('switch_bilibili');
        statusText.textContent = '切换到哔哩哔哩';
      } else {
        statusText.textContent = 'WebSocket未连接，无法切换';
      }
    });
  }

  // LunaTV 按钮 - 只发送命令，模式由油猴脚本回传
  if (lunaTvBtn) {
    lunaTvBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        socket.emit('lunatv_home');
        statusText.textContent = '跳转到 LunaTV';
      } else {
        statusText.textContent = 'WebSocket未连接，无法跳转';
      }
    });
  }

  // B站搜索按钮
  if (bilibiliSearchBtn) {
    bilibiliSearchBtn.addEventListener('click', function () {
      const keyword = bilibiliSearchInput ? bilibiliSearchInput.value.trim() : '';
      performSearch(keyword);
    });
  }

  // 支持搜索框回车键
  if (bilibiliSearchInput) {
    bilibiliSearchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        const keyword = bilibiliSearchInput.value.trim();
        performSearch(keyword);
      }
    });
  }

  // LunaTV搜索按钮
  if (lunatvSearchBtn) {
    lunatvSearchBtn.addEventListener('click', function () {
      const keyword = lunatvSearchInput ? lunatvSearchInput.value.trim() : '';
      performLunaTVSearch(keyword);
    });
  }

  // LunaTV搜索框支持回车键
  if (lunatvSearchInput) {
    lunatvSearchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        const keyword = lunatvSearchInput.value.trim();
        performLunaTVSearch(keyword);
      }
    });
  }

  // 清空LunaTV搜索历史按钮
  if (lunatvClearHistoryBtn) {
    lunatvClearHistoryBtn.addEventListener('click', function() {
      if (confirm('确定要清空所有LunaTV搜索历史吗？')) {
        clearLunaTVSearchHistory();
      }
    });
  }

  // LunaTV历史记录翻页按钮
  if (lunatvHistoryPrevBtn) {
    lunatvHistoryPrevBtn.addEventListener('click', function() {
      if (currentLunaTVHistoryPage > 1) {
        currentLunaTVHistoryPage--;
        renderLunaTVSearchHistory();
      }
    });
  }

  if (lunatvHistoryNextBtn) {
    lunatvHistoryNextBtn.addEventListener('click', function() {
      const history = getLunaTVSearchHistory();
      const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
      if (currentLunaTVHistoryPage < totalPages) {
        currentLunaTVHistoryPage++;
        renderLunaTVSearchHistory();
      }
    });
  }

  // 清空搜索历史按钮
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', function() {
      if (confirm('确定要清空所有搜索历史吗？')) {
        clearSearchHistory();
      }
    });
  }

  // 历史记录翻页按钮
  if (historyPrevBtn) {
    historyPrevBtn.addEventListener('click', function() {
      if (currentHistoryPage > 1) {
        currentHistoryPage--;
        renderSearchHistory();
      }
    });
  }

  if (historyNextBtn) {
    historyNextBtn.addEventListener('click', function() {
      const history = getSearchHistory();
      const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
      if (currentHistoryPage < totalPages) {
        currentHistoryPage++;
        renderSearchHistory();
      }
    });
  }



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


  // 屏幕唤醒按钮 - 修改为发送~
  if (wakeScreenBtn) {
    wakeScreenBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        // 发送～到ESP32
        socket.emit('send_esp32_key', { key_code: "FLAG" });
        statusText.textContent = '已发送~到ESP32';
      } else {
        statusText.textContent = 'WebSocket未连接，无法发送~';
      }
    });
  }

  // HDR切换按钮
  if (toggleHdrBtn) {
    toggleHdrBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        socket.emit('toggle_hdr');
        statusText.textContent = '正在切换HDR状态...';
      } else {
        statusText.textContent = 'WebSocket未连接，无法切换HDR';
      }
    });
  }

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
  if (sleepButton) {
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
  }

  // B站观看历史按钮
  if (bilibiliHistoryBtn) {
    bilibiliHistoryBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        socket.emit('bilibili_history');
        statusText.textContent = '跳转B站观看历史';
      }
    });
  }

  // B站我的收藏按钮
  if (bilibiliFavoritesBtn) {
    bilibiliFavoritesBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        socket.emit('bilibili_favorites');
        statusText.textContent = '跳转B站我的收藏';
      }
    });
  }

  // LunaTV 选集/换源 Tab按钮
  if (lunatvTabEpisodeBtn) {
    lunatvTabEpisodeBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        socket.emit('lunatv_tab', { tab: '选集' });
      }
    });
  }

  if (lunatvTabSourceBtn) {
    lunatvTabSourceBtn.addEventListener('click', function () {
      if (socket && socket.connected) {
        socket.emit('lunatv_tab', { tab: '换源' });
      }
    });
  }

  // 初始化渲染搜索历史
  renderSearchHistory();
  renderLunaTVSearchHistory();

  // 初始化央视频道按钮
  function initCCTVChannels() {
    if (!cctvChannelsGrid) return;

    cctvChannelsGrid.innerHTML = '';
    cctvChannels.forEach(channel => {
      const btn = document.createElement('button');
      btn.className = 'cctv-channel-btn';
      btn.textContent = channel.name;
      btn.disabled = true;
      btn.addEventListener('click', function() {
        if (socket && socket.connected) {
          socket.emit('cctv_channel', { url: channel.url, name: channel.name });
          statusText.textContent = `切换到 ${channel.name}`;
        }
      });
      cctvChannelsGrid.appendChild(btn);
    });
  }

  initCCTVChannels();

  // 初始化广东频道按钮
  function initGuangdongChannels() {
    if (!guangdongChannelsGrid) return;

    guangdongChannelsGrid.innerHTML = '';
    guangdongChannels.forEach(channel => {
      const btn = document.createElement('button');
      btn.className = 'guangdong-channel-btn';
      btn.textContent = channel.name;
      btn.disabled = true;
      btn.addEventListener('click', function() {
        if (socket && socket.connected) {
          socket.emit('guangdong_channel', { url: channel.url, name: channel.name });
          statusText.textContent = `切换到 ${channel.name}`;
        }
      });
      guangdongChannelsGrid.appendChild(btn);
    });
  }

  initGuangdongChannels();

  // 频道列表展开/收缩功能
  const CCTV_COLLAPSED_KEY = 'cctvChannelsCollapsed';
  const GUANGDONG_COLLAPSED_KEY = 'guangdongChannelsCollapsed';

  // 恢复央视频道展开/收缩状态
  function restoreCCTVCollapseState() {
    const isCollapsed = localStorage.getItem(CCTV_COLLAPSED_KEY) === 'true';
    if (isCollapsed && cctvChannelsGrid && cctvToggleBtn) {
      cctvChannelsGrid.classList.add('collapsed');
      cctvToggleBtn.classList.add('collapsed');
    }
  }

  // 恢复广东频道展开/收缩状态
  function restoreGuangdongCollapseState() {
    const isCollapsed = localStorage.getItem(GUANGDONG_COLLAPSED_KEY) === 'true';
    if (isCollapsed && guangdongChannelsGrid && guangdongToggleBtn) {
      guangdongChannelsGrid.classList.add('collapsed');
      guangdongToggleBtn.classList.add('collapsed');
    }
  }

  // 切换央视频道展开/收缩
  function toggleCCTVChannels() {
    if (!cctvChannelsGrid || !cctvToggleBtn) return;

    const isCollapsed = cctvChannelsGrid.classList.toggle('collapsed');
    cctvToggleBtn.classList.toggle('collapsed');
    localStorage.setItem(CCTV_COLLAPSED_KEY, isCollapsed);
  }

  // 切换广东频道展开/收缩
  function toggleGuangdongChannels() {
    if (!guangdongChannelsGrid || !guangdongToggleBtn) return;

    const isCollapsed = guangdongChannelsGrid.classList.toggle('collapsed');
    guangdongToggleBtn.classList.toggle('collapsed');
    localStorage.setItem(GUANGDONG_COLLAPSED_KEY, isCollapsed);
  }

  // 绑定事件监听器 - 整个标题都可以点击
  if (cctvChannelsTitle) {
    cctvChannelsTitle.addEventListener('click', toggleCCTVChannels);
    cctvChannelsTitle.style.cursor = 'pointer';
  }

  if (guangdongChannelsTitle) {
    guangdongChannelsTitle.addEventListener('click', toggleGuangdongChannels);
    guangdongChannelsTitle.style.cursor = 'pointer';
  }

  // 恢复状态
  restoreCCTVCollapseState();
  restoreGuangdongCollapseState();
});