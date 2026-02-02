# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Integration tests for Discord connection via proxy (`src/tests/proxy-connection.test.ts`)
- `getProxyAgent` export from gateway module for testing

### Fixed
- **Proxy Agent Import**: Fixed `https-proxy-agent` import using named export `HttpsProxyAgent`
- **URL Construction**: Fixed `new URL(path, baseUrl)` to properly concatenate base URL and path using template literal
- **Plugin Entry Point**: Added `export default` function for OpenClaw plugin loading
- **Plugin ID**: Corrected plugin ID to `clawdbot-discord-proxy` to avoid conflicts with native Discord plugin

### Changed
- Use `https-proxy-agent` instead of `proxy-agent` for better HTTP/HTTPS proxy support
- Updated plugin name in `openclaw.plugin.json`, `channel.ts`, and `README.md`

### Verified
- Successfully connected to Discord via proxy `http://192.168.2.6:7890`
- Retrieved DM history for user zenk (ID: 988274067054428171)
- Sent reply to user through Discord API using proxy

---

## [1.0.0] - 2026-02-01

### Added
- Initial implementation of Clawdbot Discord Plugin
- WebSocket Gateway connection with heartbeat and auto-reconnect
- REST API wrapper for Discord endpoints (messages, channels, reactions, users)
- Proxy support via environment variable or config (`proxyUrl`)
- Configuration parsing, validation, and migration utilities
- TypeScript type definitions for Discord structures
- Unit tests for config, gateway, API, and channel modules
- OpenClaw plugin manifest (`openclaw.plugin.json`)

### Features
- `DiscordGateway`: WebSocket connection, heartbeat (45s), auto-reconnect with exponential backoff
- `DiscordApi`: Full REST API wrapper supporting messages, channels, reactions, DMs
- `DiscordChannelPlugin`: Channel Plugin implementation for OpenClaw SDK
- Configuration via `openclaw.json` or environment variables
- Proxy support for HTTP, HTTPS, and SOCKS proxies

### Plugin Configuration
```json
{
  "plugins": {
    "entries": {
      "clawdbot-discord-proxy": {
        "enabled": true,
        "config": {
          "token": "${DISCORD_TOKEN}",
          "proxyUrl": "${DISCORD_PROXY}",
          "intents": ["GUILD_MESSAGES", "DIRECT_MESSAGES", "MESSAGE_CONTENT"],
          "autoReconnect": true,
          "heartbeatInterval": 45000
        }
      }
    }
  }
}
```

---

## Technical Details

### Dependencies
- `proxy-agent` - Proxy support for HTTP/WebSocket (replaced with `https-proxy-agent`)
- `ws` - WebSocket client
- `typescript` - TypeScript compiler
- `jest` - Testing framework
- `ts-jest` - TypeScript Jest transformer

### Architecture
```
clawdbot-discord/
├── src/
│   ├── channel.ts      # Channel Plugin implementation
│   ├── gateway.ts      # WebSocket Gateway handler
│   ├── api.ts          # REST API client
│   ├── config.ts       # Config parsing & validation
│   ├── types.ts        # TypeScript type definitions
│   └── tests/          # Unit & integration tests
├── openclaw.plugin.json # Plugin manifest
├── tsconfig.json       # TypeScript configuration
└── README.md           # Documentation
```

---

## Testing Results

### Unit Tests (26 tests passing)
- `config.test.ts`: Configuration parsing and validation
- `gateway.test.ts`: Gateway intent calculation, proxy agent
- `api.test.ts`: API client creation and options
- `channel.test.ts`: Plugin initialization and message handling

### Integration Tests (6 tests passing)
- Gateway connection through proxy
- API requests through proxy
- Plugin initialization with proxy configuration

### Live Test Results
- **Bot**: Areelu Vorlesh#0899 (ID: 1466684875728883844)
- **Proxy**: http://192.168.2.6:7890
- **DM History**: Successfully retrieved 20 messages from user zenk
- **Reply**: Successfully sent reply to user via proxy

---

[Unreleased]: https://github.com/Terendelev/clawdbot-discord-proxy/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Terendelev/clawdbot-discord-proxy/releases/tag/v1.0.0
