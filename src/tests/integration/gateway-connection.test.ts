/**
 * Integration tests for Discord gateway with proxy
 *
 * These tests verify that the gateway can:
 * 1. Connect to Discord via proxy
 * 2. Send and receive messages
 */

import { DiscordGateway, createGateway } from '../../gateway';
import { DiscordApi, createApi } from '../../api';
import { GatewayIntent } from '../../types';

// Test configuration from environment variables or config file
// For CLI: export DISCORD_TEST_TOKEN="..." DISCORD_PROXY_URL="..." DISCORD_WS_PROXY_URL="..."
const TEST_TOKEN = process.env.DISCORD_TEST_TOKEN || '';
// HTTP/HTTPS proxy for REST API
const TEST_PROXY_URL = process.env.DISCORD_PROXY_URL || '';
// SOCKS5 proxy for WebSocket Gateway (required for Discord)
const TEST_WS_PROXY_URL = process.env.DISCORD_WS_PROXY_URL || '';
const TEST_USER_ID = process.env.DISCORD_TEST_USER_ID || '';

describe('Discord Gateway Integration', () => {
  // Increase Jest timeout for integration tests
  jest.setTimeout(90000);

  describe('connection via proxy', () => {
    it('should connect to Discord gateway through proxy', async () => {
      const config = {
        enabled: true,
        token: TEST_TOKEN,
        proxyUrl: TEST_WS_PROXY_URL,  // SOCKS5 for WebSocket
        intents: [
          GatewayIntent.GUILDS,
          GatewayIntent.GUILD_MESSAGES,
          GatewayIntent.DIRECT_MESSAGES,
          GatewayIntent.MESSAGE_CONTENT,
        ],
        autoReconnect: false,
        heartbeatInterval: 45000,
      };

      const gateway = createGateway(config);

      let readyEventFired = false;
      let connectionError: Error | null = null;

      gateway.on('ready', () => {
        readyEventFired = true;
      });

      gateway.on('error', (error: Error) => {
        connectionError = error;
      });

      gateway.on('closed', () => {
        // Connection closed expected
      });

      // Use Promise to wait for ready event
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Ready event not received within timeout'));
        }, 20000);

        gateway.on('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // Give some time for additional events
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Clean disconnect
      await gateway.disconnect();

      // Verify
      expect(connectionError).toBeNull();
      expect(readyEventFired).toBe(true);
    }, 60000);
  });

  describe('API and Gateway interaction', () => {
    it('should send message via API and verify gateway is connected', async () => {
      // Step 1: Create API client
      const api = createApi(TEST_TOKEN, TEST_PROXY_URL);

      // Step 2: Create DM channel
      const channel = await api.createDm(TEST_USER_ID);
      const dmChannelId = channel.id;
      console.log('DM Channel created:', dmChannelId);

      // Step 3: Create gateway connection
      const config = {
        enabled: true,
        token: TEST_TOKEN,
        proxyUrl: TEST_WS_PROXY_URL,  // SOCKS5 for WebSocket
        intents: [
          GatewayIntent.GUILDS,
          GatewayIntent.GUILD_MESSAGES,
          GatewayIntent.DIRECT_MESSAGES,
          GatewayIntent.MESSAGE_CONTENT,
        ],
        autoReconnect: false,
        heartbeatInterval: 45000,
      };

      const gateway = createGateway(config);

      let gatewayReady = false;
      let messageCount = 0;

      gateway.on('ready', () => {
        gatewayReady = true;
        console.log('Gateway ready - listening for messages');
      });

      gateway.on('message', (message: any) => {
        messageCount++;
        console.log(`Message ${messageCount}: ${message.author.username}: ${message.content?.substring(0, 100)}`);
      });

      gateway.on('error', (error: Error) => {
        console.error('Gateway error:', error.message);
      });

      // Step 4: Connect to gateway
      await gateway.connect();

      // Wait for gateway to be ready
      await new Promise((resolve) => setTimeout(resolve, 5000));

      expect(gatewayReady).toBe(true);

      // Step 5: Send a test message via API
      const testContent = `Integration test ${Date.now()}`;
      const sentMessage = await api.createMessage(dmChannelId, testContent);
      console.log('Message sent via API:', sentMessage.id);

      // Step 6: Wait a bit for any incoming messages
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Step 7: Clean up
      await gateway.disconnect();

      // Verify
      expect(sentMessage.id).toBeDefined();
      expect(sentMessage.id.length).toBeGreaterThan(0);
    }, 90000);
  });

  describe('message event handling', () => {
    it('should properly emit ready event', async () => {
      const config = {
        enabled: true,
        token: TEST_TOKEN,
        proxyUrl: TEST_WS_PROXY_URL,  // SOCKS5 for WebSocket
        intents: [
          GatewayIntent.GUILD_MESSAGES,
          GatewayIntent.DIRECT_MESSAGES,
          GatewayIntent.MESSAGE_CONTENT,
        ],
        autoReconnect: false,
        heartbeatInterval: 45000,
      };

      const gateway = createGateway(config);

      const readyHandler = jest.fn();
      const errorHandler = jest.fn();

      gateway.on('ready', readyHandler);
      gateway.on('error', errorHandler);

      await gateway.connect();

      // Wait for ready event
      await new Promise((resolve) => setTimeout(resolve, 5000));

      await gateway.disconnect();

      expect(readyHandler).toHaveBeenCalled();
      expect(errorHandler).not.toHaveBeenCalled();
    }, 60000);
  });

  describe('concurrent connections', () => {
    it('should handle multiple gateways with same token', async () => {
      const config = {
        enabled: true,
        token: TEST_TOKEN,
        proxyUrl: TEST_WS_PROXY_URL,  // SOCKS5 for WebSocket
        intents: [GatewayIntent.DIRECT_MESSAGES],
        autoReconnect: false,
        heartbeatInterval: 45000,
      };

      const gateway1 = createGateway(config);
      const gateway2 = createGateway(config);

      const ready1 = jest.fn();
      const ready2 = jest.fn();

      gateway1.on('ready', ready1);
      gateway2.on('ready', ready2);

      await Promise.all([
        gateway1.connect().then(() => new Promise(r => setTimeout(r, 5000))),
        gateway2.connect().then(() => new Promise(r => setTimeout(r, 5000))),
      ]);

      await Promise.all([gateway1.disconnect(), gateway2.disconnect()]);

      // Both gateways should have received ready event
      expect(ready1).toHaveBeenCalled();
      expect(ready2).toHaveBeenCalled();
    }, 60000);
  });
});
