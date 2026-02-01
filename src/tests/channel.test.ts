/**
 * Unit tests for channel plugin
 */

import { DiscordChannelPlugin } from '../channel';
import { GatewayIntent } from '../types';

describe('channel', () => {
  describe('DiscordChannelPlugin', () => {
    let plugin: DiscordChannelPlugin;

    beforeEach(() => {
      plugin = new DiscordChannelPlugin();
    });

    afterEach(async () => {
      if (plugin.isConnected()) {
        await plugin.disconnect();
      }
    });

    it('should have correct name and version', () => {
      expect(plugin.name).toBe('clawdbot-discord');
      expect(plugin.version).toBe('1.0.0');
    });

    it('should initialize with valid config', async () => {
      await plugin.initialize({
        config: {
          enabled: true,
          token: 'test-token',
          intents: [GatewayIntent.GUILD_MESSAGES],
        },
      });

      expect(plugin.isConnected()).toBe(false);
    });

    it('should throw error when initializing twice', async () => {
      await plugin.initialize({
        config: {
          token: 'test-token',
          intents: [GatewayIntent.GUILD_MESSAGES],
        },
      });

      await expect(
        plugin.initialize({
          config: { token: 'test-token' },
        })
      ).rejects.toThrow('Plugin already initialized');
    });

    it('should throw error for invalid config', async () => {
      await expect(
        plugin.initialize({
          config: {
            token: '',
            intents: [GatewayIntent.GUILD_MESSAGES],
          },
        })
      ).rejects.toThrow('Invalid configuration');
    });

    it('should register message handler', () => {
      const handler = jest.fn();

      plugin.onMessage(handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should send message without being connected', async () => {
      // Plugin is initialized but not connected
      await plugin.initialize({
        config: {
          token: 'test-token',
          intents: [GatewayIntent.GUILD_MESSAGES],
        },
      });

      // Sending should work even when not connected (API call will fail due to invalid token)
      await expect(
        plugin.sendMessage('123456789', 'Hello')
      ).rejects.not.toThrow('Plugin not initialized');
    });
  });
});
