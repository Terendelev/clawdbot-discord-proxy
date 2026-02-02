/**
 * Clawdbot Discord Plugin
 *
 * Discord channel plugin with proxy support for Clawdbot.
 */

export { DiscordChannelPlugin } from './channel';
export { DiscordChannelPlugin as plugin } from './channel';
export * from './types';
export * from './config';

// OpenClaw plugin entry - default export for plugin loading
export default function register(api: unknown): void {
  const { DiscordChannelPlugin } = require('./channel');
  const plugin = new DiscordChannelPlugin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (api as any).registerChannel({ plugin });
}
