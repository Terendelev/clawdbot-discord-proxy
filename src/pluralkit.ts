/**
 * PluralKit API Client
 *
 * Handles interaction with PluralKit API for proxy message detection
 */

import { ProxyAgent } from 'proxy-agent';

export interface PluralKitConfig {
  enabled: boolean;
  token?: string;
}

export interface PluralKitSystem {
  id: string;
  name?: string | null;
  tag?: string | null;
  avatar?: string | null;
}

export interface PluralKitMember {
  id: string;
  name?: string | null;
  display_name?: string | null;
  color?: string | null;
  avatar?: string | null;
}

export interface PluralKitMessage {
  id: string;
  original?: string;
  sender?: string;
  system?: PluralKitSystem;
  member?: PluralKitMember;
  content?: string;
  timestamp?: string;
}

const PLURALKIT_API_BASE = 'https://api.pluralkit.me/v2';

/**
 * Get proxy agent for HTTP requests
 * Uses DISCORD_PROXY env var if no explicit proxyUrl provided
 */
function getProxyAgent(proxyUrl?: string): ProxyAgent | undefined {
  const url = proxyUrl || process.env.DISCORD_PROXY;
  if (!url) {
    return undefined;
  }
  // ProxyAgent accepts string URL directly
  return new ProxyAgent(url as any);
}

/**
 * Fetch PluralKit message information
 *
 * @param messageId - Discord message ID
 * @param config - PluralKit configuration
 * @param proxyUrl - Optional proxy URL
 * @returns PluralKitMessage or null if not a PluralKit message or API fails
 */
export async function fetchPluralKitMessage(
  messageId: string,
  config: PluralKitConfig,
  proxyUrl?: string
): Promise<PluralKitMessage | null> {
  if (!config.enabled) {
    return null;
  }

  const headers: Record<string, string> = {};
  if (config.token?.trim()) {
    headers['Authorization'] = config.token.trim();
  }

  try {
    const agent = getProxyAgent(proxyUrl);

    const response = await fetch(`${PLURALKIT_API_BASE}/messages/${messageId}`, {
      method: 'GET',
      headers,
      ...(agent ? { agent } : {}),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = text.trim() ? `: ${text.trim()}` : '';
      console.warn(`PluralKit API failed (${response.status})${detail}`);
      return null;
    }

    const data = await response.json() as any;
    
    return {
      id: data.id || '',
      original: data.original,
      sender: data.sender,
      system: data.system ? {
        id: data.system.id,
        name: data.system.name,
        tag: data.system.tag,
      } : undefined,
      member: data.member ? {
        id: data.member.id,
        name: data.member.name,
        display_name: data.member.display_name,
      } : undefined,
      content: data.content,
      timestamp: data.timestamp,
    };
  } catch (error) {
    console.warn(`PluralKit API error: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}
