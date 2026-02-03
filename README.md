# Clawdbot Discord Proxy Plugin

Discord channel plugin with proxy support for Clawdbot. Enables Discord messaging through SOCKS5 proxy for regions where Discord is blocked.

## Features

- **WebSocket Gateway** - Connect to Discord's real-time Gateway with heartbeat and auto-reconnect
- **REST API** - Full REST API wrapper for Discord endpoints (messages, channels, reactions, DMs)
- **Proxy Support** - HTTP proxy for REST API, SOCKS5 proxy for WebSocket Gateway
- **Auto-Reconnect** - Automatic reconnection with exponential backoff on disconnect
- **Message Events** - Ready, message, guild, and channel event handling

## Requirements

- Node.js 18+
- npm 9+
- A Discord bot token
- SOCKS5 proxy (if Discord is blocked in your region)

## Installation

### 1. Clone and Build

```bash
git clone https://github.com/Terendelev/clawdbot-discord-proxy.git
cd clawdbot-discord-proxy
npm install
npm run build
```

### 2. Configure Clawdbot

Add to your `~/.clawdbot/clawdbot.json`:

```json
{
  "channels": {
    "clawdbot-discord-proxy": {
      "enabled": true,
      "accounts": {
        "default": {
          "token": "YOUR_DISCORD_BOT_TOKEN",
          "enabled": true,
          "name": "Discord Bot"
        }
      },
      "proxyConfig": {
        "httpUrl": "http://PROXY_IP:PROXY_HTTP_PORT",
        "httpsUrl": "http://PROXY_IP:PROXY_HTTP_PORT",
        "wsUrl": "socks5://PROXY_IP:PROXY_SOCKS_PORT",
        "wssUrl": "socks5://PROXY_IP:PROXY_SOCKS_PORT",
        "noProxy": ["localhost", "127.0.0.1"]
      }
    }
  },
  "plugins": {
    "entries": {
      "clawdbot-discord-proxy": {
        "enabled": true,
        "source": "path",
        "sourcePath": "/path/to/clawdbot-discord-proxy"
      }
    }
  }
}
```

### 3. Set Discord Bot Permissions

Your bot needs these permissions:
- `Send Messages`
- `Read Message History`
- `Manage Messages` (optional)
- `Add Reactions` (optional)

### 4. Invite Bot to Server

Use this URL format (replace `YOUR_CLIENT_ID` and `YOUR_PERMISSIONS`):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=YOUR_PERMISSIONS&scope=bot
```

## Configuration Reference

### Channel Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channels.clawdbot-discord-proxy.accounts` | object | Yes | Account configurations |
| `channels.clawdbot-discord-proxy.proxyConfig` | object | No | Proxy settings |
| `proxyConfig.httpUrl` | string | No | HTTP/HTTPS proxy URL |
| `proxyConfig.wssUrl` | string | No | SOCKS5 proxy URL for WebSocket |

### Account Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | Discord bot token |
| `enabled` | boolean | Yes | Enable this account |
| `name` | string | No | Account display name |

### Proxy Configuration

The plugin requires different proxy types for different connections:

| Connection Type | Proxy Type | Configuration Field |
|----------------|------------|---------------------|
| REST API | HTTP/HTTPS | `proxyConfig.httpUrl` or `proxyConfig.httpsUrl` |
| WebSocket Gateway | SOCKS5 | `proxyConfig.wssUrl` (preferred) or `proxyConfig.wsUrl` |

**Example with proxy:**
```json
{
  "proxyConfig": {
    "httpUrl": "http://192.168.1.1:7890",
    "httpsUrl": "http://192.168.1.1:7890",
    "wsUrl": "socks5://192.168.1.1:7891",
    "wssUrl": "socks5://192.168.1.1:7891"
  }
}
```

## Architecture

```
clawdbot-discord-proxy/
├── src/
│   ├── index.ts           # Main plugin (Clawdbot integration)
│   ├── channel.ts         # Channel Plugin class
│   ├── gateway.ts         # Discord Gateway (WebSocket)
│   ├── api.ts             # Discord REST API client
│   ├── config.ts          # Configuration parsing
│   ├── types.ts           # TypeScript type definitions
│   └── tests/
│       ├── unit/
│       └── integration/
├── dist/                  # Compiled JavaScript
├── openclaw.plugin.json   # Plugin manifest
└── package.json
```

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Clawdbot Core                            │
│                  (channel.reply, etc.)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              DiscordChannelPlugin (channel.ts)              │
│                    Implements ChannelPlugin                 │
└─────────────────────────────────────────────────────────────┘
                    │                    │
                    ▼                    ▼
┌────────────────────────────────┐  ┌───────────────────────────┐
│     DiscordGateway (gateway.ts)│  │  DiscordApi (api.ts)     │
│  - WebSocket Connection        │  │  - REST API Calls         │
│  - Heartbeat/Keep-Alive        │  │  - Messages               │
│  - Auto-Reconnect              │  │  - Channels               │
│  - Event Emitter               │  │  - Reactions              │
└────────────────────────────────┘  └───────────────────────────┘
         │
         ▼ (SOCKS5 Proxy)
┌────────────────────────────────┐
│   Discord Gateway (wss://...)  │
│   via SOCKS5 Proxy             │
└────────────────────────────────┘
```

### Data Flow

```
Incoming Message:
Discord Gateway → handleMessage → handleDispatch → emit('message')
                    → channel.reply.dispatchReplyWithBufferedBlockDispatcher
                    → Agent Response → DiscordApi.createMessage

Outgoing Message:
clawdbot → outbound.sendText → DiscordApi.createMessage
```

## API Usage

### Using as Clawdbot Plugin

The plugin integrates automatically with Clawdbot. Messages are routed through the standard Clawdbot channel interface.

### Direct Usage (Standalone)

```typescript
import { DiscordGateway, createGateway } from './gateway';
import { DiscordApi, createApi } from './api';
import { GatewayIntent } from './types';

// Create Gateway with proxy support
const gateway = createGateway({
  token: 'YOUR_DISCORD_TOKEN',
  proxyUrl: 'socks5://PROXY_IP:PROXY_PORT',  // SOCKS5 for WebSocket
  intents: [
    GatewayIntent.GUILDS,
    GatewayIntent.GUILD_MESSAGES,
    GatewayIntent.DIRECT_MESSAGES,
    GatewayIntent.MESSAGE_CONTENT,
  ],
  autoReconnect: true,
  heartbeatInterval: 45000,
});

// Handle events
gateway.on('ready', (data) => {
  console.log(`Connected as ${data.user.username}#${data.user.discriminator}`);
});

gateway.on('message', (message) => {
  console.log(`[${message.author.username}] ${message.content}`);
});

gateway.on('reconnecting', () => {
  console.log('Attempting to reconnect...');
});

gateway.on('reconnected', () => {
  console.log('Reconnected successfully');
});

gateway.on('reconnectFailed', ({ error }) => {
  console.error('Reconnect failed:', error.message);
});

// Connect
await gateway.connect();

// Create API client for REST calls
const api = createApi('YOUR_DISCORD_TOKEN', 'http://PROXY_IP:PROXY_PORT');

// Send a message
await api.createMessage('CHANNEL_ID', 'Hello from Clawdbot!');

// Disconnect
await gateway.disconnect();
```

### Gateway Events

| Event | Data | Description |
|-------|------|-------------|
| `ready` | `{ user, guilds }` | Gateway connected and ready |
| `message` | `DiscordMessage` | New message received |
| `guildCreate` | `DiscordGuild` | Joined a guild |
| `guildDelete` | `{ id, unavailable? }` | Left a guild |
| `channelCreate` | `DiscordChannel` | Channel created |
| `channelDelete` | `DiscordChannel` | Channel deleted |
| `error` | `Error` | Connection error |
| `closed` | `{ code, reason }` | Connection closed |
| `reconnecting` | `void` | Attempting to reconnect |
| `reconnected` | `void` | Reconnected successfully |
| `reconnectFailed` | `{ error }` | Reconnect failed |

## Development

### Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run test         # Run all tests
npm run test:unit    # Run unit tests only
npm run lint         # Lint source files
```

### Testing

Integration tests require environment variables:

```bash
# Set test token and proxy
export DISCORD_TEST_TOKEN="your_test_token"
export DISCORD_WS_PROXY_URL="socks5://proxy_ip:port"

npm run test
```

### Proxy Connection Test

Test your proxy configuration:

```bash
node -e "
const WebSocket = require('ws');
const { SocksProxyAgent } = require('socks-proxy-agent');

const agent = new SocksProxyAgent('socks5://PROXY_IP:PROXY_PORT');
const ws = new WebSocket('wss://gateway.discord.gg', { agent });

ws.on('open', () => console.log('Connected!'));
ws.on('message', (data) => console.log('Received:', data.toString().substring(0, 100)));
ws.on('error', (err) => console.error('Error:', err.message));
ws.on('close', () => console.log('Closed'));

setTimeout(() => {
  console.log('Test complete');
  process.exit(0);
}, 10000);
"
```

## Troubleshooting

### Gateway Connection Timeout

1. Verify SOCKS5 proxy is running and accessible
2. Check firewall allows outbound WebSocket connections
3. Ensure bot token is valid and has correct permissions

```bash
# Test proxy connectivity
curl -x socks5://PROXY_IP:PROXY_PORT -I https://discord.com/api
```

### Messages Not Being Received

1. Verify intents include `GUILD_MESSAGES` and `MESSAGE_CONTENT`
2. Check bot has permissions to read channel
3. Review Clawdbot routing configuration

### Auto-Reconnect Not Working

1. Ensure `autoReconnect: true` in configuration
2. Check logs for `reconnecting` and `reconnected` events
3. Verify no `INVALID_INTENTS` close code (this disables reconnect)

## Dependencies

| Package | Purpose |
|---------|---------|
| `ws` | WebSocket client for Discord Gateway |
| `proxy-agent` | Unified proxy support (HTTP, HTTPS, SOCKS4, SOCKS5) |
| `socks-proxy-agent` | SOCKS5 proxy support for WebSocket |

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request
