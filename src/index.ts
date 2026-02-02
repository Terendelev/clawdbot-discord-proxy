/**
 * Clawdbot Discord Plugin
 *
 * Discord channel plugin with proxy support for Clawdbot.
 */

import { DiscordGateway, createGateway } from './gateway';
import { DiscordApi, createApi } from './api';
import { parseConfig, validateConfig, DEFAULT_CONFIG } from './config';
import {
  DiscordPluginConfig,
  DiscordMessage,
  GatewayIntent,
} from './types';

export { DiscordChannelPlugin } from './channel';
export { DiscordChannelPlugin as plugin } from './channel';
export * from './types';
export * from './config';

// Plugin ID constant
const PLUGIN_ID = 'clawdbot-discord-proxy';

// Account types
interface DiscordAccount {
  accountId?: string;
  token?: string;
  enabled?: boolean;
  name?: string;
}

interface DiscordChannelConfig {
  accounts?: Record<string, DiscordAccount>;
  proxyConfig?: {
    httpUrl?: string;
    httpsUrl?: string;
    wsUrl?: string;
    wssUrl?: string;
    noProxy?: string[];
  };
  proxyUrl?: string;
}

// List account IDs from config
function listAccountIds(cfg: Record<string, unknown>): string[] {
  const channelCfg = (cfg.channels as Record<string, unknown>)?.[PLUGIN_ID] as DiscordChannelConfig | undefined;
  return Object.keys(channelCfg?.accounts ?? {});
}

// Resolve account from config
function resolveAccount(cfg: Record<string, unknown>, accountId?: string): DiscordAccount {
  const channelCfg = (cfg.channels as Record<string, unknown>)?.[PLUGIN_ID] as DiscordChannelConfig | undefined;
  const account = channelCfg?.accounts?.[accountId ?? 'default'];
  return account ?? { accountId: accountId ?? 'default' };
}

// Check if account is configured
function isConfigured(account: DiscordAccount): boolean {
  return Boolean(account?.token?.trim());
}

// Get proxy URL from config
function getProxyUrl(cfg: Record<string, unknown>): string | undefined {
  const channelCfg = (cfg.channels as Record<string, DiscordChannelConfig>)?.[PLUGIN_ID];
  return channelCfg?.proxyConfig?.httpsUrl ?? channelCfg?.proxyUrl;
}

// Runtime state for each account
const runtimeState = new Map<string, {
  gateway: DiscordGateway | null;
  api: DiscordApi | null;
  connected: boolean;
}>();

// Get or create runtime for account
function getRuntime(accountId: string) {
  if (!runtimeState.has(accountId)) {
    runtimeState.set(accountId, {
      gateway: null,
      api: null,
      connected: false,
    });
  }
  return runtimeState.get(accountId)!;
}

// Clawdbot Discord Channel Plugin
const discordPlugin = {
  id: PLUGIN_ID,
  meta: {
    id: PLUGIN_ID,
    label: 'Discord Proxy',
    selectionLabel: 'Discord Proxy',
    docsPath: '/docs/channels/clawdbot-discord-proxy',
    blurb: 'Discord channel with proxy support',
    order: 20,
  },
  capabilities: {
    chatTypes: ['direct', 'channel'],
    polls: false,
    reactions: true,
    threads: true,
    media: true,
  },
  config: {
    listAccountIds,
    resolveAccount,
    defaultAccountId: () => 'default',
    isConfigured,
    describeAccount: (account: DiscordAccount) => ({
      accountId: account?.accountId ?? 'default',
      name: account?.name,
      enabled: account?.enabled ?? true,
      configured: isConfigured(account),
    }),
  },
  outbound: {
    deliveryMode: 'direct',
    textChunkLimit: 2000,
    sendText: async ({ to, text, accountId, replyToId, cfg }: {
      to: string;
      text: string;
      accountId?: string;
      replyToId?: string;
      cfg: Record<string, unknown>;
    }) => {
      const account = resolveAccount(cfg, accountId);
      const runtime = getRuntime(accountId ?? 'default');

      if (!runtime.api) {
        const proxyUrl = getProxyUrl(cfg);
        runtime.api = createApi(account.token!, proxyUrl);
      }

      try {
        await runtime.api.createMessage(to, text, replyToId ? { message_reference: { message_id: replyToId } } : undefined);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: (error as Error).message };
      }
    },
  },
  gateway: {
    start: async ({ accountId, cfg }: { accountId?: string; cfg: Record<string, unknown> }) => {
      const account = resolveAccount(cfg, accountId);
      const runtime = getRuntime(accountId ?? 'default');
      const proxyUrl = getProxyUrl(cfg);

      // Create gateway
      const pluginConfig: DiscordPluginConfig = {
        ...DEFAULT_CONFIG,
        token: account.token!,
        proxyUrl,
        intents: [
          GatewayIntent.GUILDS,
          GatewayIntent.GUILD_MESSAGES,
          GatewayIntent.DIRECT_MESSAGES,
          GatewayIntent.MESSAGE_CONTENT,
        ],
        autoReconnect: true,
        heartbeatInterval: 45000,
      };

      runtime.gateway = createGateway(pluginConfig);

      // Set up event handlers
      runtime.gateway.on('ready', () => {
        runtime.connected = true;
        console.log(`[${PLUGIN_ID}] Connected to Discord`);
      });

      runtime.gateway.on('message', (message: DiscordMessage) => {
        console.log(`[${PLUGIN_ID}] Received message from ${message.author.username}: ${message.content?.substring(0, 50)}...`);
      });

      runtime.gateway.on('error', (error: Error) => {
        console.error(`[${PLUGIN_ID}] Gateway error:`, error.message);
        runtime.connected = false;
      });

      runtime.gateway.on('closed', () => {
        runtime.connected = false;
        console.log(`[${PLUGIN_ID}] Gateway closed`);
      });

      // Connect
      await runtime.gateway.connect();
      return { ok: true };
    },
    stop: async ({ accountId }: { accountId?: string }) => {
      const runtime = getRuntime(accountId ?? 'default');
      if (runtime.gateway) {
        await runtime.gateway.disconnect();
        runtime.gateway = null;
        runtime.connected = false;
      }
      return { ok: true };
    },
    isRunning: ({ accountId }: { accountId?: string }) => {
      const runtime = getRuntime(accountId ?? 'default');
      return runtime.connected;
    },
  },
  status: {
    describeAccount: (account: DiscordAccount, cfg: Record<string, unknown>) => {
      const runtime = getRuntime(account.accountId ?? 'default');
      const proxyUrl = getProxyUrl(cfg);

      return {
        accountId: account.accountId ?? 'default',
        name: account.name,
        enabled: account.enabled ?? true,
        configured: isConfigured(account),
        proxyConfigured: Boolean(proxyUrl),
        running: runtime.connected,
        connected: runtime.connected,
        lastConnectedAt: null,
        lastError: null,
      };
    },
  },
};

// OpenClaw plugin entry
export default {
  id: PLUGIN_ID,
  name: 'Discord Proxy',
  description: 'Discord channel with proxy support',
  register(api: unknown): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).registerChannel({ plugin: discordPlugin });
  },
};
