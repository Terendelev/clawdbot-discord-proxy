# Patch Prompt: clawdbot-discord-proxy 文件上传功能

## 1. Role Definition
你是一位精通 TypeScript 和 Discord API 的后端开发工程师，擅长编写高质量的代码和清晰的文档。

## 2. Background

### Project Context
clawdbot-discord-proxy 是 Clawdbot 的 Discord 通道插件，提供 Discord 消息的收发功能。当前存在严重功能缺失：**无法上传图片和文件**。

### Current Architecture
```
src/
├── index.ts       # 插件主入口，定义 discordPlugin.outbound.sendMedia
├── api.ts         # REST API 客户端（当前缺少文件上传）
├── gateway.ts     # WebSocket Gateway（已完整）
├── config.ts      # 配置解析
└── types.ts       # 类型定义
```

### Problem Description
1. `api.ts` 的 `createMessage()` 只支持 JSON body
2. Discord 文件上传需要 `multipart/form-data` 格式
3. `index.ts` 的 `sendMedia()` 是虚假实现，只是把 URL 当文本发送

### Related Resources
- Source Code: `/home/tom/codes/src/`
- Package Config: `/home/tom/codes/package.json`

## 3. Task Description

### Objective
为 clawdbot-discord-proxy 插件添加完整的文件上传功能，支持本地文件和网络 URL。

### Deliverables
1. 修改 `api.ts`：添加 `uploadFile()` 方法
2. 修改 `index.ts`：更新 `sendMedia()` 调用真正的上传方法
3. 更新 `package.json`：添加 `form-data` 依赖
4. 确保代理配置仍然生效
5. 确保引用回复功能正常

## 4. Constraints

### Technical Constraints
- 使用 `form-data` 库处理 multipart 上传
- 必须支持代理配置（与现有 `createMessage` 相同的代理机制）
- Discord 文件大小限制 25MB
- 必须处理本地文件路径和网络 URL 两种场景
- 网络下载的临时文件必须清理

### Code Quality Constraints
- 遵循现有代码风格和模式
- 保持类型定义完整
- 添加适当的错误处理
- 保持函数简洁，单一职责

### Non-functional Constraints
- 不修改其他功能模块
- 不修改测试文件
- 不更新文档

## 5. Step-by-step Instructions

### Step 1: 分析现有代码结构
阅读以下文件，理解现有实现：
- `api.ts`: 了解 `createMessage()` 和代理机制
- `index.ts`: 了解 `sendMedia()` 当前实现
- `package.json`: 了解依赖管理方式

### Step 2: 添加 form-data 依赖
修改 `/home/tom/codes/package.json`：
```json
{
  "dependencies": {
    "form-data": "^4.0.0"
  }
}
```
运行 `npm install`

### Step 3: 修改 api.ts

#### 5.3.1 添加必要的导入
```typescript
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import http from 'http';
import https from 'https';
```

#### 5.3.2 添加文件上传方法
在 `DiscordApi` 类中实现以下方法：

**方法1: uploadFile() - 主入口**
```typescript
async uploadFile(
  channelId: string,
  filePathOrUrl: string,
  options?: {
    filename?: string;
    description?: string;
    content?: string;
  }
): Promise<DiscordMessage>
```
- 检测是本地文件还是网络 URL
- 本地文件：直接读取
- 网络 URL：下载到临时文件，上传后清理
- 使用 `multipart/form-data` 格式上传
- 返回 DiscordMessage

**方法2: isUrl() - URL 检测**
```typescript
private isUrl(str: string): boolean
```

**方法3: downloadFile() - 下载网络文件**
```typescript
private async downloadFile(url: string): Promise<string>
```
- 下载到 `/tmp/discord-upload-{timestamp}-{random}`
- 返回临时文件路径

**方法4: uploadFormData() - 实际上传**
```typescript
private async uploadFormData(
  channelId: string,
  form: FormData
): Promise<DiscordMessage>
```

#### 5.3.3 保持代理支持
确保 `uploadFile()` 使用与 `createMessage()` 相同的 `this.proxyAgent`

### Step 4: 修改 index.ts

更新 `discordPlugin.outbound.sendMedia`：

```typescript
sendMedia: async ({
  to,
  text,
  mediaUrl,
  accountId,
  cfg,
}: {
  to: string;
  text?: string;
  mediaUrl: string;
  accountId?: string;
  cfg: Record<string, unknown>;
}) => {
  const accountIdStr = accountId ?? 'default';
  const account = resolveAccount(cfg, accountIdStr);
  const runtime = getRuntime(accountIdStr);

  if (!runtime.api) {
    const proxyUrl = getProxyUrl(cfg);
    runtime.api = createApi(account.token!, proxyUrl);
  }

  try {
    await runtime.api.uploadFile(to, mediaUrl, {
      content: text,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
},
```

### Step 5: 验证修改
检查：
- 代理配置是否传递
- 引用回复参数是否保留
- 错误处理是否完整

## 6. Examples

### Example 1: 上传本地图片
```typescript
await api.uploadFile('channel-id', '/home/tom/clawd/avatars/yoimiya.jpg', {
  content: '这是我的头像',
});
```

### Example 2: 上传网络图片
```typescript
await api.uploadFile('channel-id', 'https://example.com/image.png', {
  content: '来自网络的图片',
});
```

### Example 3: 上传普通文件
```typescript
await api.uploadFile('channel-id', '/path/to/document.pdf', {
  filename: 'document.pdf',
  description: '项目文档',
});
```

## 7. Output Format

### Required Output
代码修改完成后，输出以下信息：

```markdown
## Patch Summary

### Modified Files
- `src/api.ts`: 添加 uploadFile() 方法
- `src/index.ts`: 更新 sendMedia() 实现
- `package.json`: 添加 form-data 依赖

### New Methods Added
- `DiscordApi.uploadFile()`
- `DiscordApi.isUrl()`
- `DiscordApi.downloadFile()`
- `DiscordApi.uploadFormData()`

### Testing Notes
需要测试的场景：
1. [ ] 上传本地图片文件
2. [ ] 上传网络图片 URL
3. [ ] 上传普通文件
4. [ ] 验证代理仍然工作
5. [ ] 验证引用回复正常
```

## 8. Evaluation Criteria

### Functional Requirements
- [ ] sendMedia 能真正上传文件
- [ ] 支持本地文件路径
- [ ] 支持网络 URL
- [ ] 代理配置生效
- [ ] 引用回复功能正常

### Code Quality
- [ ] 代码通过 TypeScript 编译
- [ ] 遵循现有代码风格
- [ ] 类型定义完整
- [ ] 错误处理适当
- [ ] 临时文件正确清理

### Non-requirements
- [ ] 不修改其他功能
- [ ] 不更新文档
- [ ] 不添加测试

## 9. Reference

### Discord API Documentation
- File Uploads: `POST /channels/{channel.id}/messages`
- Request format: multipart/form-data
- File limit: 25MB

### npm Packages
- form-data: ^4.0.0

---

**Prompt Version**: 1.0
**Created**: 2026-02-03
**Author**: Yoimiya
**Status**: Ready for Execution
