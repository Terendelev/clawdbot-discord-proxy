/**
 * Approval request manager
 */

import { ApprovalRequest, ApprovalDecision, ApprovalConfig, PendingApproval } from './types';
import { sanitizeCommand } from './safety';

class ApprovalManager {
  private approvals = new Map<string, PendingApproval>();
  private allowAlwaysCache = new Set<string>(); // Commands that are always allowed

  /**
   * Request approval for a dangerous command
   *
   * @param command - The command to approve
   * @param agentId - The agent ID requesting approval
   * @param config - Approval configuration
   * @returns Promise resolving to the approval request
   */
  async requestApproval(
    command: string,
    agentId: string,
    config: ApprovalConfig
  ): Promise<ApprovalRequest> {
    const id = crypto.randomUUID();
    const sanitized = sanitizeCommand(command);

    const request: ApprovalRequest = {
      id,
      command,
      sanitizedCommand: sanitized,
      agentId,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + config.timeoutSeconds * 1000,
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.handleDecision(id, 'deny');
        const pending = this.approvals.get(id);
        if (pending) {
          pending.resolve(null);
          this.approvals.delete(id);
        }
      }, config.timeoutSeconds * 1000);

      this.approvals.set(id, {
        request,
        resolve: (decision: ApprovalDecision | null) => {
          clearTimeout(timeoutId);
          resolve(decision ? { ...request, status: decision === 'deny' ? 'denied' : 'approved', decision } : request);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
          this.approvals.delete(id);
        },
      });
    });
  }

  /**
   * Handle a user's decision on an approval request
   *
   * @param requestId - The approval request ID
   * @param decision - The user's decision
   */
  handleDecision(requestId: string, decision: ApprovalDecision): void {
    const pending = this.approvals.get(requestId);
    if (!pending) {
      return;
    }

    pending.request.status = decision === 'deny' ? 'denied' : 'approved';
    pending.request.decision = decision;

    // Handle "always allow" decision
    if (decision === 'allow-always') {
      const cacheKey = this.getCommandHash(pending.request.sanitizedCommand);
      this.allowAlwaysCache.add(cacheKey);
    }

    pending.resolve(decision);
    this.approvals.delete(requestId);
  }

  /**
   * Check if a command is in the "always allow" cache
   *
   * @param command - The command to check
   * @returns true if the command should always be allowed
   */
  isAlwaysAllowed(command: string): boolean {
    const sanitized = sanitizeCommand(command);
    const cacheKey = this.getCommandHash(sanitized);
    return this.allowAlwaysCache.has(cacheKey);
  }

  /**
   * Get a pending approval request by ID
   *
   * @param requestId - The approval request ID
   * @returns The pending approval or undefined
   */
  getPendingApproval(requestId: string): ApprovalRequest | undefined {
    return this.approvals.get(requestId)?.request;
  }

  /**
   * Clean up expired approvals
   */
  cleanup(): void {
    const now = Date.now();
    for (const [id, pending] of this.approvals) {
      if (pending.request.expiresAt < now) {
        this.handleDecision(id, 'deny');
      }
    }
  }

  /**
   * Clear all pending approvals
   */
  clear(): void {
    for (const [id, pending] of this.approvals) {
      pending.resolve(null);
    }
    this.approvals.clear();
  }

  /**
   * Get a simple hash for command caching
   */
  private getCommandHash(command: string): string {
    let hash = 0;
    for (let i = 0; i < command.length; i++) {
      const char = command.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
}

export const approvalManager = new ApprovalManager();
