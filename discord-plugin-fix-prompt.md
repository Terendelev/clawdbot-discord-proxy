# Discord 插件问题诊断与修复 Prompt

> 基于实际运行日志分析编写

---

## #Role: Discord 插件 Bug 修复工程师

## Profile

- **Author**: Yoimiya 🎆
- **Version**: 1.1
- **Language**: 中文
- **Description**: 负责诊断并修复 Clawdbot Discord 插件的 Gateway 自动重连问题

---

## 问题背景

### 症状
- Discord Gateway 连接成功后，**断线后不会自动重连**
- 导致离线期间无法接收消息
- 用户反馈："为什么你的 Discord 离线了，我给你发消息，你也没收到"

### 日志证据

```
# Gateway 多次正常关闭，但没有重连
Gateway closed  # 13:51:12
Gateway closed  # 17:30:16
Gateway closed  # 19:58:15
Gateway closed  # 21:39:23
Gateway closed  # 22:18:40
Gateway closed  # 22:43:31
Gateway closed  # 01:05:20
```

**关键发现**:
- 每次 `Gateway closed` 后，没有看到 `Starting gateway` 或 `Connecting to Discord gateway` 日志
- 说明 `scheduleReconnect()` 没有被触发，或者重连失败了

---

## 问题分析

### 根因定位

查看 `src/gateway.ts` 中的 `handleClose` 方法:

```typescript
handleClose(code, reason) {
    this.connected = false;
    // Clear heartbeat timer
    if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
    }
    this.emit('closed', { code, reason });
    // Auto reconnect - 理论上会调用 scheduleReconnect
    if (this.autoReconnect && code !== types_1.GatewayCloseCode.INVALID_INTENTS) {
        this.scheduleReconnect();
    }
}
```

**问题 1**: `handleClose` 中调用了 `scheduleReconnect()`，但没有检查 `this.autoReconnect` 是否被正确传递

查看 `createGateway` 配置:

```typescript
function createGateway(config) {
    return new DiscordGateway({
        token: config.token,
        proxyUrl: config.proxyUrl,
        intents: config.intents,
        autoReconnect: config.autoReconnect,  // ← 可能 undefined
        heartbeatInterval: config.heartbeatInterval,
    });
}
```

查看 `index.ts` 中的调用:

```typescript
const pluginConfig = {
    ...config_1.DEFAULT_CONFIG,
    token: account.token,
    proxyUrl,
    intents: [...],
    autoReconnect: true,  // ← 设置为 true
    heartbeatInterval: 45000,
};
```

**问题 2**: `scheduleReconnect()` 中错误被静默吃掉

```typescript
scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(2, Math.floor(Math.random() * 5)), 60000);
    this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect().catch(() => { });  // ← 错误被吞掉，没有日志
    }, delay);
}
```

当 `connect()` 失败时，没有任何错误日志，导致无法追踪问题。

---

## 需要修复的问题

### P0 - 阻断性问题

1. **Gateway 关闭后不自动重连**
   - 文件: `src/gateway.ts`
   - 函数: `handleClose()` → `scheduleReconnect()` → `connect()`
   - 现象: 重连逻辑存在但不生效

2. **重连失败时错误被静默吃掉**
   - 文件: `src/gateway.ts`
   - 函数: `scheduleReconnect()`
   - 问题: `.catch(() => { })` 吞掉了所有错误

### P1 - 重要问题

3. **缺少重连状态监控**
   - 文件: `src/index.ts`
   - 问题: 插件无法感知 Gateway 处于离线状态

4. **断线期间无法处理入站消息**
   - 文件: `src/index.ts`
   - 问题: Gateway 关闭后消息处理器不再工作

---

## 修复方案

### 修复 1: 修复 `scheduleReconnect()` 错误处理

**位置**: `src/gateway.ts`

**修改前**:
```typescript
scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(2, Math.floor(Math.random() * 5)), 60000);
    this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect().catch(() => { });
    }, delay);
}
```

**修改后**:
```typescript
scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(2, Math.floor(Math.random() * 5)), 60000);
    this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect()
            .then(() => {
                console.log(`[${this.logPrefix}] Reconnected successfully`);
            })
            .catch((error) => {
                console.error(`[${this.logPrefix}] Reconnect failed: ${error.message}`);
                // 失败后再次尝试重连
                this.scheduleReconnect();
            });
    }, delay);
}
```

### 修复 2: 确保 `autoReconnect` 配置正确传递

**位置**: `src/gateway.ts` - `DiscordGateway` constructor

**修改前**:
```typescript
constructor(options) {
    // ...
    this.autoReconnect = options.autoReconnect !== false;  // 默认 true
    // ...
}
```

**修改后** (添加更清晰的默认值):
```typescript
constructor(options) {
    // ...
    this.autoReconnect = options.autoReconnect === true;  // 明确检查
    // ...
}
```

### 修复 3: 添加 `closed` 事件监听中的重连触发

**位置**: `src/index.ts`

**修改后**:
```typescript
runtime.gateway.on('closed', (data) => {
    runtime.connected = false;
    log?.info(`[${PLUGIN_ID}:${accountId}] Gateway closed: ${data.code} ${data.reason}`);
    setStatus({
        ...getStatus(),
        running: false,
        connected: false,
    });
    // 明确触发重连（冗余保护）
    if (runtime.gateway) {
        runtime.gateway.scheduleReconnect();
    }
});
```

### 修复 4: 添加重连状态监控和日志

**位置**: `src/index.ts`

在 `gateway.startAccount` 中添加:

```typescript
// 监控重连状态
runtime.gateway.on('reconnect', () => {
    log?.info(`[${PLUGIN_ID}:${accountId}] Attempting to reconnect...`);
    setStatus({
        ...getStatus(),
        connected: false,
        lastError: null,
    });
});

runtime.gateway.on('reconnected', () => {
    log?.info(`[${PLUGIN_ID}:${accountId}] Reconnected successfully`);
    setStatus({
        ...getStatus(),
        connected: true,
        lastConnectedAt: Date.now(),
    });
});

runtime.gateway.on('reconnect-failed', (error) => {
    log?.error(`[${PLUGIN_ID}:${accountId}] Reconnect failed: ${error.message}`);
    setStatus({
        ...getStatus(),
        lastError: error.message,
    });
});
```

需要在 `DiscordGateway` 类中添加这些事件:

```typescript
// src/gateway.ts
class DiscordGateway {
    // ... 现有代码 ...

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        const delay = Math.min(1000 * Math.pow(2, Math.floor(Math.random() * 5)), 60000);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect()
                .then(() => {
                    this.emit('reconnected');
                })
                .catch((error) => {
                    this.emit('reconnect-failed', error);
                    this.scheduleReconnect();  // 递归重试
                });
        }, delay);
    }
}
```

---

## 测试方案

### 测试用例 1: 正常断线后自动重连

1. 启动 Gateway
2. 手动断开 WebSocket 连接（模拟网络断开）
3. 验证 `Gateway closed` 日志后 1-2 秒内看到 `Starting gateway` 日志
4. 验证重连成功后看到 `Connected as` 日志

### 测试用例 2: 重连失败后指数退避重试

1. 启动 Gateway
2. 断开网络连接
3. 等待第一次重连失败
4. 验证 1-2 秒后看到第二次重连尝试
5. 验证重试间隔指数增长（2s, 4s, 8s...）

### 测试用例 3: 重连期间消息不丢失

1. 启动 Gateway
2. 发送测试消息
3. 断开连接
4. 等待重连成功
5. 验证消息在重连后被正确处理

---

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/gateway.ts` | 修改 | 修复 `scheduleReconnect()` 错误处理 |
| `src/gateway.ts` | 修改 | 添加 `reconnect`、`reconnected`、`reconnect-failed` 事件 |
| `src/index.ts` | 修改 | 添加重连状态事件监听 |
| `src/index.ts` | 修改 | 在 `closed` 事件中明确触发重连 |

---

## 验收标准

1. ✅ Gateway 关闭后 **5 秒内** 自动尝试重连
2. ✅ 重连失败时打印错误日志
3. ✅ 重连成功时打印成功日志
4. ✅ 断线期间的消息在重连后能够被正确处理
5. ✅ 所有修改通过单元测试和集成测试

---

## Priority

**P0 - 立即修复**:
- `scheduleReconnect()` 错误处理
- `closed` 事件中明确触发重连

**P1 - 尽快修复**:
- 添加重连状态事件和监控
- 完善重连日志

**P2 - 后续优化**:
- 添加重连状态到 `status.describeAccount()`
- 实现重连计数器

---

**文档版本**: 1.1  
**创建时间**: 2026-02-03  
**作者**: Yoimiya 🎆
