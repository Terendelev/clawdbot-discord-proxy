#!/usr/bin/env node
/**
 * Test script to upload CLAUDE.md to Discord user
 *
 * Usage: node upload-test.js
 *
 * Configuration is read from ~/.clawdbot/clawdbot.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createApi } = require('./dist/api');

// Path to CLAUDE.md
const FILE_PATH = path.join(__dirname, 'CLAUDE.md');

// Target user ID
const USER_ID = '988274067054428171';

/**
 * Read configuration from clawdbot config file
 */
function readClawdbotConfig() {
  const configPath = path.join(os.homedir(), '.clawdbot', 'clawdbot.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const configContent = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configContent);

  return config;
}

/**
 * Get Discord token from config
 */
function getDiscordToken(config) {
  // Try clawdbot-discord-proxy first
  const discordProxy = config.channels?.['clawdbot-discord-proxy'];
  if (discordProxy?.accounts?.default?.token) {
    return discordProxy.accounts.default.token;
  }

  // Fallback to old discord config
  const discord = config.channels?.discord;
  if (discord?.token && discord.token !== 'xxx') {
    return discord.token;
  }

  throw new Error('Discord token not found in config');
}

/**
 * Get HTTP proxy URL from config
 */
function getProxyUrl(config) {
  const discordProxy = config.channels?.['clawdbot-discord-proxy'];

  if (discordProxy?.proxyConfig?.httpsUrl) {
    return discordProxy.proxyConfig.httpsUrl;
  }

  if (discordProxy?.proxyConfig?.httpUrl) {
    return discordProxy.proxyConfig.httpUrl;
  }

  return undefined;
}

async function uploadTest() {
  console.log('=== Discord File Upload Test ===\n');

  // Read configuration
  console.log('Reading configuration from ~/.clawdbot/clawdbot.json...');
  const config = readClawdbotConfig();

  const TOKEN = getDiscordToken(config);
  const PROXY_URL = getProxyUrl(config);

  console.log(`Token: ${TOKEN.substring(0, 20)}...`);
  console.log(`Proxy: ${PROXY_URL || 'none'}\n`);

  // Check if file exists
  if (!fs.existsSync(FILE_PATH)) {
    console.error(`Error: File not found: ${FILE_PATH}`);
    process.exit(1);
  }

  // Get file info
  const stats = fs.statSync(FILE_PATH);
  console.log(`File: ${FILE_PATH}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB\n`);

  // Create API client
  const api = createApi(TOKEN, PROXY_URL);
  console.log('API client created\n');

  try {
    // Step 1: Create DM channel with user
    console.log(`Creating DM channel with user ${USER_ID}...`);
    const dmChannel = await api.createDm(USER_ID);
    console.log(`DM Channel ID: ${dmChannel.id}\n`);

    // Step 2: Upload file
    console.log('Uploading CLAUDE.md...');
    const message = await api.uploadFile(dmChannel.id, FILE_PATH, {
      content: '这是 CLAUDE.md 测试文件',
      filename: 'CLAUDE.md',
      description: 'Clawdbot Discord 插件的项目说明文档',
    });

    console.log('\n=== Upload Successful! ===');
    console.log(`Message ID: ${message.id}`);
    console.log(`Channel ID: ${message.channel_id}`);
    console.log(`Content: "${message.content}"`);
    console.log(`Attachments: ${message.attachments?.length || 0}`);

    if (message.attachments && message.attachments.length > 0) {
      const att = message.attachments[0];
      console.log(`  - ${att.filename} (${(att.size / 1024).toFixed(2)} KB)`);
    }

  } catch (error) {
    console.error('\n=== Upload Failed ===');
    console.error(`Error: ${error.message}`);

    if (error.message.includes('401')) {
      console.error('\nHint: Token may be invalid');
    } else if (error.message.includes('403')) {
      console.error('\nHint: Bot may not have permission to send DMs to this user');
    } else if (error.message.includes('500')) {
      console.error('\nHint: Discord server error, try again later');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('\nHint: Proxy connection refused. Check proxy settings in clawdbot.json');
    } else if (error.message.includes('ECONNRESET')) {
      console.error('\nHint: Connection reset. Check proxy settings or network connectivity');
    }

    process.exit(1);
  }
}

// Run test
uploadTest().then(() => {
  console.log('\nTest completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
