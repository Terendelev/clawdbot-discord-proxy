/**
 * Exec Approvals type definitions
 */

export interface ApprovalConfig {
  enabled: boolean;
  approvers: string[]; // Discord user IDs who can approve
  timeoutSeconds: number;
}

export interface ApprovalRequest {
  id: string;
  command: string;
  sanitizedCommand: string;
  agentId: string;
  status: 'pending' | 'approved' | 'denied';
  decision?: ApprovalDecision;
  createdAt: number;
  expiresAt: number;
}

export type ApprovalDecision = 'allow-once' | 'allow-always' | 'deny';

export interface PendingApproval {
  request: ApprovalRequest;
  resolve: (decision: ApprovalDecision | null) => void;
  reject: (error: Error) => void;
}
