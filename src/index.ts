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

// Plugin runtime for accessing clawdbot internals
let pluginRuntime: any = null;

export function setDiscordPluginRuntime(runtime: any): void {
  pluginRuntime = runtime;
}

export function getDiscordPluginRuntime(): any {
  if (!pluginRuntime) {
    throw new Error('Discord plugin runtime not initialized');
  }
  return pluginRuntime;
}

// Runtime state for each account
const runtimeState = new Map<string, {
  gateway: DiscordGateway | null;
  api: DiscordApi | null;
  connected: boolean;
  account?: DiscordAccount;
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
  reload: { configPrefixes: ['channels.clawdbot-discord-proxy'] },
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
      const accountIdStr = accountId ?? 'default';
      const account = resolveAccount(cfg, accountIdStr);
      const runtime = getRuntime(accountIdStr);

      // Ensure API is created
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
    sendMedia: async ({ to, text, mediaUrl, accountId, cfg }: {
      to: string;
      text?: string;
      mediaUrl: string;
      accountId?: string;
      cfg: Record<string, unknown>;
    }) => {
      const accountIdStr = accountId ?? 'default';
      const account = resolveAccount(cfg, accountIdStr);
      const runtime = getRuntime(accountIdStr);

      // Ensure API is created
      if (!runtime.api) {
        const proxyUrl = getProxyUrl(cfg);
        runtime.api = createApi(account.token!, proxyUrl);
      }

      try {
        // Discord requires uploading media via attachments
        // For now, just send the text with media URL
        const messageText = text ? `${text}\n${mediaUrl}` : mediaUrl;
        await runtime.api.createMessage(to, messageText);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: (error as Error).message };
      }
    },
  },
  gateway: {
    startAccount: async (ctx: {
      account: DiscordAccount;
      abortSignal: AbortSignal;
      log?: {
        info: (msg: string) => void;
        error: (msg: string) => void;
        debug?: (msg: string) => void;
      };
      cfg: Record<string, unknown>;
      setStatus: (status: any) => void;
      getStatus: () => any;
    }) => {
      const { account, abortSignal, log, cfg, setStatus, getStatus } = ctx;
      const accountId = account.accountId ?? 'default';

      log?.info(`[${PLUGIN_ID}:${accountId}] Starting gateway`);

      const runtime = getRuntime(accountId);
      runtime.account = account;

      const proxyUrl = getProxyUrl(cfg);
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
      runtime.gateway.on('ready', (data: { user: { username: string; discriminator: string } }) => {
        runtime.connected = true;
        log?.info(`[${PLUGIN_ID}:${accountId}] Connected as ${data.user.username}#${data.user.discriminator}`);
        setStatus({
          ...getStatus(),
          running: true,
          connected: true,
          lastConnectedAt: Date.now(),
        });
      });

      runtime.gateway.on('message', async (message: DiscordMessage) => {
        log?.info(`[${PLUGIN_ID}:${accountId}] Received message from ${message.author.username}: ${message.content?.substring(0, 50)}...`);

        // Record activity
        try {
          const runtime = getDiscordPluginRuntime();
          runtime.channel.activity.record({
            channel: PLUGIN_ID,
            accountId,
            direction: 'inbound',
          });
        } catch (e) {
          // Ignore if runtime not available
        }

        // Check if message should be ignored (bot messages, etc.)
        if (message.author.bot) {
          return;
        }

        const isDm = !message.guild_id;
        const peerId = isDm ? `discord:${message.author.id}` : `discord:channel:${message.channel_id}`;

        try {
          const runtime = getDiscordPluginRuntime();

          // Resolve agent route
          const route = runtime.channel.routing.resolveAgentRoute({
            cfg,
            channel: PLUGIN_ID,
            accountId,
            peer: {
              kind: isDm ? 'dm' : 'channel',
              id: peerId,
            },
          });

          const envelopeOptions = runtime.channel.reply.resolveEnvelopeFormatOptions(cfg);

          // Format the message body
          const messageBody = message.content || '';

          // Create inbound envelope
          const body = runtime.channel.reply.formatInboundEnvelope({
            channel: 'Discord',
            from: `${message.author.username}#${message.author.discriminator}`,
            timestamp: new Date(message.timestamp).getTime(),
            body: messageBody,
            chatType: isDm ? 'direct' : 'channel',
            sender: {
              id: message.author.id,
              name: `${message.author.username}#${message.author.discriminator}`,
            },
            envelope: envelopeOptions,
          });

          const fromAddress = isDm ? `discord:${message.author.id}` : `discord:channel:${message.channel_id}`;
          const toAddress = fromAddress;

          // Create context payload
          const ctxPayload = runtime.channel.reply.finalizeInboundContext({
            Body: body,
            RawBody: message.content || '',
            CommandBody: message.content || '',
            From: fromAddress,
            To: toAddress,
            SessionKey: route.sessionKey,
            AccountId: route.accountId,
            ChatType: isDm ? 'direct' : 'channel',
            SenderId: message.author.id,
            SenderName: `${message.author.username}#${message.author.discriminator}`,
            Provider: PLUGIN_ID,
            Surface: PLUGIN_ID,
            MessageSid: message.id,
            Timestamp: new Date(message.timestamp).getTime(),
            OriginatingChannel: PLUGIN_ID,
            OriginatingTo: toAddress,
            DiscordChannelId: message.channel_id,
            DiscordGuildId: message.guild_id,
          });

          // Get messages config
          const messagesConfig = runtime.channel.reply.resolveEffectiveMessagesConfig(cfg, route.agentId);

          // Track if we got a response
          let hasResponse = false;
          const responseTimeout = 60000; // 60 seconds timeout
          let timeoutId: ReturnType<typeof setTimeout> | null = null;

          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              if (!hasResponse) {
                reject(new Error('Response timeout'));
              }
            }, responseTimeout);
          });

          const dispatchPromise = runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: ctxPayload,
            cfg,
            dispatcherOptions: {
              responsePrefix: messagesConfig.responsePrefix,
              deliver: async (payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string }) => {
                hasResponse = true;
                if (timeoutId) {
                  clearTimeout(timeoutId);
                  timeoutId = null;
                }

                log?.info(`[${PLUGIN_ID}:${accountId}] deliver called`);

                let replyText = payload.text ?? '';

                try {
                  const rt = getDiscordPluginRuntime();

                  // Send reply via API
                  if (replyText.trim()) {
                    await rt.api.messages.create({
                      channelId: message.channel_id,
                      content: replyText,
                      messageReference: { messageId: message.id },
                    });
                    log?.info(`[${PLUGIN_ID}:${accountId}] Sent reply`);
                  }

                  rt.channel.activity.record({
                    channel: PLUGIN_ID,
                    accountId,
                    direction: 'outbound',
                  });
                } catch (err) {
                  log?.error(`[${PLUGIN_ID}:${accountId}] Failed to send reply: ${err}`);
                }
              },
              onError: async (err: unknown) => {
                log?.error(`[${PLUGIN_ID}:${accountId}] Dispatch error: ${err}`);
                hasResponse = true;
                if (timeoutId) {
                  clearTimeout(timeoutId);
                  timeoutId = null;
                }
              },
            },
            replyOptions: {},
          });

          // Wait for dispatch or timeout
          try {
            await Promise.race([dispatchPromise, timeoutPromise]);
          } catch (err) {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            if (!hasResponse) {
              log?.error(`[${PLUGIN_ID}:${accountId}] No response within timeout`);
            }
          }
        } catch (err) {
          log?.error(`[${PLUGIN_ID}:${accountId}] Message processing failed: ${err}`);
        }
      });

      runtime.gateway.on('error', (error: Error) => {
        log?.error(`[${PLUGIN_ID}:${accountId}] Gateway error: ${error.message}`);
        runtime.connected = false;
        setStatus({
          ...getStatus(),
          lastError: error.message,
        });
      });

      runtime.gateway.on('closed', () => {
        runtime.connected = false;
        log?.info(`[${PLUGIN_ID}:${accountId}] Gateway closed`);
        setStatus({
          ...getStatus(),
          running: false,
          connected: false,
        });
      });

      // Connect
      await runtime.gateway.connect();

      // Wait for abort signal
      return new Promise<void>((resolve) => {
        abortSignal.addEventListener('abort', () => {
          runtime.gateway?.disconnect();
          resolve();
        });
      });
    },
  },
  status: {
    defaultRuntime: {
      accountId: 'default',
      running: false,
      connected: false,
      lastConnectedAt: null,
      lastError: null,
    },
    buildAccountSnapshot: ({ account, runtime }: { account: DiscordAccount; runtime: any }) => ({
      accountId: account?.accountId ?? 'default',
      name: account?.name,
      enabled: account?.enabled ?? true,
      configured: isConfigured(account),
      running: runtime?.running ?? false,
      connected: runtime?.connected ?? false,
      lastConnectedAt: runtime?.lastConnectedAt ?? null,
      lastError: runtime?.lastError ?? null,
    }),
  },
};

// OpenClaw plugin entry
export default {
  id: PLUGIN_ID,
  name: 'Discord Proxy',
  description: 'Discord channel with proxy support',
  register(api: any): void {
    // Set up the runtime for use in gateway
    setDiscordPluginRuntime(api.runtime);
    api.registerChannel({ plugin: discordPlugin });
  },
};
