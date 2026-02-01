/**
 * Gateway implementation with proxy support
 */

import WebSocket from 'ws';
import {
  DiscordPluginConfig,
  GatewayIntent,
  GatewayOpcode,
  GatewayCloseCode,
  DiscordMessage,
  DiscordUser,
  DiscordGuild,
  DiscordChannel,
} from './types';

// Proxy agent constructor type
type ProxyAgentConstructor = new (url: string) => unknown;

// Dynamic import for proxy-agent to avoid type issues
function createProxyAgent(proxyUrl: string): unknown {
  try {
    const ProxyAgentModule = require('proxy-agent');
    const ProxyAgent = ProxyAgentModule.ProxyAgent as ProxyAgentConstructor;
    return new ProxyAgent(proxyUrl);
  } catch {
    return undefined;
  }
}

export interface GatewayOptions {
  token: string;
  proxyUrl?: string;
  intents: GatewayIntent[];
  autoReconnect?: boolean;
  heartbeatInterval?: number;
}

export interface GatewayEventMap {
  ready: { user: DiscordUser; guilds: DiscordGuild[] };
  message: DiscordMessage;
  guildCreate: DiscordGuild;
  guildDelete: { id: string; unavailable?: boolean };
  channelCreate: DiscordChannel;
  channelDelete: DiscordChannel;
  error: Error;
  closed: { code: number; reason: string };
}

/**
 * Get proxy agent from configuration
 */
export function getProxyAgent(proxyUrl?: string): unknown {
  if (proxyUrl) {
    return createProxyAgent(proxyUrl);
  }
  const envProxy = process.env.DISCORD_PROXY;
  if (envProxy) {
    return createProxyAgent(envProxy);
  }
  return undefined;
}

/**
 * Calculate Gateway intent bitfield from array
 */
export function calculateIntentBits(intents: GatewayIntent[]): number {
  return intents.reduce((sum, intent) => sum | intent, 0);
}

/**
 * Discord Gateway connection handler
 */
export class DiscordGateway {
  private ws: WebSocket | null = null;
  private token: string;
  private proxyAgent: unknown;
  private intents: number;
  private autoReconnect: boolean;
  private heartbeatInterval: number;
  private sequence: number = 0;
  private sessionId: string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected: boolean = false;
  private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(options: GatewayOptions) {
    this.token = options.token;
    this.proxyAgent = getProxyAgent(options.proxyUrl);
    this.intents = calculateIntentBits(options.intents);
    this.autoReconnect = options.autoReconnect !== false;
    this.heartbeatInterval = options.heartbeatInterval || 45000;
  }

  /**
   * Connect to Discord Gateway
   */
  async connect(): Promise<void> {
    const gatewayUrl = 'wss://gateway.discord.gg';

    const connectOptions: WebSocket.ClientOptions = {
      headers: {
        'User-Agent': 'Clawdbot-Discord-Plugin/1.0',
      },
    };

    // Add agent if proxy is configured
    if (this.proxyAgent) {
      (connectOptions as { agent?: unknown }).agent = this.proxyAgent;
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(gatewayUrl, connectOptions);

      this.ws.on('open', () => {
        // Wait for HELLO before identifying
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        this.handleClose(code, reason.toString());
      });

      // Timeout for connection
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Gateway connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Handle incoming Gateway messages
   */
  private handleMessage(data: string): void {
    try {
      const payload = JSON.parse(data);
      this.sequence = (payload.s as number) ?? this.sequence;

      switch (payload.op) {
        case GatewayOpcode.HELLO:
          this.handleHello(payload.d.heartbeat_interval);
          break;
        case GatewayOpcode.HEARTBEAT_ACK:
          // Heartbeat acknowledged
          break;
        case GatewayOpcode.INVALID_SESSION:
          // Session invalid, need to reconnect
          if (payload.d) {
            this.reconnect();
          }
          break;
        case GatewayOpcode.DISPATCH:
          this.handleDispatch(payload.t as string, payload.d);
          break;
      }
    } catch (error) {
      console.error('Failed to parse Gateway message:', error);
    }
  }

  /**
   * Handle HELLO opcode
   */
  private handleHello(heartbeatInterval: number): void {
    // Start heartbeating
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, heartbeatInterval);

    // Send IDENTIFY or RESUME
    if (this.sessionId) {
      this.sendResume();
    } else {
      this.sendIdentify();
    }
  }

  /**
   * Send IDENTIFY payload
   */
  private sendIdentify(): void {
    if (!this.ws) return;

    const identifyPayload = {
      op: GatewayOpcode.IDENTIFY,
      d: {
        token: this.token,
        properties: {
          os: process.platform,
          browser: 'clawdbot',
          device: 'clawdbot',
        },
        intents: this.intents,
      },
    };

    this.ws.send(JSON.stringify(identifyPayload));
  }

  /**
   * Send RESUME payload
   */
  private sendResume(): void {
    if (!this.ws || !this.sessionId) return;

    const resumePayload = {
      op: GatewayOpcode.RESUME,
      d: {
        token: this.token,
        session_id: this.sessionId,
        seq: this.sequence,
      },
    };

    this.ws.send(JSON.stringify(resumePayload));
  }

  /**
   * Send heartbeat
   */
  private sendHeartbeat(): void {
    if (!this.ws) return;

    this.ws.send(JSON.stringify({
      op: GatewayOpcode.HEARTBEAT,
      d: this.sequence,
    }));
  }

  /**
   * Handle dispatch events
   */
  private handleDispatch(eventType: string, data: unknown): void {
    this.connected = true;

    switch (eventType) {
      case 'READY':
        this.sessionId = (data as { session_id: string }).session_id;
        this.emit('ready', data as { user: DiscordUser; guilds: DiscordGuild[] });
        break;
      case 'MESSAGE_CREATE':
        this.emit('message', data as DiscordMessage);
        break;
      case 'GUILD_CREATE':
        this.emit('guildCreate', data as DiscordGuild);
        break;
      case 'GUILD_DELETE':
        this.emit('guildDelete', data as { id: string; unavailable?: boolean });
        break;
      case 'CHANNEL_CREATE':
        this.emit('channelCreate', data as DiscordChannel);
        break;
      case 'CHANNEL_DELETE':
        this.emit('channelDelete', data as DiscordChannel);
        break;
    }
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(code: number, reason: string): void {
    this.connected = false;

    // Clear heartbeat timer
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.emit('closed', { code, reason });

    // Auto reconnect
    if (this.autoReconnect && code !== GatewayCloseCode.INVALID_INTENTS) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(1000 * Math.pow(2, Math.floor(Math.random() * 5)), 60000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, delay);
  }

  /**
   * Attempt to reconnect
   */
  async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  }

  /**
   * Disconnect from Gateway
   */
  async disconnect(): Promise<void> {
    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.connected = false;
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Register event handler
   */
  on<K extends keyof GatewayEventMap>(
    event: K,
    handler: (data: GatewayEventMap[K]) => void
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as (data: unknown) => void);
  }

  /**
   * Remove event handler
   */
  off<K extends keyof GatewayEventMap>(
    event: K,
    handler: (data: GatewayEventMap[K]) => void
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler as (data: unknown) => void);
    }
  }

  /**
   * Emit event to handlers
   */
  private emit<K extends keyof GatewayEventMap>(
    event: K,
    data: GatewayEventMap[K]
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }
}

/**
 * Create Gateway instance from plugin config
 */
export function createGateway(
  config: DiscordPluginConfig
): DiscordGateway {
  return new DiscordGateway({
    token: config.token,
    proxyUrl: config.proxyUrl,
    intents: config.intents,
    autoReconnect: config.autoReconnect,
    heartbeatInterval: config.heartbeatInterval,
  });
}
