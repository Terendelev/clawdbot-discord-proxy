/**
 * Dangerous command detection and sanitization
 */

const DANGEROUS_PATTERNS = [
  /rm\s+-rf/,
  /rm\s+-r/,
  /sudo\s+/,
  /chmod\s+0[0-9]{3}/,
  /chmod\s+777/,
  /mkfs/,
  />\s*\/?dev/,
  /dd\s+/,
  /eval\s+/,
  /exec\s+/,
  /cat\s+\/etc\/passwd/,
  /wget\s+.*\|/,
  /curl\s+.*\|/,
  /nc\s+-e/,
  /\/bin\/sh/,
  /\/bin\/bash.*-c/,
];

const SENSITIVE_PATTERNS = [
  /--token[=\s]+[\w-]+/g,
  /-k\s+['"][^'"]+['"]/g,
  /--api-key[=\s]+[\w-]+/g,
  /password\s*[=:]\s*['"][^'"]+['"]/gi,
];

/**
 * Check if a command is dangerous
 *
 * @param command - The command to check
 * @returns true if the command is potentially dangerous
 */
export function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}

/**
 * Sanitize a command by redacting sensitive information
 *
 * @param command - The command to sanitize
 * @returns Sanitized command
 */
export function sanitizeCommand(command: string): string {
  let sanitized = command;

  // Redact sensitive information
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '<REDACTED>');
  }

  return sanitized;
}

/**
 * Get a description of why a command is flagged as dangerous
 *
 * @param command - The command to analyze
 * @returns Description of the danger, or empty string if safe
 */
export function getDangerReason(command: string): string {
  if (/rm\s+-rf/.test(command)) {
    return 'Contains recursive delete (rm -rf)';
  }
  if (/rm\s+-r/.test(command)) {
    return 'Contains recursive delete (rm -r)';
  }
  if (/sudo\s+/.test(command)) {
    return 'Contains sudo command';
  }
  if (/chmod\s+0[0-9]{3}/.test(command)) {
    return 'Contains permission change to dangerous level';
  }
  if (/chmod\s+777/.test(command)) {
    return 'Contains chmod 777';
  }
  if (/mkfs/.test(command)) {
    return 'Contains filesystem format command';
  }
  if (/>\s*\/?dev/.test(command)) {
    return 'Contains device file write';
  }
  if (/dd\s+/.test(command)) {
    return 'Contains dd command (disk operations)';
  }
  if (/eval\s+/.test(command)) {
    return 'Contains eval (code execution)';
  }
  if (/exec\s+/.test(command)) {
    return 'Contains exec command';
  }
  if (/cat\s+\/etc\/passwd/.test(command)) {
    return 'Contains passwd file read';
  }
  if (/\|\s*(wget|curl)/.test(command)) {
    return 'Contains pipe to download command';
  }
  if (/nc\s+-e/.test(command)) {
    return 'Contains netcat with execute';
  }
  if (/\/bin\/sh/.test(command) || /\/bin\/bash.*-c/.test(command)) {
    return 'Contains shell execution';
  }

  return '';
}
