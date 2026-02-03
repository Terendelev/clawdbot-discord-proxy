# Discord 文件发送功能缺失 - 错误报告

**提交时间**: 2026-02-03 04:24 UTC
**插件版本**: clawdbot-discord-proxy v1.0.0
**严重程度**: 中等

---

## 问题描述

Discord Proxy 插件不支持发送文件功能。用户尝试使用 `message` 工具的 `filePath` 参数发送文件时失败。

### 错误信息

```
Unknown target "discord:988274067054428171" for Discord Proxy.
```

实际上这是两个问题：
1. 通道名称配置错误（应为 `clawdbot-discord-proxy` 而不是 `discord`）
2. **核心问题**：插件没有实现 `sendFile` 方法

---

## 问题分析

### 1. 通道名称问题

配置文件 `~/.clawdbot/clawdbot.json` 中通道名称为：
```json
"clawdbot-discord-proxy": {
  "accounts": {
    "default": {
      "token": "..."
    }
  }
}
```

但用户使用 `channel: "discord"` 时报错，应该使用 `clawdbot-discord-proxy`。

### 2. 缺少文件发送实现

查看插件源码发现：

**channel.js** 中 `DiscordChannelPlugin` 类只实现了：
- `sendMessage(channelId, content)` - 发送文本消息
- 没有 `sendFile` 方法

**api.js** 中没有文件上传相关方法。

**message 工具** 期望的调用方式：
```javascript
message({
  action: "send",
  channel: "clawdbot-discord-proxy",
  filePath: "/path/to/file"
})
```

但插件不支持此参数。

---

## 当前代码状态

### channel.js
```javascript
class DiscordChannelPlugin {
  async sendMessage(channelId, content) {
    await this.api.createMessage(channelId, content);
  }
  // 缺少 sendFile 方法
}
```

### api.js
```javascript
// 缺少 uploadFile 或 createMessageWithFile 方法
```

---

## 所需修改

### 1. api.js 添加文件上传方法

Discord API 文件上传需要使用 `multipart/form-data`，通过 `attachments` 端点：

```
POST /channels/{channel.id}/messages
Content-Type: multipart/form-data
```

需要实现：
- `uploadFile(channelId, file, filename)` - 上传文件
- 或扩展 `createMessage` 支持附件

### 2. channel.js 添加 sendFile 方法

```typescript
async sendFile(channelId: string, filePath: string, filename?: string): Promise<void>
```

参数：
- `channelId`: Discord 频道 ID
- `filePath`: 文件本地路径
- `filename`: 可选的文件名

实现逻辑：
1. 读取文件
2. 调用 API 上传
3. 发送包含附件的消息

### 3. 更新类型定义

更新 `types.d.ts` 中的 `ChannelPlugin` 接口：
```typescript
interface ChannelPlugin {
  sendMessage(channelId: string, content: string): Promise<void>;
  sendFile(channelId: string, filePath: string, filename?: string): Promise<void>;
  // ...
}
```

### 4. 更新 index.js

确保 `discordPlugin` 对象包含新的 `sendFile` 方法。

---

## 测试计划

1. 使用小文本文件测试
2. 测试图片文件
3. 测试大文件 (>8MB，Discord 限制)
4. 测试文件名为中文的情况

---

## 注意事项

1. Discord API 对文件大小有限制（通常 8MB 或 25MB 取决于付费等级）
2. 需要处理文件读取错误
3. 需要处理网络错误和重试
4. multipart/form-data 需要正确设置 boundary

---

## 相关文件

- `~/.clawdbot/clawdbot.json` - 配置文件
- `~/.clawdbot/extensions/clawdbot-discord-proxy/dist/` - 插件源码
- `~/clawd/discord-plugin-analysis.md` - 分析文档
