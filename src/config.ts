/**
 * Configuration parsing and migration utilities
 */

import { DiscordPluginConfig, GatewayIntent } from './types';

/** Default configuration values */
export const DEFAULT_CONFIG: DiscordPluginConfig = {
  enabled: false,
  token: '',
  proxyUrl: undefined,
  intents: [
    GatewayIntent.GUILD_MESSAGES,
    GatewayIntent.DIRECT_MESSAGES,
    GatewayIntent.MESSAGE_CONTENT,
  ],
  defaultChannel: undefined,
  autoReconnect: true,
  heartbeatInterval: 45000,
  pluralkit: {
    enabled: false,
  },
};

/**
 * Parse raw configuration into DiscordPluginConfig
 */
export function parseConfig(raw: Record<string, unknown>): DiscordPluginConfig {
  const config: DiscordPluginConfig = {
    enabled: Boolean(raw.enabled),
    token: String(raw.token || ''),
    proxyUrl: raw.proxyUrl ? String(raw.proxyUrl) : undefined,
    intents: parseIntents(raw.intents),
    defaultChannel: raw.defaultChannel ? String(raw.defaultChannel) : undefined,
    autoReconnect: raw.autoReconnect !== false,
    heartbeatInterval: Number(raw.heartbeatInterval) || DEFAULT_CONFIG.heartbeatInterval,
    pluralkit: (raw.pluralkit as any) ? {
      enabled: Boolean((raw.pluralkit as any).enabled ?? process.env.PLURALKIT_ENABLED === 'true'),
      token: (raw.pluralkit as any).token ? String((raw.pluralkit as any).token) : process.env.PLURALKIT_TOKEN,
    } : undefined,
  };

  return config;
}

/**
 * Parse intents from various formats
 */
function parseIntents(intents: unknown): GatewayIntent[] {
  if (Array.isArray(intents)) {
    return intents.map((i) => Number(i) as GatewayIntent);
  }
  if (typeof intents === 'number') {
    // Convert single number to array of intents
    const result: GatewayIntent[] = [];
    for (const intent of Object.values(GatewayIntent)) {
      if (typeof intent === 'number' && (intents & intent) !== 0) {
        result.push(intent);
      }
    }
    return result;
  }
  return DEFAULT_CONFIG.intents;
}

/**
 * Validate configuration
 */
export function validateConfig(config: DiscordPluginConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.token) {
    errors.push('Token is required');
  }

  if (config.heartbeatInterval < 1000) {
    errors.push('Heartbeat interval must be at least 1000ms');
  }

  if (config.intents.length === 0) {
    errors.push('At least one intent is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Migrate old config format to new format
 */
export function migrateConfig(oldConfig: Record<string, unknown>): DiscordPluginConfig {
  const newConfig: DiscordPluginConfig = {
    ...DEFAULT_CONFIG,
    enabled: Boolean(oldConfig.enabled ?? oldConfig.enabled),
    token: String(oldConfig.token || oldConfig.token || ''),
  };

  // Handle proxy URL migration
  if (oldConfig.proxyUrl) {
    newConfig.proxyUrl = String(oldConfig.proxyUrl);
  } else if (oldConfig.proxy) {
    newConfig.proxyUrl = String(oldConfig.proxy);
  }

  // Handle intents migration
  if (oldConfig.intents) {
    newConfig.intents = parseIntents(oldConfig.intents);
  }

  // Handle autoReconnect migration
  if ('autoReconnect' in oldConfig) {
    newConfig.autoReconnect = Boolean(oldConfig.autoReconnect);
  }

  return newConfig;
}
