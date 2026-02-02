# Clawdbot Discord Proxy Plugin

Discord channel plugin with proxy support for Clawdbot.

## Features

- **WebSocket Gateway Connection** - Connect to Discord's real-time Gateway with heartbeat and auto-reconnect
- **REST API Support** - Full REST API wrapper for Discord endpoints
- **Message Handling** - Send/receive messages, reactions, and manage channels
- **Group & DM Support** - Server channels and direct messages with flexible policies

## Quick Start

```bash
npm install
npm run build
npm run test
```

## Configuration

Add to your Clawdbot configuration file (e.g., `~/.clawdbot/clawdbot-proxy.json`):

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "${DISCORD_TOKEN}",
      "groupPolicy": "open",
      "dm": {
        "policy": "pairing",
        "allowFrom": ["*"]
      }
    }
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Discord bot token |

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `channels.discord.enabled` | boolean | Enable Discord channel |
| `channels.discord.token` | string | Discord bot token |
| `channels.discord.groupPolicy` | string | Group message policy (`open` or `restricted`) |
| `channels.discord.dm.policy` | string | DM policy (`pairing` for auto-pairing) |
| `channels.discord.dm.allowFrom` | array | Allowed DM users (`*` for all) |

## Architecture

```
clawdbot-discord-proxy/
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
