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

// Get SOCKS5 proxy URL for WebSocket Gateway
function getWsProxyUrl(cfg: Record<string, unknown>): string | undefined {
  const channelCfg = (cfg.channels as Record<string, DiscordChannelConfig>)?.[PLUGIN_ID];
  // Prefer wssUrl (SOCKS5) for WebSocket, fall back to wsUrl or http proxy
  return channelCfg?.proxyConfig?.wssUrl ?? channelCfg?.proxyConfig?.wsUrl;
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

// Extract user ID from various target formats
export function extractUserId(target: string): string | undefined {
  if (target.startsWith('discord:')) {
    const userId = target.slice('discord:'.length).trim();
    return userId || undefined;
  }
  if (target.startsWith('user:')) {
    const userId = target.slice('user:'.length).trim();
    return userId || undefined;
  }
  // Bare numeric ID - assume it's a user ID for DM
  if (/^\d{6,}$/.test(target)) {
    return target.trim();
  }
  return undefined;
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
  messaging: {
    normalizeTarget: (raw: string): string | undefined => {
      const trimmed = raw.trim();
      if (!trimmed) return undefined;

      // Discord mention format: <@123456789> or <@!123456789>
      const mentionMatch = trimmed.match(/^<@!?(\d+)>$/);
      if (mentionMatch) {
        return `user:${mentionMatch[1]}`;
      }

      // user:123456789 format
      if (trimmed.startsWith('user:')) {
        return trimmed.toLowerCase();
      }

      // channel:123456789 format
      if (trimmed.startsWith('channel:')) {
        return trimmed.toLowerCase();
      }

      // discord:123456789 format -> user:123456789
      if (trimmed.startsWith('discord:')) {
        const userId = trimmed.slice('discord:'.length).trim();
        return userId ? `user:${userId}` : undefined;
      }

      // Bare numeric ID - default to user (DM)
      if (/^\d{6,}$/.test(trimmed)) {
        return `user:${trimmed}`;
      }

      return undefined;
    },
    targetResolver: {
      // Check if the target looks like a valid Discord ID
      looksLikeId: (raw: string, _normalized: string): boolean => {
        const trimmed = raw.trim();
        if (!trimmed) return false;
        // Discord mention format: <@123456789> or <@!123456789>
        if (/^<@!?\d+>$/.test(trimmed)) return true;
        // Prefixed formats: user:123456789, channel:123456789, discord:123456789
        if (/^(user|channel|discord):/i.test(trimmed)) return true;
        // Bare numeric IDs (6+ digits)
        if (/^\d{6,}$/.test(trimmed)) return true;
        return false;
      },
      hint: 'Use user:<id> or discord:<id> for DMs, channel:<id> for channel messages, or a raw numeric ID.',
    },
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
      const accountIdStr = accountId ?? 'default';
      const account = resolveAccount(cfg, accountIdStr);
      const runtime = getRuntime(accountIdStr);

      // Ensure API is created
      if (!runtime.api) {
        const proxyUrl = getProxyUrl(cfg);
        runtime.api = createApi(account.token!, proxyUrl);
      }

      // Resolve channel ID (handle discord:userId and user:userId formats for DMs)
      let channelId = to;
      const userId = extractUserId(to);
      if (userId) {
        // Create DM channel for user
        const dmChannel = await runtime.api!.createDm(userId);
        channelId = dmChannel.id;
      }

      try {
        await runtime.api!.createMessage(channelId, text, replyToId ? { message_reference: { message_id: replyToId } } : undefined);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: (error as Error).message };
      }
    },
    sendMedia: async ({ to, text, mediaUrl, path, replyToId, accountId, cfg }: {
      to: string;
      text?: string;
      mediaUrl?: string;
      path?: string;
      replyToId?: string;
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

      // Use path or mediaUrl as the file source
      const filePath = path || mediaUrl;
      if (!filePath) {
        return { ok: false, error: 'No file path provided' };
      }

      // Resolve channel ID (handle discord:userId and user:userId formats for DMs)
      let channelId = to;
      const userId = extractUserId(to);
      if (userId) {
        // Create DM channel for user
        const dmChannel = await runtime.api!.createDm(userId);
        channelId = dmChannel.id;
      }

      try {
        // Upload file with optional text content and reply reference
        await runtime.api!.uploadFile(channelId, filePath, {
          content: text,
          message_reference: replyToId ? { message_id: replyToId } : undefined,
        });
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

      log?.info(`[${PLUGIN_ID}:${accountId}] === PLUGIN STARTING ===`);
      log?.info(`[${PLUGIN_ID}:${accountId}] Token present: ${Boolean(account.token)}`);

      const runtime = getRuntime(accountId);
      runtime.account = account;
      log?.info(`[${PLUGIN_ID}:${accountId}] Runtime state initialized`);

      const proxyUrl = getProxyUrl(cfg);
      const wsProxyUrl = getWsProxyUrl(cfg);
      log?.info(`[${PLUGIN_ID}:${accountId}] HTTP Proxy URL: ${proxyUrl || 'none'}`);
      log?.info(`[${PLUGIN_ID}:${accountId}] SOCKS5 Proxy URL: ${wsProxyUrl || 'none'}`);
      log?.info(`[${PLUGIN_ID}:${accountId}] Creating gateway with intents: GUILDS, GUILD_MESSAGES, DIRECT_MESSAGES, MESSAGE_CONTENT`);
      const pluginConfig: DiscordPluginConfig = {
        ...DEFAULT_CONFIG,
        token: account.token!,
        proxyUrl: wsProxyUrl,  // Use SOCKS5 for Gateway
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
      log?.info(`[${PLUGIN_ID}:${accountId}] Gateway object created, attaching event handlers...`);

      // Set up event handlers
      runtime.gateway.on('ready', (data: { user: { username: string; discriminator: string } }) => {
        log?.info(`[${PLUGIN_ID}:${accountId}] === GATEWAY READY === Connected as ${data.user.username}#${data.user.discriminator}`);
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
        log?.info(`[${PLUGIN_ID}:${accountId}] === MESSAGE RECEIVED ===`);
        log?.info(`[${PLUGIN_ID}:${accountId}] Message ID: ${message.id}`);
        log?.info(`[${PLUGIN_ID}:${accountId}] Author: ${message.author.username}#${message.author.discriminator} (bot: ${message.author.bot})`);
        log?.info(`[${PLUGIN_ID}:${accountId}] Content: "${message.content?.substring(0, 100)}..."`);
        log?.info(`[${PLUGIN_ID}:${accountId}] Channel ID: ${message.channel_id}`);
        log?.info(`[${PLUGIN_ID}:${accountId}] Guild ID: ${message.guild_id || 'DM'}`);
        log?.info(`[${PLUGIN_ID}:${accountId}] Timestamp: ${message.timestamp}`);

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
          log?.info(`[${PLUGIN_ID}:${accountId}] Ignoring bot message`);
          return;
        }

        const isDm = !message.guild_id;
        const peerId = isDm ? `discord:${message.author.id}` : `discord:channel:${message.channel_id}`;
        log?.info(`[${PLUGIN_ID}:${accountId}] Message type: ${isDm ? 'DM' : 'Guild Channel'}, peerId: ${peerId}`);

        try {
          const runtime = getDiscordPluginRuntime();
          log?.info(`[${PLUGIN_ID}:${accountId}] Got plugin runtime, resolving agent route...`);

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
          log?.info(`[${PLUGIN_ID}:${accountId}] Agent route resolved: agentId=${route.agentId}, sessionKey=${route.sessionKey}`);

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
          log?.info(`[${PLUGIN_ID}:${accountId}] Messages config: responsePrefix="${messagesConfig.responsePrefix}"`);

          // Track if we got a response
          let hasResponse = false;
          const responseTimeout = 60000; // 60 seconds timeout
          let timeoutId: ReturnType<typeof setTimeout> | null = null;

          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              if (!hasResponse) {
                log?.info(`[${PLUGIN_ID}:${accountId}] Response timeout reached`);
                reject(new Error('Response timeout'));
              }
            }, responseTimeout);
          });

          log?.info(`[${PLUGIN_ID}:${accountId}] Dispatching message to agent ${route.agentId}...`);
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
                log?.info(`[${PLUGIN_ID}:${accountId}] Reply text: "${payload.text?.substring(0, 100)}..."`);

                let replyText = payload.text ?? '';

                try {
                  // Use the plugin's runtime API (not clawdbot runtime)
                  const rt = getRuntime(accountId);
                  if (!rt.api) {
                    const proxyUrl = getProxyUrl(cfg);
                    rt.api = createApi(account.token!, proxyUrl);
                    log?.info(`[${PLUGIN_ID}:${accountId}] Created new API instance`);
                  }

                  // Send reply via API
                  if (replyText.trim()) {
                    await rt.api.createMessage(message.channel_id, replyText, { message_reference: { message_id: message.id } });
                    log?.info(`[${PLUGIN_ID}:${accountId}] Sent reply`);
                  }

                  // Record activity via clawdbot runtime
                  const clawdbotRuntime = getDiscordPluginRuntime();
                  clawdbotRuntime.channel.activity.record({
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
            log?.info(`[${PLUGIN_ID}:${accountId}] Message dispatch completed successfully`);
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
        // Explicitly trigger reconnect (redundant protection)
        if (runtime.gateway) {
          runtime.gateway.scheduleReconnect();
        }
      });

      // Monitor reconnect events
      runtime.gateway.on('reconnecting', () => {
        log?.info(`[${PLUGIN_ID}:${accountId}] Attempting to reconnect...`);
        setStatus({
          ...getStatus(),
          connected: false,
          lastError: null,
        });
      });

      runtime.gateway.on('reconnected', () => {
        log?.info(`[${PLUGIN_ID}:${accountId}] Reconnected successfully`);
        runtime.connected = true;
        setStatus({
          ...getStatus(),
          connected: true,
          lastConnectedAt: Date.now(),
        });
      });

      runtime.gateway.on('reconnectFailed', ({ error }: { error: Error }) => {
        log?.error(`[${PLUGIN_ID}:${accountId}] Reconnect failed: ${error.message}`);
        setStatus({
          ...getStatus(),
          lastError: error.message,
        });
      });

      // Connect
      log?.info(`[${PLUGIN_ID}:${accountId}] Connecting to Discord gateway...`);
      await runtime.gateway.connect();
      log?.info(`[${PLUGIN_ID}:${accountId}] Gateway connection initiated, waiting for ready event...`);

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
    console.log(`[${PLUGIN_ID}] Plugin register() called`);
    console.log(`[${PLUGIN_ID}] Registering channel plugin with id: ${PLUGIN_ID}`);
    // Set up the runtime for use in gateway
    setDiscordPluginRuntime(api.runtime);
    console.log(`[${PLUGIN_ID}] Plugin runtime set`);
    api.registerChannel({ plugin: discordPlugin });
    console.log(`[${PLUGIN_ID}] Channel plugin registered successfully`);
  },
};
