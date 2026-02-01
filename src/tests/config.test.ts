/**
 * Unit tests for config module
 */

import {
  parseConfig,
  validateConfig,
  migrateConfig,
  DEFAULT_CONFIG,
} from '../config';
import { GatewayIntent } from '../types';

describe('config', () => {
  describe('parseConfig', () => {
    it('should parse valid config', () => {
      const raw = {
        enabled: true,
        token: 'test-token',
        proxyUrl: 'http://proxy:8080',
        intents: [GatewayIntent.GUILD_MESSAGES, GatewayIntent.DIRECT_MESSAGES],
        autoReconnect: true,
        heartbeatInterval: 30000,
      };

      const config = parseConfig(raw);

      expect(config.enabled).toBe(true);
      expect(config.token).toBe('test-token');
      expect(config.proxyUrl).toBe('http://proxy:8080');
      expect(config.intents).toHaveLength(2);
      expect(config.autoReconnect).toBe(true);
      expect(config.heartbeatInterval).toBe(30000);
    });

    it('should use default values for missing fields', () => {
      const raw = {
        token: 'test-token',
      };

      const config = parseConfig(raw);

      expect(config.enabled).toBe(false);
      expect(config.proxyUrl).toBeUndefined();
      expect(config.autoReconnect).toBe(true);
      expect(config.heartbeatInterval).toBe(45000);
    });

    it('should parse numeric intents', () => {
      const raw = {
        token: 'test-token',
        intents: GatewayIntent.GUILD_MESSAGES | GatewayIntent.DIRECT_MESSAGES,
      };

      const config = parseConfig(raw);

      expect(config.intents).toContain(GatewayIntent.GUILD_MESSAGES);
      expect(config.intents).toContain(GatewayIntent.DIRECT_MESSAGES);
    });
  });

  describe('validateConfig', () => {
    it('should pass valid config', () => {
      const config = {
        ...DEFAULT_CONFIG,
        token: 'valid-token',
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail without token', () => {
      const config = {
        ...DEFAULT_CONFIG,
        token: '',
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Token is required');
    });

    it('should fail with low heartbeat interval', () => {
      const config = {
        ...DEFAULT_CONFIG,
        token: 'test-token',
        heartbeatInterval: 500,
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Heartbeat interval must be at least 1000ms');
    });

    it('should fail with no intents', () => {
      const config = {
        ...DEFAULT_CONFIG,
        token: 'test-token',
        intents: [],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one intent is required');
    });
  });

  describe('migrateConfig', () => {
    it('should migrate old config format', () => {
      const oldConfig = {
        enabled: true,
        token: 'old-token',
        proxy: 'http://old-proxy:8080',
        intents: [GatewayIntent.GUILD_MESSAGES],
      };

      const newConfig = migrateConfig(oldConfig);

      expect(newConfig.enabled).toBe(true);
      expect(newConfig.token).toBe('old-token');
      expect(newConfig.proxyUrl).toBe('http://old-proxy:8080');
    });

    it('should handle missing fields', () => {
      const oldConfig = {};

      const newConfig = migrateConfig(oldConfig);

      expect(newConfig.enabled).toBe(false);
      expect(newConfig.token).toBe('');
    });
  });
});
