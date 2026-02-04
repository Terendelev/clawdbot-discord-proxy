/**
 * Built-in command handlers
 */

import { CommandHandler, CommandRegistry } from './types';
import { DiscordGateway } from '../gateway';

/**
 * Create builtin commands with gateway reference
 */
export function createBuiltinCommands(gateway: DiscordGateway): CommandRegistry {
  return {
    'oc-status': createStatusHandler(gateway),
    'oc-help': createHelpHandler(),
    'oc-reconnect': createReconnectHandler(gateway),
  };
}

/**
 * Handle /oc-status command
 */
function createStatusHandler(gateway: DiscordGateway): CommandHandler {
  return async (args: Record<string, unknown>) => {
    const detail = args.detail as boolean;
    const isConnected = gateway.isConnected?.() ?? false;

    if (detail) {
      const uptimeSeconds = Math.floor(process.uptime());
      const uptimeMinutes = Math.floor(uptimeSeconds / 60);
      const uptimeHours = Math.floor(uptimeMinutes / 60);

      let uptimeStr = '';
      if (uptimeHours > 0) {
        uptimeStr = `${uptimeHours}h ${uptimeMinutes % 60}m`;
      } else if (uptimeMinutes > 0) {
        uptimeStr = `${uptimeMinutes}m ${uptimeSeconds % 60}s`;
      } else {
        uptimeStr = `${uptimeSeconds}s`;
      }

      return `**插件状态**

- **连接状态**: ${isConnected ? '✅ 已连接' : '❌ 未连接'}
- **运行时间**: ${uptimeStr}
- **进程 ID**: ${process.pid}
- **内存使用**: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`;
    }

    return isConnected
      ? '✅ **插件状态**: 正常运行'
      : '⚠️ **插件状态**: 未连接';
  };
}

/**
 * Handle /oc-help command
 */
function createHelpHandler(): CommandHandler {
  return async () => {
    return `📚 **可用命令**

**斜杠命令** (以 \`/\` 开头):
- \`/oc-status\` - 查看插件运行状态
- \`/oc-status detail:true\` - 查看详细状态信息
- \`/oc-help\` - 显示此帮助信息
- \`/oc-reconnect\` - 重新连接 Discord Gateway

**消息命令** (在消息中回复):
- 无特殊消息命令

---
*Clawdbot Discord Proxy Plugin v1.1.0*`;
  };
}

/**
 * Handle /oc-reconnect command
 */
function createReconnectHandler(gateway: DiscordGateway): CommandHandler {
  return async () => {
    gateway.reconnect?.();
    return '🔄 **正在重新连接 Discord Gateway...**\n请稍候查看状态。';
  };
}
