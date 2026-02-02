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

// Describe account status
function describeAccount(account: DiscordAccount): {
  accountId: string;
  name: string | undefined;
  enabled: boolean;
  configured: boolean;
} {
  return {
    accountId: account?.accountId ?? 'default',
    name: account?.name,
    enabled: account?.enabled ?? true,
    configured: isConfigured(account),
  };
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
    describeAccount,
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
        const channelCfg = (cfg.channels as Record<string, Record<string, unknown>>)?.[PLUGIN_ID] ?? {};
        const proxyUrl = (channelCfg.proxyConfig as Record<string, string>)?.httpsUrl
          ?? channelCfg.proxyUrl;
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
  status: {
    describeAccount: (account: DiscordAccount, cfg: Record<string, unknown>) => {
      const runtime = getRuntime(account.accountId ?? 'default');
      const channelCfg = (cfg.channels as Record<string, Record<string, unknown>>)?.[PLUGIN_ID] ?? {};
      const proxyUrl = (channelCfg.proxyConfig as Record<string, string>)?.httpsUrl
        ?? channelCfg.proxyUrl;

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
