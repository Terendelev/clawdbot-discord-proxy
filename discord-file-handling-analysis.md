# Discord 文件处理分析报告

## 文档信息

- **创建日期**: 2026-02-03
- **分析范围**: clawdbot-discord-proxy 插件文件处理逻辑
- **目标路径**: `~/discord/upfile/`

---

## 一、现状分析

### 1.1 代码位置

| 文件 | 作用 | 行号 |
|------|------|------|
| `src/index.ts` | 消息处理主逻辑 | 499-542 |
| `src/gateway.ts` | WebSocket Gateway 处理 | 253-254 |
| `src/types.ts` | TypeScript 类型定义 | 166-183 |

### 1.2 消息接收类型

根据 Discord API 和代码分析，消息包含 **3 种多媒体类型**：

| 类型 | 字段 | 当前支持 | 说明 |
|------|------|----------|------|
| 文件附件 | `message.attachments` | ✅ 已实现 | 用户上传的原始文件 |
| 嵌入内容 | `message.embeds` | ❌ 未实现 | 图片预览、链接预览、视频 |
| 文本链接 | `message.content` | ❌ 未实现 | URL 自动渲染为 embed |

### 1.3 当前文件处理流程

```typescript
// src/index.ts 第 507-527 行
if (message.attachments && message.attachments.length > 0) {
  // 1. 下载文件到临时目录
  const tempFilePath = await downloadFileToTemp(attachment.url, attachment.filename);

  // 2. 上传到 NAS（目标：SMB 共享）
  const nasPath = await uploadToNas(tempFilePath, attachment.filename);

  // 3. 清理临时文件
  await cleanupTempFile(tempFilePath);
}
```

### 1.4 NAS 上传函数

```typescript
// src/index.ts 第 155-170 行
async function uploadToNas(localFilePath: string, remoteFilename: string): Promise<string> {
  // 使用 smbclient 命令行工具
  const nasConfig = {
    server: 'clawdbot-nas',
    share: 'personal_folder',
    remoteDir: '/areport/',
    username: 'clawdbot'
  };

  // 执行 smbclient 上传命令
  const command = `smbclient //${nasConfig.server}/${nasConfig.share} -U ${nasConfig.username} -c "put ${localFilePath} ${nasConfig.remoteDir}${remoteFilename}"`;
  await exec(command);

  return `${nasConfig.remoteDir}${remoteFilename}`;
}
```

### 1.5 测试结果

- **Gateway 状态**: 正常运行
- **消息接收**: 正常工作
- **附件检测**: 正常工作（检测到 `Has attachments: true (0 items)`）
- **问题**: 用户发送的是纯文本消息，`attachments` 和 `embeds` 数组均为空

---

## 二、问题分析

### 2.1 当前问题

1. **测试消息无附件**: 用户发送纯文本消息，`attachments` 和 `embeds` 均为空数组
2. **代码只处理 `attachments`**: 未处理 `embeds` 和 `content` 中的 URL
3. **NAS 上传依赖外部工具**: 使用 `smbclient` 命令，需要配置和权限

### 2.2 需求变更

用户要求修改文件存储位置：
- **原需求**: 上传到 NAS SMB 共享 `/areport/` 目录
- **新需求**: 存放到服务器本地目录 `~/discord/upfile/`，返回绝对路径

---

## 三、解决方案

### 3.1 修改 `uploadToNas` 函数

**目标**: 将 SMB 上传改为本地目录复制

**修改位置**: `src/index.ts` 第 155-170 行

**修改前**:
```typescript
async function uploadToNas(localFilePath: string, remoteFilename: string): Promise<string> {
  const nasConfig = {
    server: 'clawdbot-nas',
    share: 'personal_folder',
    remoteDir: '/areport/',
    username: 'clawdbot'
  };

  const command = `smbclient //${nasConfig.server}/${nasConfig.share} -U ${nasConfig.username} -c "put ${localFilePath} ${nasConfig.remoteDir}${remoteFilename}"`;
  await exec(command);

  return `${nasConfig.remoteDir}${remoteFilename}`;
}
```

**修改后**:
```typescript
async function uploadToNas(localFilePath: string, remoteFilename: string): Promise<string> {
  // 本地目录配置
  const localConfig = {
    baseDir: '/home/tom/discord/upfile'
  };

  // 确保目录存在
  await fs.mkdir(localConfig.baseDir, { recursive: true });

  // 目标文件路径
  const targetPath = path.join(localConfig.baseDir, remoteFilename);

  // 复制文件到本地目录
  await fs.copyFile(localFilePath, targetPath);

  // 返回绝对路径
  return targetPath;
}
```

### 3.2 新增目录创建逻辑

在消息处理开始时（`src/index.ts` 第 500 行附近）添加：

```typescript
// 确保上传目录存在
const uploadDir = '/home/tom/discord/upfile';
await fs.mkdir(uploadDir, { recursive: true });
```

### 3.3 文件命名冲突处理

如果文件已存在，可以选择：

**方案 A: 覆盖（推荐）**
```typescript
await fs.copyFile(localFilePath, targetPath); // 直接覆盖
```

**方案 B: 添加时间戳**
```typescript
const timestamp = Date.now();
const newFilename = `${timestamp}-${remoteFilename}`;
const targetPath = path.join(localConfig.baseDir, newFilename);
```

**方案 C: 添加序号**
```typescript
let targetPath = path.join(localConfig.baseDir, remoteFilename);
let counter = 1;
while (await fileExists(targetPath)) {
  const ext = path.extname(remoteFilename);
  const baseName = path.basename(remoteFilename, ext);
  targetPath = path.join(localConfig.baseDir, `${baseName} (${counter})${ext}`);
  counter++;
}
```

---

## 四、实现步骤

### 步骤 1: 导入依赖模块

在 `src/index.ts` 顶部确保已导入：

```typescript
import fs from 'fs/promises';
import path from 'path';
```

### 步骤 2: 修改 `uploadToNas` 函数

将 `src/index.ts` 第 155-170 行的 `uploadToNas` 函数替换为本地复制逻辑。

### 步骤 3: 添加目录创建检查

在消息处理逻辑中（`src/index.ts` 第 500 行附近）添加目录创建检查。

### 步骤 4: 更新日志输出

修改日志信息，将 `nasPath` 改为 `localPath` 或 `filePath`。

### 步骤 5: 重新编译和部署

```bash
cd ~/codes && npm run build
cp dist/*.js dist/*.d.ts ~/.clawdbot/extensions/clawdbot-discord-proxy/dist/
clawdbot gateway restart
```

---

## 五、消息类型完整处理方案

### 5.1 支持 `embeds` 类型的图片

如果用户发送截图或粘贴图片，Discord 会将其作为 `embeds` 发送。需要添加以下逻辑：

```typescript
// 处理 embeds 中的图片
if (message.embeds && message.embeds.length > 0) {
  for (const embed of message.embeds) {
    if (embed.type === 'image' || embed.type === 'rich') {
      const imageUrl = embed.thumbnail?.url || embed.image?.url;
      if (imageUrl) {
        const filename = path.basename(new URL(imageUrl).pathname);
        const tempPath = await downloadFileToTemp(imageUrl, filename);
        const localPath = await uploadToNas(tempPath, filename);
        uploadedFiles.push(localPath);
        await cleanupTempFile(tempPath);
      }
    }
  }
}
```

### 5.2 支持 `content` 中的 URL

如果消息包含 URL，可以提取并处理：

```typescript
// 从 content 中提取 URL
const urlRegex = /https?:\/\/[^\s]+/g;
const urls = message.content.match(urlRegex);

if (urls) {
  for (const url of urls) {
    // 判断是否为图片 URL
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
      const filename = path.basename(new URL(url).pathname);
      const tempPath = await downloadFileToTemp(url, filename);
      const localPath = await uploadToNas(tempPath, filename);
      uploadedFiles.push(localPath);
      await cleanupTempFile(tempPath);
    }
  }
}
```

### 5.3 完整消息处理流程

```typescript
const uploadedFiles: string[] = [];

// 1. 处理 attachments
if (message.attachments && message.attachments.length > 0) {
  // ... 现有逻辑 ...
}

// 2. 处理 embeds
if (message.embeds && message.embeds.length > 0) {
  for (const embed of message.embeds) {
    const imageUrl = embed.thumbnail?.url || embed.image?.url;
    if (imageUrl) {
      const filename = `embed-${Date.now()}-${path.basename(new URL(imageUrl).pathname)}`;
      const tempPath = await downloadFileToTemp(imageUrl, filename);
      const localPath = await uploadToNas(tempPath, filename);
      uploadedFiles.push(localPath);
      await cleanupTempFile(tempPath);
    }
  }
}

// 3. 从 content 提取 URL（可选）
const urls = message.content.match(/https?:\/\/[^\s]+/g);
if (urls) {
  // ... 处理逻辑 ...
}
```

---

## 六、文件路径规范

### 6.1 目录结构

```
/home/tom/discord/upfile/
├── test.txt
├── image.png
├── document.pdf
└── embed-1730107955000-image.png
```

### 6.2 路径格式

- **绝对路径**: `/home/tom/discord/upfile/test.txt`
- **返回格式**: 直接返回绝对路径字符串

### 6.3 权限要求

确保运行用户有权限：
- 读取 `/tmp/discord-files/` 临时文件
- 写入 `/home/tom/discord/upfile/` 目录
- 创建子目录和文件

---

## 七、验收标准

- [ ] 修改 `uploadToNas` 函数为本地文件复制
- [ ] 文件保存到 `/home/tom/discord/upfile/` 目录
- [ ] 返回文件的绝对路径
- [ ] 临时文件在上传后被清理
- [ ] 支持文件命名冲突处理（覆盖或重命名）
- [ ] 多文件场景正常工作
- [ ] 错误场景有适当处理和日志记录

---

## 八、测试计划

### 测试用例

1. **单文件上传**
   - 输入: `hello.txt` (1KB)
   - 预期: 文件保存到 `/home/tom/discord/upfile/hello.txt`

2. **多文件上传**
   - 输入: `file1.pdf`, `file2.jpg`
   - 预期: 两个文件都保存到指定目录

3. **文件覆盖**
   - 输入: 同名文件
   - 预期: 覆盖原文件（或按配置处理）

4. **目录创建**
   - 首次上传
   - 预期: 自动创建 `/home/tom/discord/upfile/` 目录

### 测试命令

```bash
# 检查目录
ls -la /home/tom/discord/upfile/

# 查看文件
cat /home/tom/discord/upfile/hello.txt

# 清理测试文件
rm /home/tom/discord/upfile/*
```

---

## 九、后续优化建议

1. **支持更多 embed 类型**: 视频、音频、链接预览
2. **文件清理策略**: 定期清理旧文件
3. **文件大小限制**: 设置最大文件大小
4. **文件类型过滤**: 只处理允许的类型
5. **并发处理**: 多文件并行下载和上传

---

## 十、相关文档

- Discord API - Message Object: https://discord.com/developers/docs/resources/message#message-object
- Discord API - Attachments: https://discord.com/developers/docs/resources/attachment
- Discord API - Embeds: https://discord.com/developers/docs/resources/embed
- NAS 配置: `~/clawd/TOOLS.md`
- 实现 Prompt: `~/codes/discord-file-receiver-implementation-prompt.md`
