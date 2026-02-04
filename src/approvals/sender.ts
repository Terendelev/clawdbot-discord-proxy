/**
 * Approval request sender
 */

import { DiscordApi } from '../api';
import { ApprovalRequest, ApprovalDecision } from './types';
import { buildApprovalEmbed, buildApprovalButtons, buildResultEmbed, buildTimeoutEmbed } from './message';
import { approvalManager } from './manager';

/**
 * Send approval request to a user's DM
 *
 * @param api - Discord API instance
 * @param userId - Discord user ID to send to
 * @param request - The approval request
 */
export async function sendApprovalRequest(
  api: DiscordApi,
  userId: string,
  request: ApprovalRequest
): Promise<void> {
  // Create DM channel with the user
  const channel = await api.call<{ id: string }>({
    method: 'POST',
    path: '/users/@me/channels',
    body: { recipient_id: userId },
  });

  // Send approval message with buttons
  await api.call({
    method: 'POST',
    path: `/channels/${channel.id}/messages`,
    body: {
      embeds: [buildApprovalEmbed(request)],
      components: [buildApprovalButtons(request.id)],
    },
  });
}

/**
 * Send approval result to a user
 *
 * @param api - Discord API instance
 * @param userId - Discord user ID to send to
 * @param request - The approval request
 * @param decision - The decision made
 */
export async function sendApprovalResult(
  api: DiscordApi,
  userId: string,
  request: ApprovalRequest,
  decision: ApprovalDecision
): Promise<void> {
  try {
    // Create DM channel with the user
    const channel = await api.call<{ id: string }>({
      method: 'POST',
      path: '/users/@me/channels',
      body: { recipient_id: userId },
    });

    // Send result message
    await api.call({
      method: 'POST',
      path: `/channels/${channel.id}/messages`,
      body: {
        embeds: [buildResultEmbed(request, decision)],
      },
    });
  } catch (error) {
    console.error(`[Approvals] Failed to send approval result: ${error}`);
  }
}

/**
 * Handle component interaction (button click)
 *
 * @param api - Discord API instance
 * @param interaction - The component interaction
 */
export async function handleApprovalButton(
  api: DiscordApi,
  interaction: {
    id: string;
    custom_id: string;
    message: { id: string };
    user: { id: string };
  }
): Promise<void> {
  // Parse the custom_id: approval:{requestId}:{decision}
  const parts = interaction.custom_id.split(':');
  if (parts[0] !== 'approval' || parts.length !== 3) {
    return;
  }

  const requestId = parts[1];
  const decision = parts[2] as ApprovalDecision;

  // Validate decision
  if (!['allow-once', 'allow-always', 'deny'].includes(decision)) {
    return;
  }

  // Get the pending approval
  const request = approvalManager.getPendingApproval(requestId);
  if (!request) {
    // Already handled or expired
    try {
      await api.call({
        method: 'POST',
        path: `/interactions/${interaction.id}/${interaction.custom_id}/callback`,
        body: {
          type: 7, // Update message
          data: {
            content: '❌ 此审批请求已过期或已处理。',
            components: [],
          },
        },
      });
    } catch (e) {
      // Ignore
    }
    return;
  }

  // Handle the decision
  approvalManager.handleDecision(requestId, decision);

  // Acknowledge the button click
  try {
    await api.call({
      method: 'POST',
      path: `/interactions/${interaction.id}/${interaction.custom_id}/callback`,
      body: {
        type: 7, // Update message
        data: {
          embeds: [buildResultEmbed(request, decision)],
          components: [], // Remove buttons
        },
      },
    });
  } catch (error) {
    console.error(`[Approvals] Failed to acknowledge button: ${error}`);
  }
}
