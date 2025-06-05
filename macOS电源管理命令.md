# macOS电源管理命令指南

## 查看当前电源设置

查看所有当前电源设置：
```bash
pmset -g
```

查看详细的自定义电源设置：
```bash
pmset -g custom
```

## pmset -g custom 输出解释

`pmset -g custom` 命令输出当前系统的所有电源管理设置，分为电池供电模式(Battery Power)和交流电源模式(AC Power)两部分。以下是各参数的详细解释：

### 常见参数解释

| 参数 | 说明 |
|------|------|
| Sleep On Power Button | 是否可以通过电源按钮使系统睡眠（1=启用，0=禁用） |
| lowpowermode | 低电量模式（1=启用，0=禁用） |
| standby | 待机模式（1=启用，0=禁用） |
| ttyskeepawake | 终端活动是否阻止系统睡眠（1=启用，0=禁用） |
| hibernatemode | 休眠模式（0=仅内存，3=内存+硬盘，25=仅硬盘） |
| powernap | 电源小憩功能（1=启用，0=禁用） |
| hibernatefile | 休眠文件的存储位置 |
| displaysleep | 显示器睡眠前的空闲时间（分钟） |
| womp | 网络唤醒功能（1=启用，0=禁用） |
| networkoversleep | 网络访问是否阻止系统睡眠（1=启用，0=禁用） |
| sleep | 系统睡眠前的空闲时间（分钟） |
| lessbright | 使用电池时是否降低亮度（1=启用，0=禁用） |
| tcpkeepalive | TCP连接保持活动（1=启用，0=禁用） |
| disksleep | 硬盘睡眠前的空闲时间（分钟） |

### 示例输出解释

以下是一个实际输出示例的解释：

```
Battery Power:
 Sleep On Power Button 1    # 可以通过电源按钮使系统睡眠
 lowpowermode         0     # 低电量模式关闭
 standby              1     # 待机模式开启
 ttyskeepawake        0     # 终端活动不会阻止系统睡眠
 hibernatemode        0     # 使用内存休眠模式（快速唤醒，耗电量大）
 powernap             1     # 电源小憩功能开启
 hibernatefile        /var/vm/sleepimage  # 休眠文件存储位置
 displaysleep         1     # 1分钟后显示器睡眠
 womp                 0     # 网络唤醒功能关闭
 networkoversleep     0     # 网络活动不会阻止系统睡眠
 sleep                1     # 1分钟后系统睡眠
 lessbright           1     # 使用电池时降低亮度
 tcpkeepalive         1     # TCP连接保持活动
 disksleep            1     # 1分钟后硬盘睡眠

AC Power:
 Sleep On Power Button 1    # 可以通过电源按钮使系统睡眠
 lowpowermode         0     # 低电量模式关闭
 standby              1     # 待机模式开启
 ttyskeepawake        1     # 终端活动会阻止系统睡眠
 hibernatemode        0     # 使用内存休眠模式（快速唤醒）
 powernap             1     # 电源小憩功能开启
 hibernatefile        /var/vm/sleepimage  # 休眠文件存储位置
 displaysleep         10    # 10分钟后显示器睡眠
 womp                 1     # 网络唤醒功能开启
 networkoversleep     0     # 网络活动不会阻止系统睡眠
 sleep                1     # 1分钟后系统睡眠
 tcpkeepalive         1     # TCP连接保持活动
 disksleep            10    # 10分钟后硬盘睡眠
```

### 主要区别分析

从上面的示例可以看出电池模式和交流电源模式的主要区别：

1. **ttyskeepawake**：接通电源时，终端活动会阻止系统睡眠；使用电池时不会
2. **displaysleep**：接通电源时，显示器10分钟后睡眠；使用电池时1分钟后睡眠
3. **womp**：接通电源时，网络唤醒功能开启；使用电池时关闭
4. **disksleep**：接通电源时，硬盘10分钟后睡眠；使用电池时1分钟后睡眠
5. **lessbright**：仅在电池模式下有此设置，用于降低屏幕亮度以节省电量

## 休眠模式设置

### 设置休眠模式

macOS支持三种主要的休眠模式：

| hibernatemode值 | 描述 |
|----------------|------|
| 0 | 持续向内存供电，将数据保留在内存（响应速度快，耗电量大） |
| 3 | 自动模式，数据既写入内存又写入硬盘（唤醒时，根据设备电量自动选择从内存/硬盘恢复） |
| 25 | 不向内存供电，将内存镜像直接写入硬盘（响应速度慢，耗电量少） |

### 分别设置充电模式和电池模式

#### 电池模式设置
```bash
sudo pmset -b hibernatemode <值>
```

#### 充电模式设置
```bash
sudo pmset -c hibernatemode <值>
```

#### 同时设置所有电源模式
```bash
sudo pmset -a hibernatemode <值>
```

### 常用设置示例

设置电池模式为完全休眠（省电）：
```bash
sudo pmset -b hibernatemode 25
```

设置充电模式为内存保持（快速唤醒）：
```bash
sudo pmset -c hibernatemode 0
```

设置所有模式为自动模式：
```bash
sudo pmset -a hibernatemode 3
```

## 其他常用电源设置

### 显示器睡眠时间设置

设置电池模式下显示器多少分钟后睡眠：
```bash
sudo pmset -b displaysleep <分钟>
```

设置充电模式下显示器多少分钟后睡眠：
```bash
sudo pmset -c displaysleep <分钟>
```

### 系统睡眠时间设置

设置电池模式下系统多少分钟后睡眠：
```bash
sudo pmset -b sleep <分钟>
```

设置充电模式下系统多少分钟后睡眠：
```bash
sudo pmset -c sleep <分钟>
```

### 硬盘睡眠时间设置

设置电池模式下硬盘多少分钟后睡眠：
```bash
sudo pmset -b disksleep <分钟>
```

设置充电模式下硬盘多少分钟后睡眠：
```bash
sudo pmset -c disksleep <分钟>
```

## 恢复默认设置

恢复所有电源管理设置为系统默认值：
```bash
sudo pmset restoredefaults
```

## 其他有用的设置

### 盒盖唤醒设置
```bash
sudo pmset -a lidwake 1  # 启用
sudo pmset -a lidwake 0  # 禁用
```

### 自动关机设置
```bash
sudo pmset -a autopoweroff 1  # 启用
sudo pmset -a autopoweroff 0  # 禁用
```

### 网络唤醒设置（仅适用于充电模式）
```bash
sudo pmset -c womp 1  # 启用
sudo pmset -c womp 0  # 禁用
```

## 注意事项

1. 所有使用`sudo`的命令都需要管理员权限
2. 更改休眠模式可能会影响系统性能和电池寿命
3. 某些设置在特定Mac型号上可能不可用或行为不同
4. 建议在更改设置前先记录原始设置 