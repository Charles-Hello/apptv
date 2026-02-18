# B站模式按钮优化说明

## 修改内容

### 1. **隐藏播放按钮**
在 B 站模式下，播放/暂停按钮会自动隐藏，因为 B 站界面有自己的播放控制。

### 2. **空格按钮变为 Enter 按钮**
- **普通模式**：空格按钮显示空格图标，点击发送空格键（播放/暂停）
- **B 站模式**：空格按钮显示 "ENTER" 文字，点击发送 Enter 键（确认选择）

## UI 变化对比

### 普通模式（B站模式关闭）
```
┌────────────────────┐
│  ▲                 │
│◀ ⊕ ▶   【▶】      │  ← 播放按钮
│  ▼     【⎵】       │  ← 空格按钮（空格键）
└────────────────────┘
```

### B站模式（B站模式开启）
```
┌────────────────────┐
│  ▲                 │
│◀ ⊕ ▶              │  ← 播放按钮已隐藏
│  ▼     【ENTER】   │  ← Enter按钮（回车键）
└────────────────────┘
```

## 功能说明

### Enter 键的作用
在 B 站界面中，Enter 键主要用于：
- ✅ 确认选中的搜索结果
- ✅ 在搜索框中提交搜索
- ✅ 确认选择的视频并播放
- ✅ 在各种弹窗中确认操作

## 技术实现

### 1. HTML 修改 (index.html)
```html
<!-- 空格/Enter按钮 -->
<button id="space-btn" class="media-button" disabled aria-label="空格键">
  <!-- 默认显示空格键图标 -->
  <svg id="space-icon" width="24" height="14">...</svg>
  <!-- B站模式显示Enter文字 -->
  <span id="enter-text" style="display: none;">ENTER</span>
</button>
```

### 2. CSS 修改 (styles.css)
```css
/* B站模式下隐藏播放按钮 */
.bilibili-mode-active .video-controls-side .media-button#play-pause-btn {
    display: none;
}

/* B站模式下切换到Enter显示 */
.bilibili-mode-active #space-btn #space-icon {
    display: none;
}

.bilibili-mode-active #space-btn #enter-text {
    display: inline !important;
}
```

### 3. JavaScript 修改 (script.js)
```javascript
// 空格键/Enter键（根据B站模式切换）
spaceBtn.addEventListener('click', function () {
  if (isBilibiliMode) {
    // B站模式：发送 Enter 键
    socket.emit('key_press', { direction: 'enter' });
  } else {
    // 普通模式：发送空格键
    socket.emit('play_pause');
  }
});
```

### 4. Server 端修改 (main.py)
```python
# 添加 Enter 键支持
key_codes = {
    "up": 126,
    "down": 125,
    "left": 123,
    "right": 124,
    "space": 49,
    "f": 3,
    "enter": 36  # Enter键（回车键）
}
```

## 使用场景

### 场景 1：搜索 B 站内容
1. 打开 B 站模式
2. 在搜索框输入关键词
3. 点击搜索按钮（或按回车）
4. 浏览器跳转到搜索结果页
5. 使用方向键选择视频
6. **点击 Enter 按钮**确认选择并播放

### 场景 2：浏览 B 站首页
1. 打开 B 站模式
2. 使用方向键浏览视频卡片
3. **点击 Enter 按钮**确认选择
4. 视频开始播放

### 场景 3：视频播放控制
- **普通模式**：点击空格按钮 → 播放/暂停视频
- **B 站模式**：使用 B 站自带的播放控制（或键盘空格键）

## 测试检查表

### ✅ 普通模式测试
- [ ] 播放按钮显示
- [ ] 空格按钮显示空格图标
- [ ] 点击空格按钮发送空格键
- [ ] aria-label 为 "空格键"

### ✅ B 站模式测试
- [ ] 播放按钮隐藏
- [ ] 空格按钮显示 "ENTER" 文字
- [ ] 点击 Enter 按钮发送 Enter 键
- [ ] aria-label 为 "Enter键"

### ✅ 模式切换测试
- [ ] 关闭 B 站模式 → 恢复播放按钮和空格图标
- [ ] 打开 B 站模式 → 隐藏播放按钮，显示 Enter 文字

### ✅ 功能测试（在 B 站界面）
- [ ] Enter 键可以确认选择
- [ ] Enter 键可以提交搜索
- [ ] Enter 键在弹窗中正常工作

## macOS 键码参考

| 按键 | 键码 | 说明 |
|------|------|------|
| Enter | 36 | 回车键 |
| Space | 49 | 空格键 |
| F | 3 | F 键 |
| ↑ | 126 | 上箭头 |
| ↓ | 125 | 下箭头 |
| ← | 123 | 左箭头 |
| → | 124 | 右箭头 |

## 注意事项

1. ⚠️ Enter 按钮只在 B 站模式下生效
2. ⚠️ 普通模式下仍然是空格键功能
3. ⚠️ 播放按钮在 B 站模式下完全隐藏
4. ⚠️ B 站视频播放控制建议使用 B 站自带的界面操作

## 优势

- 🎯 **更符合 B 站使用习惯**：Enter 键是确认选择的标准按键
- 🎨 **界面更简洁**：隐藏不需要的播放按钮
- 🔄 **智能切换**：根据模式自动调整按钮功能
- ♿ **无障碍支持**：正确的 aria-label 标签
