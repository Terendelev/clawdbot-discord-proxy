/**
 * REST API wrapper with proxy support
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { DiscordMessage, DiscordChannel, DiscordUser } from './types';

const execAsync = promisify(exec);

/**
 * Execute curl command and return output
 */
async function curlExecute(
  args: string[],
  options: { timeout?: number; maxBuffer?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const timeout = (options.timeout || 30) * 1000;
  const maxBuffer = options.maxBuffer || 10 * 1024 * 1024;

  // Build the command string
  const cmd = 'curl ' + args.map(a => {
    // Escape special characters in arguments
    return `"${a.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')}"`;
  }).join(' ');

  console.log(`[curlExecute] ${cmd.substring(0, 100)}...`);

  const { stdout, stderr } = await execAsync(cmd, {
    timeout,
    maxBuffer,
  });

  return { stdout, stderr };
}

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

/**
 * Make HTTP request through proxy using native Node.js http/https
 * More reliable than curl for JSON requests
 */
async function httpRequest(
  url: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
    proxyUrl?: string;
    timeout?: number;
  }
): Promise<{ statusCode: number; data: string }> {
  const timeout = options.timeout || 30;
  const proxyUrl = options.proxyUrl || process.env.DISCORD_PROXY;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const requestOptions: https.RequestOptions = {
      method: options.method,
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: timeout * 1000,
    };

    // Use proxy agent if configured
    if (proxyUrl) {
      try {
        const { HttpsProxyAgent } = require('https-proxy-agent');
        requestOptions.agent = new HttpsProxyAgent(proxyUrl);
      } catch {
        // Proxy agent not available, continue without proxy
      }
    }

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 500, data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Make HTTP request through proxy using curl
 * Used for file uploads where form.pipe is needed
 */
async function curlRequest(
  url: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
    proxyUrl?: string;
    timeout?: number;
  }
): Promise<{ statusCode: number; data: string }> {
  const timeout = options.timeout || 30;
  const proxyUrl = options.proxyUrl || process.env.DISCORD_PROXY;

  // Build curl command
  const curlArgs = [
    '-s', '-S',  // silent but show errors
    '-X', options.method,
    '--max-time', String(timeout),
  ];

  // Add headers
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      curlArgs.push('-H', `${key}: ${value}`);
    }
  }

  // Add body for POST/PUT/PATCH
  if (options.body && typeof options.body === 'object') {
    curlArgs.push('-d', JSON.stringify(options.body));
  }

  // Add proxy BEFORE URL (important for curl to work correctly)
  if (proxyUrl) {
    curlArgs.push('-x', proxyUrl);
  }

  // Add URL last
  curlArgs.push(url);

  console.log(`[curl] curl -X ${options.method} ${url.substring(0, 50)}...`);

  try {
    const { stdout, stderr } = await curlExecute(curlArgs, { timeout });

    // Parse response headers to get status code
    const statusMatch = stderr.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/m);
    const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 200;

    return { statusCode, data: stdout };
  } catch (err: any) {
    console.error(`[curl] Error: ${err.message}`);
    throw new Error(`curl failed: ${err.message}`);
  }
}

/**
 * Discord REST API client
 */
export class DiscordApi {
  private token: string;
  private proxyUrl: string | undefined;
  private baseUrl: string;

  constructor(options: ApiOptions) {
    this.token = options.token;
    this.baseUrl = options.baseUrl || `https://discord.com/api/v${options.version || 10}`;
    this.proxyUrl = options.proxyUrl || process.env.DISCORD_PROXY;
    console.log(`[DiscordApi] Created with proxy: ${this.proxyUrl || 'none'}`);
  }

  /**
   * Make HTTP request with proxy support
   * Uses native http/https for JSON requests (more reliable)
   */
  async call<T>(options: RequestOptions): Promise<T> {
    const url = new URL(`${this.baseUrl}${options.path}`);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        url.searchParams.set(key, value);
      }
    }

    console.log(`[DiscordApi] Making ${options.method} request to: ${url.toString()}`);

    try {
      const response = await httpRequest(url.toString(), {
        method: options.method,
        headers: {
          Authorization: `Bot ${this.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Clawdbot-Discord-Plugin/1.0',
        },
        body: options.body,
        proxyUrl: this.proxyUrl,
      });

      console.log(`[DiscordApi] Response: ${response.statusCode}`);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        try {
          return response.data ? JSON.parse(response.data) : {} as T;
        } catch {
          return response.data as unknown as T;
        }
      } else {
        throw new Error(`API request failed: ${response.statusCode} - ${response.data}`);
      }
    } catch (err) {
      console.error(`[DiscordApi] Request error: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<DiscordUser> {
    return this.call<DiscordUser>({
      method: 'GET',
      path: '/users/@me',
    });
  }

  /**
   * Get channel
   */
  async getChannel(channelId: string): Promise<DiscordChannel> {
    return this.call<DiscordChannel>({
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
    return this.call<DiscordMessage>({
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
    return this.call<DiscordMessage>({
      method: 'PATCH',
      path: `/channels/${channelId}/messages/${messageId}`,
      body: { content },
    });
  }

  /**
   * Delete message
   */
  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await this.call({
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

    return this.call<DiscordMessage[]>({
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

    await this.call({
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

    await this.call({
      method: 'DELETE',
      path: `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/${userId || '@me'}`,
    });
  }

  /**
   * Create DM channel
   */
  async createDm(recipientId: string): Promise<DiscordChannel> {
    return this.call<DiscordChannel>({
      method: 'POST',
      path: '/users/@me/channels',
      body: { recipient_id: recipientId },
    });
  }

  /**
   * Join guild thread
   */
  async joinThread(channelId: string): Promise<void> {
    await this.call({
      method: 'POST',
      path: `/channels/${channelId}/thread-members/@me`,
    });
  }

  /**
   * Leave guild thread
   */
  async leaveThread(channelId: string): Promise<void> {
    await this.call({
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

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Upload file using multipart/form-data with curl
   */
  private async uploadFormData(
    channelId: string,
    form: FormData,
    filename?: string
  ): Promise<DiscordMessage> {
    const url = `${this.baseUrl}/channels/${channelId}/messages`;
    console.log(`[DiscordApi] Uploading to: ${url}, filename: ${filename}`);

    return new Promise((resolve, reject) => {
      const authHeader = `Bot ${this.token}`;

      // Create a temporary file with form data
      const tempFile = `/tmp/discord-upload-form-${Date.now()}`;
      const writeStream = fs.createWriteStream(tempFile);

      form.pipe(writeStream);

      writeStream.on('finish', async () => {
        try {
          // Use curl to upload with the correct filename
          // curl syntax: -F "file=@filepath;type=mime;filename=actualname"
          const curlArgs = [
            '-s', '-S',
            '-X', 'POST',
            '-H', `Authorization: ${authHeader}`,
            '-H', `User-Agent: Clawdbot-Discord-Plugin/1.0`,
            '-F', `file=@${tempFile};type=${this.getMimeType(filename || 'file')};filename=${filename || 'file'}`,
            '-F', `payload_json={"content":""}`,
            url,
          ];

          if (this.proxyUrl) {
            curlArgs.splice(1, 0, '-x', this.proxyUrl);
          }

          const { stdout, stderr } = await curlExecute(curlArgs, {
            timeout: 120, // 2 minutes for uploads
            maxBuffer: 50 * 1024 * 1024,
          });

          // Clean up temp file
          fs.unlink(tempFile, () => {});

          console.log(`[DiscordApi] Upload response: ${stderr.substring(0, 100)}`);

          try {
            const result = JSON.parse(stdout) as DiscordMessage;
            resolve(result);
          } catch {
            reject(new Error(`Failed to parse upload response: ${stdout}`));
          }
        } catch (err) {
          reject(err);
        }
      });

      writeStream.on('error', reject);
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

      // Add file
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
      return await this.uploadFormData(channelId, form, filename);
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
