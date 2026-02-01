/**
 * Unit tests for gateway module
 */

import { DiscordGateway, getProxyAgent, calculateIntentBits } from '../gateway';
import { GatewayIntent } from '../types';

describe('gateway', () => {
  describe('calculateIntentBits', () => {
    it('should calculate correct bitfield', () => {
      const intents = [
        GatewayIntent.GUILD_MESSAGES,
        GatewayIntent.DIRECT_MESSAGES,
      ];

      const bits = calculateIntentBits(intents);

      expect(bits).toBe(
        GatewayIntent.GUILD_MESSAGES | GatewayIntent.DIRECT_MESSAGES
      );
    });

    it('should handle empty intents', () => {
      const bits = calculateIntentBits([]);

      expect(bits).toBe(0);
    });

    it('should handle single intent', () => {
      const bits = calculateIntentBits([GatewayIntent.GUILDS]);

      expect(bits).toBe(GatewayIntent.GUILDS);
    });
  });

  describe('getProxyAgent', () => {
    it('should return agent for proxy URL', () => {
      const agent = getProxyAgent('http://proxy:8080');

      expect(agent).toBeDefined();
    });

    it('should return undefined without proxy', () => {
      const agent = getProxyAgent(undefined);

      expect(agent).toBeUndefined();
    });
  });

  describe('DiscordGateway', () => {
    it('should create instance with options', () => {
      const gateway = new DiscordGateway({
        token: 'test-token',
        proxyUrl: 'http://proxy:8080',
        intents: [GatewayIntent.GUILD_MESSAGES],
        autoReconnect: true,
        heartbeatInterval: 30000,
      });

      expect(gateway).toBeDefined();
    });

    it('should have default values', () => {
      const gateway = new DiscordGateway({
        token: 'test-token',
        intents: [GatewayIntent.GUILDS],
      });

      expect(gateway.isConnected()).toBe(false);
    });
  });
});
