/**
 * Clawdbot Discord Plugin
 *
 * Discord channel plugin with proxy support for Clawdbot.
 */

export { DiscordChannelPlugin } from './channel';
export { DiscordChannelPlugin as plugin } from './channel';
export * from './types';
export * from './config';

// OpenClaw plugin entry points
export async function register(api: unknown): Promise<void> {
  const { DiscordChannelPlugin } = await import('./channel');
  const plugin = new DiscordChannelPlugin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (api as any).registerChannel({ plugin });
}
