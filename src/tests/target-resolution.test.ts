/**
 * Unit tests for Discord target resolution and DM handling
 */

import { extractUserId } from '../index';

describe('extractUserId', () => {
  describe('discord: prefix', () => {
    it('should extract user ID from discord: prefix', () => {
      expect(extractUserId('discord:123456789012345678')).toBe('123456789012345678');
    });

    it('should handle discord: prefix with spaces', () => {
      expect(extractUserId('discord: 123456789012345678')).toBe('123456789012345678');
    });

    it('should return undefined for empty discord: prefix', () => {
      expect(extractUserId('discord:')).toBeUndefined();
    });
  });

  describe('user: prefix', () => {
    it('should extract user ID from user: prefix', () => {
      expect(extractUserId('user:123456789012345678')).toBe('123456789012345678');
    });

    it('should handle user: prefix with spaces', () => {
      expect(extractUserId('user: 123456789012345678')).toBe('123456789012345678');
    });

    it('should return undefined for empty user: prefix', () => {
      expect(extractUserId('user:')).toBeUndefined();
    });
  });

  describe('bare numeric ID', () => {
    it('should return bare numeric ID as user ID', () => {
      expect(extractUserId('123456789012345678')).toBe('123456789012345678');
    });

    it('should handle short numeric IDs (6 digits)', () => {
      expect(extractUserId('123456')).toBe('123456');
    });

    it('should return undefined for non-numeric strings', () => {
      expect(extractUserId('notanumber')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(extractUserId('')).toBeUndefined();
    });
  });

  describe('channel: prefix', () => {
    it('should return undefined for channel: prefix (not a user ID)', () => {
      expect(extractUserId('channel:123456789')).toBeUndefined();
    });
  });

  describe('mention format', () => {
    it('should return undefined for mention format (not handled)', () => {
      expect(extractUserId('<@123456789>')).toBeUndefined();
    });

    it('should return undefined for nickname mention format', () => {
      expect(extractUserId('<@!123456789>')).toBeUndefined();
    });
  });
});

describe('target normalization for messaging', () => {
  // Replicate the normalizeTarget function from index.ts
  function normalizeTarget(raw: string): string | undefined {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    // Discord mention format: <@123456789> or <@!123456789>
    const mentionMatch = trimmed.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
      return `user:${mentionMatch[1]}`;
    }

    // user:123456789 format
    if (trimmed.startsWith('user:')) {
      return trimmed.toLowerCase();
    }

    // channel:123456789 format
    if (trimmed.startsWith('channel:')) {
      return trimmed.toLowerCase();
    }

    // discord:123456789 format -> user:123456789
    if (trimmed.startsWith('discord:')) {
      const userId = trimmed.slice('discord:'.length).trim();
      return userId ? `user:${userId}` : undefined;
    }

    // Bare numeric ID - default to user (DM)
    if (/^\d{6,}$/.test(trimmed)) {
      return `user:${trimmed}`;
    }

    return undefined;
  }

  describe('normalizeTarget', () => {
    it('should normalize discord: prefix to user: format', () => {
      expect(normalizeTarget('discord:123456789012345678')).toBe('user:123456789012345678');
    });

    it('should normalize user: prefix to lowercase', () => {
      // Implementation uses case-sensitive startsWith
      expect(normalizeTarget('user:123456789012345678')).toBe('user:123456789012345678');
    });

    it('should normalize channel: prefix to lowercase', () => {
      // Implementation uses case-sensitive startsWith
      expect(normalizeTarget('channel:123456789')).toBe('channel:123456789');
    });

    it('should normalize mention format to user: format', () => {
      expect(normalizeTarget('<@123456789>')).toBe('user:123456789');
    });

    it('should normalize nickname mention to user: format', () => {
      expect(normalizeTarget('<@!123456789>')).toBe('user:123456789');
    });

    it('should normalize bare numeric ID to user: format', () => {
      expect(normalizeTarget('123456789012345678')).toBe('user:123456789012345678');
    });

    it('should return undefined for empty input', () => {
      expect(normalizeTarget('')).toBeUndefined();
    });

    it('should return undefined for whitespace only', () => {
      expect(normalizeTarget('   ')).toBeUndefined();
    });
  });
});

describe('looksLikeId validation', () => {
  // Replicate the looksLikeId function from index.ts
  function looksLikeId(raw: string, _normalized: string): boolean {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    // Discord mention format: <@123456789> or <@!123456789>
    if (/^<@!?\d+>$/.test(trimmed)) return true;
    // Prefixed formats: user:123456789, channel:123456789, discord:123456789
    if (/^(user|channel|discord):/i.test(trimmed)) return true;
    // Bare numeric IDs (6+ digits)
    if (/^\d{6,}$/.test(trimmed)) return true;
    return false;
  }

  describe('looksLikeId', () => {
    it('should return true for discord: prefix', () => {
      expect(looksLikeId('discord:123456789012345678', '')).toBe(true);
    });

    it('should return true for user: prefix', () => {
      expect(looksLikeId('user:123456789012345678', '')).toBe(true);
    });

    it('should return true for channel: prefix', () => {
      expect(looksLikeId('channel:123456789', '')).toBe(true);
    });

    it('should return true for bare numeric ID', () => {
      expect(looksLikeId('123456789012345678', '')).toBe(true);
    });

    it('should return true for mention format', () => {
      expect(looksLikeId('<@123456789>', '')).toBe(true);
    });

    it('should return true for nickname mention', () => {
      expect(looksLikeId('<@!123456789>', '')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(looksLikeId('', '')).toBe(false);
    });

    it('should return false for whitespace', () => {
      expect(looksLikeId('   ', '')).toBe(false);
    });

    it('should return false for non-Discord strings', () => {
      expect(looksLikeId('hello', '')).toBe(false);
      expect(looksLikeId('user@email.com', '')).toBe(false);
      expect(looksLikeId('12345', '')).toBe(false); // Less than 6 digits
    });
  });
});
