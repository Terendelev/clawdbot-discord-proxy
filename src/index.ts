/**
 * Clawdbot Discord Plugin
 *
 * Discord channel plugin with proxy support for Clawdbot.
 */

export { DiscordChannelPlugin } from './channel';
export { DiscordChannelPlugin as plugin } from './channel';
export * from './types';
export * from './config';

// OpenClaw plugin entry - object export for plugin loading
export default {
  id: 'clawdbot-discord-proxy',
  name: 'clawdbot-discord-proxy',
  description: 'Discord plugin with proxy support for Clawdbot',
  register(api: unknown): void {
    const { DiscordChannelPlugin } = require('./channel');

    const discordChannel = {
      id: 'clawdbot-discord-proxy',
      meta: {
        id: 'clawdbot-discord-proxy',
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
        listAccountIds: (cfg: Record<string, unknown>) => {
          return Object.keys(cfg || {});
        },
        resolveAccount: (cfg: Record<string, unknown>, accountId: string) => {
          return (cfg as Record<string, unknown>)[accountId] || null;
        },
        defaultAccountId: () => 'default',
        isConfigured: (account: Record<string, unknown>) => {
          return Boolean(account?.token);
        },
        describeAccount: (account: Record<string, unknown>) => ({
          accountId: account?.accountId || 'default',
          name: account?.name || 'Discord Proxy',
          enabled: account?.enabled ?? true,
          configured: Boolean(account?.token),
        }),
      },
    };

    const plugin = new DiscordChannelPlugin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).registerChannel({
      plugin,
      channel: discordChannel,
    });
  },
};
