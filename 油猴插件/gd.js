// ==UserScript==
// @name         通用视频快捷键 (空格播放/暂停, 荔枝网适配)
// @name:en      Universal Video Hotkeys (Space to Play/Pause, gdtv.cn specific)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  使用空格键方便地播放或暂停任何网页上的HTML5视频。在荔枝网(gdtv.cn)上，额外支持'f'键全屏和上下箭头切换频道。
// @description:en Conveniently play/pause HTML5 videos on any page with the spacebar. Adds 'f' for fullscreen and Arrow Up/Down for channel switching on gdtv.cn.
// @author       Gemini
// @match        *://*/*
// @match        https://www.gdtv.cn/tvChannelDetail/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
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

  window.addEventListener('keydown', function(e) {
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
              break;
      }
  }, true); // 使用捕获阶段以确保能优先处理事件

})();