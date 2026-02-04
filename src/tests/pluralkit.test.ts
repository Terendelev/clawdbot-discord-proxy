/**
 * PluralKit API Client Tests
 */

import { fetchPluralKitMessage, PluralKitConfig, PluralKitMessage } from '../pluralkit';

describe('PluralKit', () => {
  describe('fetchPluralKitMessage', () => {
    it('should return null when disabled', async () => {
      const config: PluralKitConfig = { enabled: false };
      const result = await fetchPluralKitMessage('123', config);
      expect(result).toBeNull();
    });

    it('should return null for non-existent message', async () => {
      const config: PluralKitConfig = { enabled: true, token: 'pk_test_token' };
      const result = await fetchPluralKitMessage('non-existent', config);
      expect(result).toBeNull();
    });

    it('should return null for API error', async () => {
      const config: PluralKitConfig = { enabled: true, token: 'invalid_token' };
      const result = await fetchPluralKitMessage('999999999999999999', config);
      expect(result).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      const config: PluralKitConfig = { enabled: true, token: 'valid_token' };
      const result = await fetchPluralKitMessage('1234567890', config);
      expect(result).toBeNull();
    });

    it('should extract system information correctly', async () => {
      const mockResponse: any = {
        id: 'test_message_id',
        original: 'Hello world',
        sender: 'real_user_id',
        system: {
          id: 'test_system_id',
          name: 'Test System',
          tag: '[TS]',
        },
        member: {
          id: 'test_member_id',
          name: 'Test Member',
          display_name: '测试成员',
        },
        content: '测试内容',
        timestamp: '2026-02-04T00:00:00.000Z',
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockResponse,
      });

      const config: PluralKitConfig = { enabled: true, token: 'pk_test_token' };
      const result = await fetchPluralKitMessage('1234567890', config);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe('test_message_id');
        expect(result.original).toBe('Hello world');
        expect(result.sender).toBe('real_user_id');
        expect(result.system?.id).toBe('test_system_id');
        expect(result.system?.name).toBe('Test System');
        expect(result.system?.tag).toBe('[TS]');
        expect(result.member?.id).toBe('test_member_id');
        expect(result.member?.name).toBe('Test Member');
        expect(result.member?.display_name).toBe('测试成员');
        expect(result.content).toBe('测试内容');
        expect(result.timestamp).toBe('2026-02-04T00:00:00.000Z');
      }

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.pluralkit.me/v2/messages/1234567890',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return null for 404 response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 404,
        ok: false,
      });

      const config: PluralKitConfig = { enabled: true, token: 'pk_test_token' };
      const result = await fetchPluralKitMessage('non_existent', config);

      expect(result).toBeNull();
    });

    it('should handle invalid token', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 401,
        ok: false,
        text: async () => 'Unauthorized',
      });

      const config: PluralKitConfig = { enabled: true, token: 'invalid_token' };
      const result = await fetchPluralKitMessage('1234567890', config);

      expect(result).toBeNull();
    });

    it('should handle API server errors', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 500,
        ok: false,
        text: async () => 'Internal Server Error',
      });

      const config: PluralKitConfig = { enabled: true, token: 'pk_test_token' };
      const result = await fetchPluralKitMessage('1234567890', config);

      expect(result).toBeNull();
    });

    it('should not include token in logs', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 401,
        ok: false,
        text: async () => 'Unauthorized',
      });

      const config: PluralKitConfig = { enabled: true, token: 'secret_token_123' };
      const result = await fetchPluralKitMessage('non_existent', config);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle network timeouts', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network timeout'));

      const config: PluralKitConfig = { enabled: true, token: 'pk_test_token' };
      const result = await fetchPluralKitMessage('1234567890', config);

      expect(result).toBeNull();
    });

    it('should handle malformed JSON responses', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const config: PluralKitConfig = { enabled: true, token: 'pk_test_token' };
      const result = await fetchPluralKitMessage('1234567890', config);

      expect(result).toBeNull();
    });

    it('should work with minimal system and member data', async () => {
      const mockResponse: any = {
        id: 'minimal_message',
        sender: 'real_user_id',
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockResponse,
      });

      const config: PluralKitConfig = { enabled: true, token: 'pk_test_token' };
      const result = await fetchPluralKitMessage('1234567890', config);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe('minimal_message');
        expect(result.sender).toBe('real_user_id');
        expect(result.system).toBeUndefined();
        expect(result.member).toBeUndefined();
      }
    });
  });
});
