# Clawdbot Discord Proxy Plugin

Discord 频道插件，支持通过代理连接 Discord，适用于 Discord 被封锁的地区。

## 功能特性

- **WebSocket Gateway** - 通过代理连接 Discord 实时网关，支持心跳和自动重连
- **REST API** - 完整的 Discord REST API 封装（消息、频道、反应、DM）
- **代理支持** - HTTP/HTTPS 代理用于 REST API，SOCKS5 代理用于 WebSocket
- **PluralKit 支持** - 自动识别和处理 PluralKit 代理消息
- **执行审批** - 危险命令需要 Discord 审批确认
- **文件上传** - 支持通过 Discord 发送文件和媒体

## 环境要求

- Node.js 18+
- npm 9+
- Discord Bot Token
- SOCKS5 代理（如果 Discord 被封锁）

## 安装到 Clawdbot

### 方式一：从源码安装（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/Terendelev/clawdbot-discord-proxy.git
cd clawdbot-discord-proxy

# 2. 安装依赖并编译
npm install
npm run build

# 3. 复制到 Clawdbot 插件目录
cp -r dist ~/.clawdbot/extensions/clawdbot-discord-proxy/

# 4. 重启 Gateway
clawdbot gateway restart
```

### 方式二：手动安装

```bash
# 1. 编译项目
cd /home/tom/codes
npm run build

# 2. 复制编译产物
cp dist/index.js dist/index.d.ts ~/.clawdbot/extensions/clawdbot-discord-proxy/dist/

# 3. 重启 Gateway
clawdbot gateway restart
```

## 配置 Clawdbot

编辑 `~/.clawdbot/clawdbot.json`，在 `channels` 和 `plugins` 部分添加配置：

```json
{
  "channels": {
    "clawdbot-discord-proxy": {
      "accounts": {
        "default": {
          "token": "YOUR_DISCORD_BOT_TOKEN",
          "enabled": true,
          "name": "Clawdbot Discord"
        }
      },
      "proxyConfig": {
        "httpUrl": "http://PROXY_IP:HTTP_PORT",
        "httpsUrl": "http://PROXY_IP:HTTP_PORT",
        "wsUrl": "socks5://PROXY_IP:SOCKS_PORT",
        "wssUrl": "socks5://PROXY_IP:SOCKS_PORT",
        "noProxy": ["localhost", "127.0.0.1"]
      },
      "pluralkit": {
        "enabled": true
      },
      "approvals": {
        "enabled": true,
        "approvers": ["DISCORD_USER_ID"],
        "timeoutSeconds": 60
      }
    }
  },
  "plugins": {
    "entries": {
      "clawdbot-discord-proxy": {
        "enabled": true
      }
    }
  }
}
```

### 配置说明

| 配置项 | 说明 |
|--------|------|
| `token` | Discord Bot Token |
| `httpUrl` / `httpsUrl` | HTTP/HTTPS 代理地址（REST API 用） |
| `wsUrl` / `wssUrl` | SOCKS5 代理地址（WebSocket 用） |
| `pluralkit.enabled` | 是否启用 PluralKit 支持 |
| `approvals.enabled` | 是否启用执行审批 |
| `approvers` | 有审批权限的 Discord 用户 ID 列表 |

## Discord Bot 权限配置

Bot 需要以下权限：
- `Send Messages` - 发送消息
- `Read Message History` - 读取消息历史
- `Manage Messages` - 管理消息（可选）
- `Add Reactions` - 添加反应（可选）

邀请链接格式：
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=YOUR_PERMISSIONS&scope=bot
```

## 发送消息

### 使用 CLI

```bash
# 发送文本消息
clawdbot message send -m "Hello" -t user:USER_ID --channel clawdbot-discord-proxy

# 发送文件
clawdbot message send --media "/path/to/file.jpg" -m "Image" -t user:USER_ID --channel clawdbot-discord-proxy
```

### 使用 curl（推荐用于文件）

```bash
# 获取 Token
TOKEN=$(cat ~/.clawdbot/clawdbot-proxy.json | grep -o '"token": "[^"]*' | cut -d'"' -f4 | head -1)

# 发送文件
curl -X POST "https://discord.com/api/v10/channels/CHANNEL_ID/messages" \
  -H "Authorization: Bot $TOKEN" \
  -F "file=@/path/to/file" \
  -F "content=Your message"
```

## 目录结构

```
clawdbot-discord-proxy/
├── src/
│   ├── index.ts           # 主入口，Clawdbot 集成
│   ├── channel.ts         # Channel Plugin 实现
│   ├── gateway.ts         # Discord WebSocket Gateway
│   ├── api.ts             # Discord REST API 客户端
│   ├── config.ts          # 配置解析
│   ├── types.ts           # TypeScript 类型定义
│   ├── pluralkit.ts       # PluralKit API 客户端
│   ├── commands/          # 斜杠命令模块
│   └── approvals/         # 执行审批模块
├── dist/                  # 编译输出
├── package.json
└── README.md
```

## 开发

```bash
npm install          # 安装依赖
npm run build        # 编译 TypeScript
npm run test         # 运行测试
npm run lint         # 代码检查
```

## 常见问题

### 1. Gateway 连接超时
- 检查 SOCKS5 代理是否正常运行
- 验证 Bot Token 是否有效
- 确保防火墙允许 WebSocket 连接

### 2. 消息发送失败
- 检查 Bot 是否有发送消息权限
- 确认目标用户已有与 Bot 的 DM 频道
- 查看日志：`tail -50 /tmp/clawdbot/clawdbot-*.log`

### 3. 代理配置不生效
- 确认代理地址和端口正确
- 检查 `noProxy` 列表是否包含必要地址
- 验证代理类型（HTTP vs SOCKS5）

## 相关链接

- [GitHub 仓库](https://github.com/Terendelev/clawdbot-discord-proxy)
- [Clawdbot 文档](https://docs.clawd.bot)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [PluralKit 文档](https://www.pluralkit.me/api/v2)

## License

MIT License
