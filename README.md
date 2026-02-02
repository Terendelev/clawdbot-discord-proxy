# Clawdbot Discord Plugin

Discord channel plugin with proxy support for Clawdbot.

## Features

- **WebSocket Gateway Connection** - Connect to Discord's real-time Gateway with heartbeat and auto-reconnect
- **REST API Support** - Full REST API wrapper for Discord endpoints
- **Proxy Support** - Connect through HTTP/HTTPS/SOCKS proxies using `proxy-agent`
- **Message Handling** - Send/receive messages, reactions, and manage channels
- **Configuration Migration** - Built-in support for config format migration

## Quick Start

```bash
npm install
npm run build
npm run test
```

## Configuration

### OpenClaw Configuration

Add to your `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "clawdbot-discord": {
        "enabled": true,
        "config": {
          "token": "${DISCORD_TOKEN}",
          "proxyUrl": "${DISCORD_PROXY}",
          "intents": [
            "GUILD_MESSAGES",
            "DIRECT_MESSAGES",
            "MESSAGE_CONTENT"
          ],
          "autoReconnect": true,
          "heartbeatInterval": 45000
        }
      }
    }
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Discord bot token |
| `DISCORD_PROXY` | Proxy URL (e.g., `http://proxy:8080`) |

### Intent Reference

| Intent | Value | Description |
|--------|-------|-------------|
| `GUILDS` | 1 << 0 | Server events |
| `GUILD_MEMBERS` | 1 << 1 | Member join/leave events |
| `GUILD_MESSAGES` | 1 << 9 | Server message events |
| `DIRECT_MESSAGES` | 1 << 12 | DM events |
| `MESSAGE_CONTENT` | 1 << 15 | Message content access |

## Architecture

```
clawdbot-discord/
├── src/
│   ├── index.ts           # Plugin entry point
│   ├── channel.ts         # Channel Plugin implementation
│   ├── gateway.ts         # WebSocket Gateway handler
│   ├── api.ts             # REST API client
│   ├── config.ts          # Config parsing & validation
│   ├── types.ts           # TypeScript type definitions
│   └── tests/             # Unit tests
├── dist/                  # Compiled JavaScript output
├── openclaw.plugin.json   # Plugin manifest
├── tsconfig.json          # TypeScript configuration
├── jest.config.js         # Jest test configuration
└── package.json           # Dependencies & scripts
```

### Core Modules

| Module | Responsibility |
|--------|---------------|
| `DiscordChannelPlugin` | Main plugin class, implements `ChannelPlugin` interface |
| `DiscordGateway` | WebSocket connection, heartbeat, events, auto-reconnect |
| `DiscordApi` | REST API calls (messages, channels, reactions) |
| `Config` | Parse, validate, and migrate configuration |

## API Usage

### Basic Plugin Usage

```typescript
import { DiscordChannelPlugin } from './channel';

const plugin = new DiscordChannelPlugin();

// Initialize with config
await plugin.initialize({
  config: {
    token: 'your-bot-token',
    intents: ['GUILD_MESSAGES', 'DIRECT_MESSAGES'],
    proxyUrl: 'http://proxy:8080'
  }
});

// Connect to Discord
await plugin.connect();

// Handle incoming messages
plugin.onMessage((message) => {
  console.log(`Received: ${message.content}`);
});

// Send a message
await plugin.sendMessage('channel-id', 'Hello World!');

// Disconnect
await plugin.disconnect();
```

### Direct Gateway Access

```typescript
const gateway = plugin.getGateway();
gateway.on('ready', (data) => {
  console.log(`Connected as ${data.user.username}`);
});
```

### Direct API Access

```typescript
const api = plugin.getApi();

// Get channel info
const channel = await api.getChannel('channel-id');

// Send rich embed
await api.createMessage('channel-id', '', {
  embeds: [{
    title: 'Hello',
    description: 'This is an embed',
    color: 0x5865F2
  }]
});
```

## Dependencies

- `proxy-agent` - Proxy support for HTTP/WebSocket
- `ws` - WebSocket client
- `typescript` - TypeScript compiler
- `jest` - Testing framework
- `ts-jest` - TypeScript Jest transformer

## License

MIT
