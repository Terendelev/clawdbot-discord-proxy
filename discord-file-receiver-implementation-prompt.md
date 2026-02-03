# Discord 文件接收与上传至 NAS - 实现 Prompt

## 任务概述

实现 Discord 文件接收功能：当用户通过 Discord 发送文件时，插件应自动下载文件临时缓存，上传到用户 NAS 服务器的 `/areport/` 目录，然后将文件路径作为附件信息追加到消息末尾发送给用户。

---

## 当前代码状态

### 文件位置
- **Gateway 处理**: `~/codes/src/gateway.ts` (第 253-254 行)
- **消息处理**: `~/codes/src/index.ts` (第 347-420 行)
- **类型定义**: `~/codes/src/types.ts` (第 166-175 行)
- **NAS 配置**: 见 `~/clawd/TOOLS.md`

### 现有逻辑
```typescript
// gateway.ts - 消息接收（无需修改）
case 'MESSAGE_CREATE':
  this.emit('message', data as DiscordMessage);

// types.ts - 附件类型定义（无需修改）
attachments: Array<{
  id: string;
  filename: string;
  description?: string;
  content_type?: string;
  size: number;
  url: string;        // 文件下载 URL
  proxy_url: string;
  height?: number;
  width?: number;
}>;
```

### NAS 配置信息
```json
{
  "server": "clawdbot-nas",
  "type": "SMB",
  "address": "192.168.2.6",
  "share": "personal_folder",
  "remoteDirectory": "/areport/",
  "username": "clawdbot"
}
```

---

## 实现步骤

### 步骤 1: 导入依赖模块

在 `index.ts` 顶部添加以下导入：

```typescript
import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
```

### 步骤 2: 添加文件下载函数

在 `index.ts` 中添加辅助函数：

```typescript
/**
 * 下载文件到临时目录
 * @param fileUrl 文件 URL
 * @param filename 保存的文件名
 * @returns 下载后的本地文件路径
 */
async function downloadFileToTemp(fileUrl: string, filename: string): Promise<string> {
  const tempDir = '/tmp/discord-files';
  await fs.mkdir(tempDir, { recursive: true });

  const tempFilePath = path.join(tempDir, `${Date.now()}-${filename}`);

  return new Promise((resolve, reject) => {
    const protocol = fileUrl.startsWith('https://') ? https : http;
    const url = new URL(fileUrl);

    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
    };

    const req = protocol.request(requestOptions, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(tempFilePath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(tempFilePath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(tempFilePath, () => {});
        reject(err);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * 清理临时文件
 * @param filePath 文件路径
 */
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // 忽略清理错误
  }
}
```

### 步骤 3: 添加 NAS 上传函数

添加 SMB 上传函数：

```typescript
/**
 * 上传文件到 NAS
 * @param localFilePath 本地文件路径
 * @param remoteFilename 远程文件名
 * @returns NAS 上的完整路径
 */
async function uploadToNas(localFilePath: string, remoteFilename: string): Promise<string> {
  // 使用 smb2 库或 child_process 执行 smbclient 命令
  // 返回 NAS 上的完整路径: /areport/remoteFilename
}
```

**注意**: 可以使用以下方式之一：
1. 使用 `smb2` npm 包
2. 使用 `smbclient` 命令行工具: `smbclient //192.168.2.6/personal_folder -U clawdbot -c "put localFilePath areport/remoteFilename"`
3. 使用 `fs` 模块挂载 SMB 后直接复制

### 步骤 4: 修改消息处理逻辑

在 `index.ts` 第 347-420 行的消息处理代码中，找到消息格式化部分，添加以下逻辑：

```typescript
// 原始代码（保留）
const messageBody = message.content || '';

// 新增：处理附件
const uploadedFiles: string[] = [];

if (message.attachments && message.attachments.length > 0) {
  log?.info(`[${PLUGIN_ID}:${accountId}] Found ${message.attachments.length} attachment(s)`);

  for (const attachment of message.attachments) {
    try {
      log?.info(`[${PLUGIN_ID}:${accountId}] Downloading: ${attachment.filename} (${attachment.size} bytes)`);

      // 下载文件
      const tempFilePath = await downloadFileToTemp(attachment.url, attachment.filename);

      // 上传到 NAS
      const nasPath = await uploadToNas(tempFilePath, attachment.filename);
      uploadedFiles.push(nasPath);

      // 清理临时文件
      await cleanupTempFile(tempFilePath);

      log?.info(`[${PLUGIN_ID}:${accountId}] Uploaded to NAS: ${nasPath}`);
    } catch (error) {
      log?.error(`[${PLUGIN_ID}:${accountId}] Failed to process attachment ${attachment.filename}: ${error.message}`);
    }
  }
}

// 将上传的文件路径追加到消息末尾
let fullMessageBody = messageBody;
if (uploadedFiles.length > 0) {
  const attachmentInfo = uploadedFiles.map(path => `📎 ${path}`).join('\n');
  fullMessageBody = `${messageBody}\n\n${attachmentInfo}`;
}
```

### 步骤 5: 更新消息发送

将消息发送部分使用的 `messageBody` 替换为 `fullMessageBody`：

```typescript
// 原来：
const body = runtime.channel.reply.formatInboundEnvelope({
  channel: 'Discord',
  from: `${message.author.username}#${message.author.discriminator}`,
  timestamp: new Date(message.timestamp).getTime(),
  body: messageBody,  // 改为 fullMessageBody
  // ...
});

// 更新后：
const body = runtime.channel.reply.formatInboundEnvelope({
  channel: 'Discord',
  from: `${message.author.username}#${message.author.discriminator}`,
  timestamp: new Date(message.timestamp).getTime(),
  body: fullMessageBody,  // 使用包含文件路径的完整消息
  // ...
});
```

### 步骤 6: 处理错误场景

确保在以下场景中正确处理：

1. **下载失败**: 记录日志，继续处理其他附件
2. **上传失败**: 清理临时文件，记录错误，不影响其他文件
3. **清理失败**: 忽略错误，继续流程
4. **文件已存在**: 覆盖或重命名（建议添加时间戳前缀）

---

## 消息格式示例

### 输入（用户发送）
- 文本消息: "这是一个测试"
- 附件: `test.txt` (1KB)

### 输出（发送给用户）
```
这是一个测试

📎 /areport/test.txt
```

### 多文件示例
```
收到的文件

📎 /areport/document.pdf
📎 /areport/image.png
📎 /areport/data.json
```

---

## 文件命名规范

1. **临时文件**: `/tmp/discord-files/{timestamp}-{original_filename}`
   - 示例: `/tmp/discord-files/1730107955000-report.pdf`

2. **NAS 文件**: `/areport/{original_filename}`
   - 示例: `/areport/report.pdf`

3. **冲突处理**: 如果文件名已存在，可以：
   - 覆盖（推荐）
   - 添加序号: `report (1).pdf`
   - 添加时间戳: `report_1730107955.pdf`

---

## 性能考虑

1. **并发处理**: 多附件时并行下载和上传
2. **超时控制**: 设置下载/上传超时（如 60 秒）
3. **文件大小限制**: 设置最大支持文件大小（如 25MB，Discord 限制）
4. **清理机制**: 确保临时文件总是被清理

---

## 测试计划

### 测试用例

1. **单文本文件**
   - 发送: "Hello" + `hello.txt`
   - 预期: 收到 "Hello" + "📎 /areport/hello.txt"

2. **多文件**
   - 发送: `file1.pdf` + `file2.jpg`
   - 预期: 收到两个文件路径

3. **仅文件无文本**
   - 发送: `notes.md`（无文本内容）
   - 预期: 收到 "📎 /areport/notes.md"

4. **大文件**
   - 发送: 10MB 文件
   - 预期: 成功下载、上传、清理

5. **错误处理**
   - 发送: 不存在的文件 URL
   - 预期: 记录错误，不影响其他附件

### 测试步骤

```bash
# 1. 编译代码
cd ~/codes && npm run build

# 2. 复制到插件目录
cp dist/*.js dist/*.d.ts dist/*.js.map dist/*.d.ts.map ~/.clawdbot/extensions/clawdbot-discord-proxy/dist/

# 3. 重启 Gateway
clawdbot gateway restart

# 4. 通过 Discord 发送文件测试

# 5. 检查日志
# 查看是否有 "Found X attachment(s)" 日志
# 检查 NAS 目录是否有上传的文件
```

---

## 注意事项

1. **安全**: 不要在日志中输出文件 URL（可能包含敏感信息）
2. **错误处理**: 单个文件失败不应影响其他文件
3. **资源清理**: 必须清理临时文件，避免磁盘满
4. **权限**: 确保运行用户有权限写入 `/tmp/` 和读取 NAS

---

## 验收标准

- [ ] 收到 Discord 文件后自动下载到临时目录
- [ ] 文件上传到 NAS `/areport/` 目录
- [ ] 临时文件在上传完成后被清理
- [ ] NAS 路径作为附件信息追加到消息末尾
- [ ] 多文件场景正常工作
- [ ] 错误场景有适当处理和日志记录

---

## 相关文档

- Discord API - Message Object: https://discord.com/developers/docs/resources/message#message-object
- Discord API - Attaching Files: https://discord.com/developers/docs/reference#attachments
- NAS 配置: `~/clawd/TOOLS.md`
