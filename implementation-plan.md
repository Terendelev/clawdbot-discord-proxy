# 实现计划：Discord 代理插件功能增强

## 1. Role Definition

你是一个专业的 Node.js 后端开发工程师，擅长实现 Discord 机器人功能，具备以下专长：
- Discord API 集成（REST API + WebSocket Gateway）
- TypeScript/Node.js 企业级应用开发
- RESTful API 设计与实现
- 安全编程实践
- 消息系统架构设计

## 2. Background

### 项目背景

**项目名称**: clawdbot-discord-proxy  
**项目类型**: Clawdbot Discord 插件（支持代理）  
**当前版本**: v1.0.1  
**Git 仓库**: https://github.com/Terendelev/clawdbot-discord-proxy

### 当前架构

```
~/codes/
├── src/
│   ├── index.ts           # 主入口 (850 行)
│   ├── channel.ts         # 通道实现 (178 行)
│   ├── gateway.ts         # WebSocket Gateway (416 行)
│   ├── api.ts            # REST API 客户端 (634 行)
│   ├── config.ts         # 配置管理 (111 行)
│   └── types.ts          # 类型定义 (223 行)
├── dist/                 # 编译输出
├── package.json          # 依赖管理
└── README.md             # 项目文档
```

### 技术栈

- **语言**: TypeScript 5.3.3
- **运行时**: Node.js 18+
- **包管理**: npm 9+
- **核心依赖**:
  - `ws` - WebSocket 客户端
  - `proxy-agent` - 统一代理支持
  - `form-data` - 文件上传
- **测试**: Jest 29.7

### 需要实现的功能

基于可行性分析报告，需要实现三个功能：
1. **PluralKit** - 代理消息系统支持
2. **Native Commands** - Discord 斜杠命令
3. **Exec Approvals** - 执行审批流

### 相关资源

- **官方实现参考**: ~/openclaw-official/
- **API 文档**: Discord Developer Portal
- **PluralKit API**: https://www.pluralkit.me/api/v2
- **功能分析报告**: ~/clawd/memory/功能实现分析报告_2026-02-04.md

## 3. Task Description

### 目标声明

为 clawdbot-discord-proxy 插件实现三个增强功能，提升用户体验和安全性。

### 交付物

#### Phase 1: PluralKit 支持

- [ ] **pluralkit.ts** - PluralKit API 客户端模块
  - [ ] 查询 PluralKit 消息信息
  - [ ] 支持认证令牌
  - [ ] 错误处理和降级处理

- [ ] **消息处理集成**
  - [ ] 在 gateway.ts 中检测 PluralKit 消息
  - [ ] 在 index.ts 中注入真实发送者信息
  - [ ] 单元测试覆盖

- [ ] **配置支持**
  - [ ] 在 config.ts 中添加 PluralKit 配置项
  - [ ] 更新 README.md 文档

#### Phase 2: Native Commands

- [ ] **命令注册模块**
  - [ ] register-commands.ts - Discord 命令注册
  - [ ] 支持命令参数定义
  - [ ] 支持自动补全（Autocomplete）

- [ ] **命令处理模块**
  - [ ] parse-command.ts - 命令和参数解析
  - [ ] handle-command.ts - 命令执行逻辑
  - [ ] 响应发送处理

- [ ] **Gateway 集成**
  - [ ] 在 gateway.ts 中监听 Interaction 事件
  - [ ] 命令超时处理
  - [ ] 错误恢复机制

- [ ] **命令列表**
  - [ ] `/oc-status` - 查看插件状态
  - [ ] `/oc-help` - 获取帮助信息
  - [ ] `/oc-reconnect` - 重新连接

- [ ] **配置支持**
  - [ ] 命令启用/禁用配置
  - [ ] 默认命令前缀 `oc-`

#### Phase 3: Exec Approvals

- [ ] **审批核心模块**
  - [ ] approval-types.ts - 类型定义
  - [ ] approval-manager.ts - 审批状态管理
  - [ ] approval-storage.ts - 持久化存储

- [ ] **风险检测**
  - [ ] command-safety.ts - 危险命令检测
  - [ ] 支持正则表达式匹配
  - [ ] 可配置的危险命令列表

- [ ] **审批请求处理**
  - [ ] build-approval-request.ts - 构建审批消息
  - [ ] send-approval.ts - 发送审批请求到 Discord
  - [ ] wait-approval.ts - 等待审批结果

- [ ] **交互处理**
  - [ ] handle-approval-button.ts - 处理 Button 点击
  - [ ] 审批超时处理
  - [ ] 决策记录和日志

- [ ] **配置支持**
  - [ ] 在 config.ts 中添加审批配置
  - [ ] 审批者用户 ID 列表
  - [ ] 超时时间配置

## 4. Constraints

### 技术约束

- **向后兼容**: 不能破坏现有功能
- **代码风格**: 遵循项目现有风格（TypeScript strict mode）
- **错误处理**: 所有异步操作必须有错误处理
- **日志记录**: 关键操作需要适当日志
- **代理支持**: 所有外部 API 调用必须通过代理（如果配置）

### 代码质量约束

- **测试覆盖**: 核心功能单元测试覆盖率 > 80%
- **类型安全**: 禁止使用 `any` 类型
- **文档**: 公开函数必须添加 JSDoc 注释
- **依赖最小化**: 尽量使用现有依赖，避免引入新包

### 非功能约束

- **性能**: 命令响应时间 < 3 秒
- **可靠性**: 审批超时机制必须可靠
- **安全性**: 审批请求中的敏感信息需要脱敏
- **可配置**: 所有功能必须可配置开关

## 5. Step-by-step Instructions

### Phase 1: PluralKit 支持

#### Step 1.1: 创建 PluralKit API 客户端

**文件**: `src/pluralkit.ts`

```typescript
// 类型定义
interface PluralKitConfig {
  enabled: boolean;
  token?: string;
}

interface PluralKitMessage {
  id: string;
  original?: string;
  sender?: string;
  system?: {
    id: string;
    name?: string;
    tag?: string;
  };
  member?: {
    id: string;
    name?: string;
    display_name?: string;
  };
}

// API 调用函数
export async function fetchPluralKitMessage(
  messageId: string,
  config: PluralKitConfig
): Promise<PluralKitMessage | null>
```

**实现要点**:
- 使用 Node.js 原生 `https` 模块
- 支持代理配置（通过 `process.env.DISCORD_PROXY`）
- 404 响应返回 `null`（非 PluralKit 消息）
- 其他错误抛出异常或返回 null

#### Step 1.2: 集成到消息处理

**文件**: `src/index.ts` 修改

**修改位置**:
```typescript
// 在 handleMessage 函数中
async function handleMessage(message: DiscordMessage) {
  // 新增：查询 PluralKit
  if (config.pluralkit?.enabled) {
    const pkInfo = await fetchPluralKitMessage(message.id, config.pluralkit);
    if (pkInfo) {
      message.pkInfo = pkInfo;
    }
  }
  
  // 现有逻辑...
}
```

**修改位置**:
```typescript
// 在 types.ts 中扩展 DiscordMessage
interface DiscordMessage {
  // ... 现有字段
  pkInfo?: PluralKitMessage;  // 新增
}
```

#### Step 1.3: 配置支持

**文件**: `src/config.ts` 修改

```typescript
interface Config {
  // ... 现有配置
  pluralkit?: {
    enabled: boolean;
    token?: string;
  };
}
```

**环境变量**:
```bash
# 可选配置
export PLURALKIT_ENABLED=true
export PLURALKIT_TOKEN="pk_xxx"
```

#### Step 1.4: 单元测试

**文件**: `src/tests/pluralkit.test.ts`

- 测试 PluralKit API 调用
- 测试代理支持
- 测试错误处理
- 测试降级处理（非 PluralKit 消息）

---

### Phase 2: Native Commands

#### Step 2.1: 创建命令注册模块

**文件**: `src/commands/register.ts`

**功能**:
```typescript
interface CommandOption {
  name: string;
  type: 'STRING' | 'INTEGER' | 'BOOLEAN';
  description: string;
  required?: boolean;
  choices?: { name: string; value: string }[];
  autocomplete?: boolean;
}

interface CommandDefinition {
  name: string;
  description: string;
  options?: CommandOption[];
}

export async function registerCommand(
  command: CommandDefinition,
  options: { appId: string; token: string }
): Promise<void>
```

**Discord API**:
```typescript
// PUT /applications/{application_id}/commands
{
  "name": "oc-status",
  "description": "查看插件状态",
  "options": [
    {
      "name": "detail",
      "type": 5, // BOOLEAN
      "description": "显示详细信息",
      "required": false
    }
  ]
}
```

#### Step 2.2: 创建命令处理模块

**文件**: `src/commands/handle.ts`

**功能**:
```typescript
// 解析命令参数
export function parseCommandOptions(
  interaction: Interaction
): Record<string, unknown>

// 执行命令
export async function executeCommand(
  commandName: string,
  args: Record<string, unknown>
): Promise<string>

// 发送响应
export async function respondCommand(
  interactionId: string,
  interactionToken: string,
  content: string
): Promise<void>
```

**命令处理器**:
```typescript
const commandHandlers: Record<string, CommandHandler> = {
  'oc-status': handleStatus,
  'oc-help': handleHelp,
  'oc-reconnect': handleReconnect,
};

async function handleStatus(args: Record<string, unknown>): Promise<string> {
  const detail = args.detail as boolean;
  return formatStatus(detail);
}
```

#### Step 2.3: Gateway 集成

**文件**: `src/gateway.ts` 修改

**新增事件处理**:
```typescript
interface InteractionCreateEvent {
  type: number;
  data: {
    id: string;
    name: string;
    options?: CommandOption[];
  };
  guild_id?: string;
  channel_id: string;
}

// 在 handleDispatch 中
case InteractionCreate:
  await handleInteractionCreate(event);
  break;
```

**命令前缀配置**:
```typescript
const COMMAND_PREFIX = 'oc-'; // 可配置
```

#### Step 2.4: 配置支持

**文件**: `src/config.ts` 修改

```typescript
interface Config {
  // ... 现有配置
  commands?: {
    enabled: boolean;
    prefix: string;  // 默认 'oc-'
    commands: {
      status: boolean;
      help: boolean;
      reconnect: boolean;
    };
  };
}
```

#### Step 2.5: 单元测试

**文件**: `src/tests/commands.test.ts`

- 测试命令注册
- 测试参数解析
- 测试命令处理器
- 测试响应发送

---

### Phase 3: Exec Approvals

#### Step 3.1: 创建审批类型定义

**文件**: `src/approvals/types.ts`

```typescript
interface ApprovalConfig {
  enabled: boolean;
  approvers: string[]; // Discord 用户 ID
  timeoutSeconds: number;
  agentFilter?: string[];
}

interface ApprovalRequest {
  id: string;
  command: string;
  cwd?: string;
  agentId: string;
  requester: string; // Discord 用户 ID
  status: 'pending' | 'approved' | 'denied';
  decision?: 'allow-once' | 'allow-always' | 'deny';
  createdAt: number;
  expiresAt: number;
}

type ApprovalDecision = 'allow-once' | 'allow-always' | 'deny';
```

#### Step 3.2: 创建危险命令检测

**文件**: `src/approvals/safety.ts`

```typescript
// 默认危险命令模式
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/,
  /sudo\s+/,
  /chmod\s+0[0-9]{3}/,
  /mkfs/,
  />\s*\/?dev/,
  /dd\s+/,
  /pkill\s+/,
  /killall\s+/,
];

export function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}

export function sanitizeCommand(command: string): string {
  // 脱敏处理，移除敏感信息
  return command
    .replace(/--token[=\s]+[\w-]+/g, '--token=<REDACTED>')
    .replace(/-k\s+['"][^'"]+['"]/g, '-k <REDACTED>');
}
```

#### Step 3.3: 创建审批管理器

**文件**: `src/approvals/manager.ts`

```typescript
class ApprovalManager {
  private approvals = new Map<string, ApprovalRequest>();
  
  async requestApproval(
    command: string,
    agentId: string,
    requester: string,
    cwd?: string
  ): Promise<ApprovalRequest>
  
  async waitForDecision(
    requestId: string,
    timeoutSeconds: number
  ): Promise<ApprovalDecision | null>
  
  handleDecision(
    requestId: string,
    decision: ApprovalDecision
  ): void
  
  cleanupExpired(): void
}
```

#### Step 3.4: 创建审批消息构建

**文件**: `src/approvals/message.ts`

```typescript
export function buildApprovalEmbed(
  request: ApprovalRequest
): DiscordEmbed {
  return {
    title: '🔒 执行审批请求',
    color: 0xFFA500,
    fields: [
      {
        name: '命令',
        value: `\`\`\`${sanitizeCommand(request.command)}\`\`\``,
        inline: false
      },
      {
        name: '工作目录',
        value: request.cwd || '默认',
        inline: true
      },
      {
        name: 'Agent',
        value: request.agentId,
        inline: true
      },
      {
        name: '超时',
        value: `${request.timeoutSeconds}秒`,
        inline: true
      }
    ]
  };
}

export function buildApprovalButtons(
  requestId: string
): DiscordActionRow[] {
  return [{
    type: 1,
    components: [
      {
        type: 2,
        style: 1, // PRIMARY
        custom_id: `${requestId}:allow-once`,
        label: '允许一次'
      },
      {
        type: 2,
        style: 2, // SUCCESS
        custom_id: `${requestId}:allow-always`,
        label: '始终允许'
      },
      {
        type: 2,
        style: 4, // DANGER
        custom_id: `${requestId}:deny`,
        label: '拒绝'
      }
    ]
  }];
}
```

#### Step 3.5: 创建审批请求发送

**文件**: `src/approvals/sender.ts`

```typescript
export async function sendApprovalRequest(
  approverIds: string[],
  embed: DiscordEmbed,
  buttons: DiscordActionRow[]
): Promise<void> {
  for (const approverId of approverIds) {
    await sendDiscordDM(approverId, {
      embeds: [embed],
      components: buttons
    });
  }
}
```

#### Step 3.6: 集成到执行流程

**文件**: `src/index.ts` 修改

```typescript
async function executeWithApproval(
  command: string,
  options: ExecOptions
): Promise<ExecResult> {
  // 检查是否需要审批
  if (!config.approvals?.enabled || !isDangerous(command)) {
    return executeDirect(command, options);
  }
  
  // 发送审批请求
  const request = await approvalManager.requestApproval(
    command,
    options.agentId,
    options.requester,
    options.cwd
  );
  
  // 等待审批
  const decision = await approvalManager.waitForDecision(
    request.id,
    config.approvals.timeoutSeconds
  );
  
  if (!decision || decision === 'deny') {
    throw new Error('执行被拒绝或超时');
  }
  
  // 执行命令
  return executeDirect(command, options);
}
```

#### Step 3.7: 处理 Button 交互

**文件**: `src/gateway.ts` 新增

```typescript
async function handleApprovalButton(
  customId: string,
  userId: string
): Promise<void> {
  const [requestId, action] = customId.split(':');
  
  // 验证审批者权限
  if (!config.approvals.approvers.includes(userId)) {
    await sendErrorDM(userId, '您没有审批权限');
    return;
  }
  
  await approvalManager.handleDecision(
    requestId,
    action as ApprovalDecision
  );
}
```

#### Step 3.8: 配置支持

**文件**: `src/config.ts` 修改

```typescript
interface Config {
  // ... 现有配置
  approvals?: {
    enabled: boolean;
    approvers: string[]; // Discord 用户 ID
    timeoutSeconds: number;
    dangerousCommands?: string[]; // 可选的自定义危险命令
  };
}
```

**环境变量**:
```bash
export APPROVALS_ENABLED=true
export APPROVALS_APPROVERS="123456789,987654321"
export APPROVALS_TIMEOUT=60
```

---

## 6. Examples

### Example 1: PluralKit 消息处理

**输入消息**:
```json
{
  "id": "1234567890",
  "content": "大家好！",
  "author": {
    "id": "333333333333333333",
    "username": "PluralKit"
  }
}
```

**处理结果**:
```typescript
const pkInfo = await fetchPluralKitMessage("1234567890", config);
// pkInfo = {
//   system: { id: "sys123", name: "FantasyRealm", tag: "[FR]" },
//   member: { id: "mem456", name: "Hero123", display_name: "亚瑟" },
//   sender: "111111111111111111"
// }

// 在消息中注入
message.author.realId = pkInfo.sender;
message.author.displayName = pkInfo.member?.display_name;
message.author.proxySystem = pkInfo.system?.tag;
```

**输出日志**:
```
[PluralKit] Message 1234567890 - System: FantasyRealm [FR], Member: Hero123 (亚瑟), Real User: 111111111111111111
```

### Example 2: Native Command 注册

**注册命令**:
```typescript
await registerCommand({
  name: "oc-status",
  description: "查看插件运行状态",
  options: [
    {
      name: "detail",
      type: "BOOLEAN",
      description: "显示详细信息",
      required: false
    }
  ]
}, { appId, token });
```

**用户交互**:
```
/oc-status detail:true

Bot 回复:
✅ 插件状态正常
- 连接: 已连接
- 服务器: 3
- 消息处理: 1,234
```

### Example 3: Exec Approval 流程

**危险命令**:
```
Agent 请求执行: rm -rf node_modules/
```

**审批请求**:
```
🔒 执行审批请求
━━━━━━━━━━━━━━━━━━━━━
命令: rm -rf node_modules/
工作目录: /home/tom/project
Agent: code-review-bot
超时: 60秒

[允许一次] [始终允许] [拒绝]
```

**用户点击 "允许一次"**:
```
✅ 审批通过
- 决策: 允许一次
- 审批者: User#1234
- 时间: 2026-02-04 03:15:08

>> 执行命令
```

---

## 7. Output Format

## 实现计划总结

### Phase 1: PluralKit 支持
**预计工期**: 3-5 天  
**代码行数**: ~200 行  
**优先级**: P0（最高）

### Phase 2: Native Commands
**预计工期**: 7-10 天  
**代码行数**: ~400 行  
**优先级**: P1

### Phase 3: Exec Approvals
**预计工期**: 5-7 天  
**代码行数**: ~350 行  
**优先级**: P2

### 总计
**预计工期**: 15-22 人天  
**代码行数**: ~950 行

---

## 实施检查清单

### Phase 1 检查清单
- [ ] pluralkit.ts 模块完成
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 文档更新
- [ ] PR 合并

### Phase 2 检查清单
- [ ] 命令注册模块完成
- [ ] 命令处理模块完成
- [ ] Gateway 集成完成
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 文档更新
- [ ] PR 合并

### Phase 3 检查清单
- [ ] 审批核心模块完成
- [ ] 危险命令检测完成
- [ ] 审批消息处理完成
- [ ] Gateway 集成完成
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 文档更新
- [ ] PR 合并

---

## 版本规划

| 版本 | 功能 | 描述 |
|------|------|------|
| v1.1.0 | PluralKit | 代理消息系统支持 |
| v1.2.0 | Native Commands | 斜杠命令支持 |
| v1.3.0 | Exec Approvals | 执行审批流 |
| v1.4.0 | 优化 | 性能优化、bug 修复 |

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Discord API 变更 | 中 | 定期检查 API 更新 |
| 审批状态丢失 | 中 | 实现持久化存储 |
| 命令冲突 | 低 | 使用前缀 `oc-` |
| 审批超时处理 | 中 | 可靠的超时机制和日志 |

---

## 资源依赖

### 内部依赖
- 功能分析报告: `~/clawd/memory/功能实现分析报告_2026-02-04.md`
- 官方实现参考: `~/openclaw-official/`

### 外部依赖
- Discord Developer Portal: https://discord.com/developers/applications
- PluralKit API 文档: https://www.pluralkit.me/api/v2

---

## 8. Evaluation Criteria

### 功能需求检查清单

#### Phase 1: PluralKit
- [ ] 能检测 PluralKit 代理消息
- [ ] 正确调用 PluralKit API
- [ ] 返回真实发送者信息
- [ ] 不影响现有消息处理流程
- [ ] 代理配置正确传递
- [ ] 单元测试覆盖率 > 80%

#### Phase 2: Native Commands
- [ ] 能注册斜杠命令到 Discord
- [ ] 能接收并解析命令交互
- [ ] 支持至少 3 种参数类型
- [ ] 命令响应时间 < 3 秒
- [ ] 错误处理完善
- [ ] 单元测试覆盖率 > 80%

#### Phase 3: Exec Approvals
- [ ] 能识别危险命令
- [ ] 审批请求正确发送到 Discord
- [ ] 能在超时前获取审批结果
- [ ] 审批按钮交互正确处理
- [ ] 审批日志完整
- [ ] 单元测试覆盖率 > 80%

### 代码质量检查清单

- [ ] TypeScript strict mode 通过
- [ ] ESLint 检查通过
- [ ] 无 `any` 类型使用
- [ ] 公开函数有 JSDoc 注释
- [ ] 错误处理完善
- [ ] 日志记录适当

### 非功能需求检查清单

- [ ] 性能: 命令响应 < 3 秒
- [ ] 可靠性: 审批超时机制可靠
- [ ] 安全性: 敏感信息脱敏
- [ ] 可配置: 所有功能可开关

---

## 9. Reference

### 相关文档

- 功能分析报告: `~/clawd/memory/功能实现分析报告_2026-02-04.md`
- 项目 README: `~/codes/README.md`
- 官方 Discord 插件: `~/openclaw-official/extensions/discord/`
- 官方 Discord 实现: `~/openclaw-official/src/discord/`

### API 文档

- Discord REST API: https://discord.com/developers/docs/reference
- Discord Gateway Events: https://discord.com/developers/docs/topics/gateway
- Discord Interactions: https://discord.com/developers/docs/interactions/receiving-and-responding
- PluralKit API: https://www.pluralkit.me/api/v2

### 工具和资源

- Discord 命令构建器: https://autopost.dl.gt/
- 正则表达式测试: https://regex101.com/
- TypeScript Playground: https://www.typescriptlang.org/play

---

## 附录

### A. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/pluralkit.ts` | 新增 | PluralKit API 客户端 |
| `src/commands/register.ts` | 新增 | 命令注册模块 |
| `src/commands/handle.ts` | 新增 | 命令处理模块 |
| `src/approvals/types.ts` | 新增 | 审批类型定义 |
| `src/approvals/manager.ts` | 新增 | 审批管理器 |
| `src/approvals/safety.ts` | 新增 | 危险命令检测 |
| `src/approvals/message.ts` | 新增 | 审批消息构建 |
| `src/approvals/sender.ts` | 新增 | 审批请求发送 |
| `src/types.ts` | 修改 | 扩展类型定义 |
| `src/config.ts` | 修改 | 添加配置项 |
| `src/gateway.ts` | 修改 | 集成新功能 |
| `src/index.ts` | 修改 | 集成新功能 |
| `README.md` | 修改 | 更新文档 |

### B. 配置示例

```json
{
  "pluralkit": {
    "enabled": true,
    "token": "pk_xxx"
  },
  "commands": {
    "enabled": true,
    "prefix": "oc-",
    "commands": {
      "status": true,
      "help": true,
      "reconnect": true
    }
  },
  "approvals": {
    "enabled": true,
    "approvers": ["123456789"],
    "timeoutSeconds": 60
  }
}
```

### C. 环境变量

```bash
# PluralKit
PLURALKIT_ENABLED=true
PLURALKIT_TOKEN=pk_xxx

# Commands
DISCORD_COMMANDS_ENABLED=true
DISCORD_COMMANDS_PREFIX=oc-

# Approvals
APPROVALS_ENABLED=true
APPROVALS_APPROVERS=123456789,987654321
APPROVALS_TIMEOUT=60
```

---

**文档版本**: 1.0  
**撰写日期**: 2026-02-04  
**作者**: Yoimiya  
**状态**: 待审核
