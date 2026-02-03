/**
 * REST API wrapper with proxy support
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import type { Agent } from 'http';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
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
    // Use proxy-agent which supports HTTP, HTTPS, SOCKS4, SOCKS5
    const { ProxyAgent } = require('proxy-agent');
    return new ProxyAgent(proxyUrl) as unknown as Agent;
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

  /**
   * Check if string is a URL
   */
  private isUrl(str: string): boolean {
    try {
      new URL(str);
      return str.startsWith('http://') || str.startsWith('https://');
    } catch {
      return false;
    }
  }

  /**
   * Download file from URL to temporary file
   */
  private async downloadFile(url: string): Promise<string> {
    const tempDir = '/tmp';
    const tempFile = path.join(
      tempDir,
      `discord-upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    );

    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https://') ? https : http;
      const urlObj = new URL(url);

      const requestOptions: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        agent: this.proxyAgent,
      };

      const req = protocol.request(requestOptions, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          this.downloadFile(res.headers.location).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode}`));
          return;
        }

        const fileStream = fs.createWriteStream(tempFile);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve(tempFile);
        });

        fileStream.on('error', (err) => {
          fs.unlink(tempFile, () => {});
          reject(err);
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

  /**
   * Upload file using multipart/form-data
   */
  private async uploadFormData(
    channelId: string,
    form: FormData
  ): Promise<DiscordMessage> {
    const url = new URL(`${this.baseUrl}/channels/${channelId}/messages`);

    return new Promise((resolve, reject) => {
      const headers = form.getHeaders();
      const requestOptions: https.RequestOptions = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          ...headers,
          Authorization: `Bot ${this.token}`,
          'User-Agent': 'Clawdbot-Discord-Plugin/1.0',
        },
        agent: this.proxyAgent,
      };

      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data) as DiscordMessage);
            } catch {
              reject(new Error('Failed to parse response'));
            }
          } else {
            reject(new Error(`Upload failed: ${res.statusCode} ${res.statusMessage} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      form.pipe(req);
    });
  }

  /**
   * Upload file to Discord channel
   * Supports local file paths and network URLs
   */
  async uploadFile(
    channelId: string,
    filePathOrUrl: string,
    options?: {
      filename?: string;
      description?: string;
      content?: string;
      message_reference?: { message_id: string };
    }
  ): Promise<DiscordMessage> {
    let tempFilePath: string | null = null;
    let actualFilePath = filePathOrUrl;
    let cleanupNeeded = false;

    try {
      // Check if input is a URL
      if (this.isUrl(filePathOrUrl)) {
        // Download file to temporary location
        tempFilePath = await this.downloadFile(filePathOrUrl);
        actualFilePath = tempFilePath;
        cleanupNeeded = true;
      }

      // Read file
      const fileBuffer = await fs.promises.readFile(actualFilePath);
      const filename = options?.filename || path.basename(actualFilePath);

      // Create multipart form
      const form = new FormData();

      // Add file as 'attachment' field
      form.append('file', fileBuffer, {
        filename,
        contentType: this.getMimeType(filename),
      });

      // Add JSON payload
      const payload: Record<string, unknown> = {};

      if (options?.content) {
        payload.content = options.content;
      }

      if (options?.description) {
        payload.description = options.description;
      }

      if (options?.message_reference) {
        payload.message_reference = options.message_reference;
      }

      form.append('payload_json', JSON.stringify(payload));

      // Upload
      return await this.uploadFormData(channelId, form);
    } finally {
      // Clean up temporary file
      if (cleanupNeeded && tempFilePath) {
        try {
          await fs.promises.unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
    };
    return mimeTypes[ext] || 'application/octet-stream';
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
