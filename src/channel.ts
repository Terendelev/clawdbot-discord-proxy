/**
 * Channel Plugin implementation
 *
 * Note: This class is kept for compatibility but the actual
 * plugin functionality is implemented in index.ts
 */

import { DiscordGateway, createGateway } from './gateway';
import { DiscordApi, createApi } from './api';
import {
  DiscordPluginConfig,
  DiscordMessage,
  GatewayIntent,
  ChannelPlugin,
} from './types';
import { parseConfig, validateConfig, DEFAULT_CONFIG } from './config';
import { fetchPluralKitMessage } from './pluralkit';

export interface ChannelPluginOptions {
  config?: Record<string, unknown>;
}

export class DiscordChannelPlugin implements ChannelPlugin {
  id = 'clawdbot-discord-proxy';
  name = 'Discord Proxy';
  version = '1.0.0';

  private config: DiscordPluginConfig = DEFAULT_CONFIG;
  private gateway: DiscordGateway | null = null;
  private api: DiscordApi | null = null;
  private messageHandlers: Set<(message: DiscordMessage) => void> = new Set();
  private initialized: boolean = false;
  private connected: boolean = false;

  /**
   * Initialize plugin with configuration
   */
  async initialize(options?: ChannelPluginOptions): Promise<void> {
    if (this.initialized) {
      throw new Error('Plugin already initialized');
    }

    // Parse and validate configuration
    const parsedConfig = parseConfig(options?.config || {});
    const validation = validateConfig(parsedConfig);
    
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    this.config = parsedConfig;

    // Create API client
    this.api = createApi(this.config.token, this.config.proxyUrl);

    this.initialized = true;
  }

  /**
   * Connect to Discord
   */
  async connect(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Plugin not initialized');
    }

    if (this.connected) {
      return;
    }

    // Create Gateway
    this.gateway = createGateway(this.config);

    // Set up event handlers
    this.gateway.on('ready', (data) => {
      console.log(`Connected as ${data.user.username}#${data.user.discriminator}`);
    });

    this.gateway.on('message', async (message) => {
      await this.handleIncomingMessage(message);
    });

    this.gateway.on('error', (error) => {
      console.error('Gateway error:', error);
    });

    this.gateway.on('closed', (data) => {
      console.log(`Gateway closed: ${data.code} ${data.reason}`);
      this.connected = false;
    });

    // Connect
    await this.gateway.connect();
    this.connected = true;
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    if (this.gateway) {
      await this.gateway.disconnect();
      this.gateway = null;
    }
    this.connected = false;
  }

  /**
   * Send message to channel
   */
  async sendMessage(channelId: string, content: string): Promise<void> {
    if (!this.api) {
      throw new Error('Plugin not initialized');
    }

    await this.api.createMessage(channelId, content);
  }

  /**
   * Send file to channel
   */
  async sendFile(channelId: string, filePath: string, filename?: string): Promise<void> {
    if (!this.api) {
      throw new Error('Plugin not initialized');
    }

    await this.api.uploadFile(channelId, filePath, {
      filename,
    });
  }

  /**
   * Register message handler
   */
  onMessage(callback: (message: DiscordMessage) => void): void {
    this.messageHandlers.add(callback);
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(message: DiscordMessage): Promise<void> {
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    }

    if (this.config.pluralkit?.enabled) {
      try {
        const pkInfo = await fetchPluralKitMessage(message.id, this.config.pluralkit);
        if (pkInfo) {
          (message as DiscordMessage & { pkInfo: any }).pkInfo = pkInfo;
          console.log(
            `[PluralKit] Message ${message.id} - System: ${pkInfo.system?.name || 'N/A'}, ` +
            `Member: ${pkInfo.member?.display_name || pkInfo.member?.name || 'N/A'}, ` +
            `Real User: ${pkInfo.sender || 'N/A'}`
          );
        }
      } catch (error) {
        console.warn(`PluralKit query failed: ${error}`);
      }
    }
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get API client for advanced operations
   */
  getApi(): DiscordApi | null {
    return this.api;
  }

  /**
   * Get Gateway client for advanced operations
   */
  getGateway(): DiscordGateway | null {
    return this.gateway;
  }
}

/**
 * Default export for dynamic loading
 */
export const createPlugin = (): DiscordChannelPlugin => {
  return new DiscordChannelPlugin();
};
