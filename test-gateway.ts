/**
 * Simple gateway test script
 *
 * This script verifies that the Discord gateway can:
 * 1. Connect via proxy
 * 2. Receive messages
 */

import { DiscordGateway, createGateway } from './src/gateway';
import { GatewayIntent } from './src/types';

const TEST_TOKEN = process.env.DISCORD_TEST_TOKEN || '';
const TEST_PROXY_URL = process.env.DISCORD_PROXY_URL || '';

async function testGateway() {
  console.log('=== Discord Gateway Test ===\n');

  const config = {
    enabled: true,
    token: TEST_TOKEN,
    proxyUrl: TEST_PROXY_URL,
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
  let messageCount = 0;
  let connected = false;

  // Event handlers
  gateway.on('ready', (data: any) => {
    connected = true;
    console.log(`✓ Gateway connected as ${data.user.username}#${data.user.discriminator}`);
  });

  gateway.on('message', (message: any) => {
    messageCount++;
    console.log(`✓ Received message #${messageCount}: ${message.author.username}: ${message.content?.substring(0, 80)}`);
  });

  gateway.on('error', (error: Error) => {
    console.error(`✗ Gateway error: ${error.message}`);
  });

  gateway.on('closed', (data: any) => {
    console.log(`Gateway closed: ${data.code} ${data.reason}`);
    connected = false;
  });

  console.log('Connecting to Discord via proxy...');
  await gateway.connect();

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 5000));

  if (connected) {
    console.log('\n✓ Connection successful!');
    console.log('Waiting for messages (Ctrl+C to exit)...');

    // Keep running for 30 seconds to receive any messages
    await new Promise(resolve => setTimeout(resolve, 30000));
  } else {
    console.log('\n✗ Failed to connect');
  }

  // Clean up
  console.log('\nDisconnecting...');
  await gateway.disconnect();
  console.log('Test complete.');
}

// Run the test
testGateway().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
