/**
 * REST API wrapper with proxy support
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import type { Agent } from 'http';
import { DiscordMessage, DiscordChannel, DiscordUser } from './types';

export interface ApiOptions {
  token: string;
  baseUrl?: string;
  proxyUrl?: string;
  version?: number;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string>;
}

// Get proxy agent based on URL type
function getProxyAgent(proxyUrl?: string): Agent | undefined {
  if (!proxyUrl) {
    const envProxy = process.env.DISCORD_PROXY;
    if (envProxy) {
      proxyUrl = envProxy;
    } else {
      return undefined;
    }
  }

  try {
    // Use https-proxy-agent for HTTP/HTTPS proxies
    const mod = require('https-proxy-agent');
    const HttpsProxyAgent = mod.HttpsProxyAgent;
    return new HttpsProxyAgent(proxyUrl) as unknown as Agent;
  } catch {
    return undefined;
  }
}

/**
 * Discord REST API client
 */
export class DiscordApi {
  private token: string;
  private proxyAgent: Agent | undefined;
  private baseUrl: string;

  constructor(options: ApiOptions) {
    this.token = options.token;
    this.baseUrl = options.baseUrl || `https://discord.com/api/v${options.version || 10}`;
    this.proxyAgent = getProxyAgent(options.proxyUrl);
  }

  /**
   * Make HTTP request
   */
  private async request<T>(options: RequestOptions): Promise<T> {
    const url = new URL(`${this.baseUrl}${options.path}`);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bot ${this.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Clawdbot-Discord-Plugin/1.0',
    };

    const requestOptions: https.RequestOptions = {
      method: options.method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers,
      agent: this.proxyAgent,
    };

    return new Promise((resolve, reject) => {
      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : undefined);
            } catch {
              resolve(data as T);
            }
          } else {
            reject(new Error(`API request failed: ${res.statusCode} ${res.statusMessage}`));
          }
        });
      });

      req.on('error', reject);

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<DiscordUser> {
    return this.request<DiscordUser>({
      method: 'GET',
      path: '/users/@me',
    });
  }

  /**
   * Get channel
   */
  async getChannel(channelId: string): Promise<DiscordChannel> {
    return this.request<DiscordChannel>({
      method: 'GET',
      path: `/channels/${channelId}`,
    });
  }

  /**
   * Send message to channel
   */
  async createMessage(
    channelId: string,
    content: string,
    options?: {
      tts?: boolean;
      embeds?: unknown[];
      message_reference?: { message_id: string };
    }
  ): Promise<DiscordMessage> {
    return this.request<DiscordMessage>({
      method: 'POST',
      path: `/channels/${channelId}/messages`,
      body: {
        content,
        tts: options?.tts || false,
        embeds: options?.embeds,
        message_reference: options?.message_reference,
      },
    });
  }

  /**
   * Edit message
   */
  async editMessage(
    channelId: string,
    messageId: string,
    content: string
  ): Promise<DiscordMessage> {
    return this.request<DiscordMessage>({
      method: 'PATCH',
      path: `/channels/${channelId}/messages/${messageId}`,
      body: { content },
    });
  }

  /**
   * Delete message
   */
  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      path: `/channels/${channelId}/messages/${messageId}`,
    });
  }

  /**
   * Get messages from channel
   */
  async getMessages(
    channelId: string,
    options?: {
      limit?: number;
      around?: string;
      before?: string;
      after?: string;
    }
  ): Promise<DiscordMessage[]> {
    const query: Record<string, string> = {};

    if (options?.limit) query.limit = String(options.limit);
    if (options?.around) query.around = options.around;
    if (options?.before) query.before = options.before;
    if (options?.after) query.after = options.after;

    return this.request<DiscordMessage[]>({
      method: 'GET',
      path: `/channels/${channelId}/messages`,
      query,
    });
  }

  /**
   * Add reaction to message
   */
  async addReaction(
    channelId: string,
    messageId: string,
    emoji: string
  ): Promise<void> {
    const encodedEmoji = encodeURIComponent(emoji);

    await this.request({
      method: 'PUT',
      path: `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`,
    });
  }

  /**
   * Remove reaction from message
   */
  async removeReaction(
    channelId: string,
    messageId: string,
    emoji: string,
    userId?: string
  ): Promise<void> {
    const encodedEmoji = encodeURIComponent(emoji);

    await this.request({
      method: 'DELETE',
      path: `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/${userId || '@me'}`,
    });
  }

  /**
   * Create DM channel
   */
  async createDm(recipientId: string): Promise<DiscordChannel> {
    return this.request<DiscordChannel>({
      method: 'POST',
      path: '/users/@me/channels',
      body: { recipient_id: recipientId },
    });
  }

  /**
   * Join guild thread
   */
  async joinThread(channelId: string): Promise<void> {
    await this.request({
      method: 'POST',
      path: `/channels/${channelId}/thread-members/@me`,
    });
  }

  /**
   * Leave guild thread
   */
  async leaveThread(channelId: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      path: `/channels/${channelId}/thread-members/@me`,
    });
  }
}

/**
 * Create API client from config
 */
export function createApi(
  token: string,
  proxyUrl?: string
): DiscordApi {
  return new DiscordApi({
    token,
    proxyUrl,
  });
}
