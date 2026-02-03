# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clawdbot Discord plugin with proxy support. Implements the Channel Plugin interface for OpenClaw SDK.

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run test         # Run all tests
npm run test:unit    # Run unit tests only
npm run lint         # Lint source files
```

## Architecture

**Core Modules:**
- `src/channel.ts` - Main Channel Plugin implementation, entry point for OpenClaw
- `src/gateway.ts` - WebSocket Gateway connection with proxy support, heartbeat, auto-reconnect
- `src/api.ts` - REST API client for Discord API calls
- `src/config.ts` - Configuration parsing, validation, migration utilities
- `src/types.ts` - TypeScript type definitions for Discord structures

**Configuration:**
- `openclaw.plugin.json` - Plugin manifest for OpenClaw
- `tsconfig.json` - TypeScript configuration (strict mode, CommonJS modules)
- `jest.config.js` - Jest test configuration with ts-jest

**Key Classes:**
- `DiscordChannelPlugin` - Implements `ChannelPlugin` interface
- `DiscordGateway` - Manages WebSocket connection with proxy support
- `DiscordApi` - REST API wrapper with proxy support

**Proxy Support:**
- Configured via `proxyUrl` in plugin config
- Falls back to `DISCORD_PROXY` environment variable
- Uses `proxy-agent` library for HTTP/HTTPS/WebSocket proxying

## Session Documentation

**SESSION_SUMMARY_2026-02-03.md** - Records the 2026-02-03 session where Gateway auto-reconnect issues were fixed. Contains:
- Problem diagnosis and root cause analysis
- Code changes made (gateway.ts, index.ts, api.ts)
- Configuration format updates
- Git commits and testing results
- Notes for future development

**SESSION_SUMMARY_2026-02-03b.md** - Records the 2026-02-03b session for file upload bug fix:
- Missing sendFile method in ChannelPlugin interface
- Implementation of sendFile in DiscordChannelPlugin
- Bug report analysis (discord-file-send-bug-report-20260203.md)
- Test results and usage examples

**SESSION_SUMMARY_2026-02-03b.md (evening update)** - Records the 2026-02-03 evening session:
- sendMedia path parameter support fix
- TypeScript error fixes in unit tests
- Target resolution for Discord DM targets
- Added `messaging.normalizeTarget` and `messaging.targetResolver`
- New test file: `src/tests/target-resolution.test.ts` (30 tests)
- 98 unit tests passing
