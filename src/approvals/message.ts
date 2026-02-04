/**
 * Approval message and embed builder
 */

import { ApprovalRequest, ApprovalDecision } from './types';
import { getDangerReason } from './safety';

/**
 * Build an approval request embed
 *
 * @param request - The approval request
 * @returns Discord embed object
 */
export function buildApprovalEmbed(request: ApprovalRequest) {
  const reason = getDangerReason(request.command);
  const timeRemaining = Math.round((request.expiresAt - Date.now()) / 1000);

  return {
    title: '🔒 执行审批请求',
    description: 'AI 尝试执行以下潜在危险命令，需要您的批准。',
    color: 0xFFA500, // Orange
    fields: [
      {
        name: '⚠️ 危险原因',
        value: reason || '检测到潜在危险操作',
        inline: false,
      },
      {
        name: '📝 命令',
        value: `\`\`\`bash\n${request.sanitizedCommand}\n\`\`\``,
        inline: false,
      },
      {
        name: '🤖 Agent',
        value: request.agentId,
        inline: true,
      },
      {
        name: '⏱️ 超时',
        value: `${timeRemaining}秒`,
        inline: true,
      },
    ],
    footer: {
      text: `请求 ID: ${request.id}`,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build approval action buttons
 *
 * @param requestId - The approval request ID
 * @returns Discord action row with buttons
 */
export function buildApprovalButtons(requestId: string) {
  return {
    type: 1,
    components: [
      {
        type: 2,
        style: 3, // Green
        custom_id: `approval:${requestId}:allow-once`,
        label: '允许一次',
        emoji: { name: '✅' },
      },
      {
        type: 2,
        style: 1, // Primary (blue)
        custom_id: `approval:${requestId}:allow-always`,
        label: '始终允许',
        emoji: { name: '🔓' },
      },
      {
        type: 2,
        style: 4, // Red
        custom_id: `approval:${requestId}:deny`,
        label: '拒绝',
        emoji: { name: '❌' },
      },
    ],
  };
}

/**
 * Build approval result embed
 *
 * @param request - The approval request
 * @param decision - The decision made
 * @returns Discord embed object
 */
export function buildResultEmbed(request: ApprovalRequest, decision: ApprovalDecision) {
  const colors = {
    'allow-once': 0x00FF00,
    'allow-always': 0x00FF00,
    'deny': 0xFF0000,
  };

  const titles = {
    'allow-once': '✅ 命令已批准（本次）',
    'allow-always': '🔓 命令已批准（始终）',
    'deny': '❌ 命令已被拒绝',
  };

  return {
    title: titles[decision],
    color: colors[decision],
    fields: [
      {
        name: '📝 命令',
        value: `\`\`\`bash\n${request.sanitizedCommand}\n\`\`\``,
        inline: false,
      },
      {
        name: '🤖 Agent',
        value: request.agentId,
        inline: true,
      },
      {
        name: '⏰ 决定时间',
        value: new Date().toISOString(),
        inline: true,
      },
    ],
  };
}

/**
 * Build timeout embed when approval expires
 *
 * @param request - The approval request
 * @returns Discord embed object
 */
export function buildTimeoutEmbed(request: ApprovalRequest) {
  return {
    title: '⏰ 审批超时',
    description: '审批请求已超时，命令已被拒绝。',
    color: 0x808080, // Gray
    fields: [
      {
        name: '📝 命令',
        value: `\`\`\`bash\n${request.sanitizedCommand}\n\`\`\``,
        inline: false,
      },
    ],
  };
}
