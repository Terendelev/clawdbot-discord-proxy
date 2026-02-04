/**
 * Command response utilities
 */

import { DiscordApi } from '../api';

/**
 * Send a response to a command interaction
 *
 * @param api - Discord API instance
 * @param interactionId - Interaction ID
 * @param interactionToken - Interaction token
 * @param content - Response content
 */
export async function sendCommandResponse(
  api: DiscordApi,
  interactionId: string,
  interactionToken: string,
  content: string
): Promise<void> {
  await api.call({
    method: 'POST',
    path: `/interactions/${interactionId}/${interactionToken}/callback`,
    body: {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: content,
      },
    },
  });
}

/**
 * Send an ephemeral response (only visible to the user)
 *
 * @param api - Discord API instance
 * @param interactionId - Interaction ID
 * @param interactionToken - Interaction token
 * @param content - Response content
 */
export async function sendEphemeralResponse(
  api: DiscordApi,
  interactionId: string,
  interactionToken: string,
  content: string
): Promise<void> {
  await api.call({
    method: 'POST',
    path: `/interactions/${interactionId}/${interactionToken}/callback`,
    body: {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: content,
        flags: 64, // EPHEMERAL
      },
    },
  });
}
