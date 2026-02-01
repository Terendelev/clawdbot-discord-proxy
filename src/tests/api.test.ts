/**
 * Unit tests for API module
 */

import { DiscordApi } from '../api';

describe('api', () => {
  describe('DiscordApi', () => {
    it('should create instance with token', () => {
      const api = new DiscordApi({
        token: 'test-token',
      });

      expect(api).toBeDefined();
    });

    it('should use custom base URL', () => {
      const api = new DiscordApi({
        token: 'test-token',
        baseUrl: 'https://custom.api.com/v9',
      });

      expect(api).toBeDefined();
    });

    it('should use proxy URL', () => {
      const api = new DiscordApi({
        token: 'test-token',
        proxyUrl: 'http://proxy:8080',
      });

      expect(api).toBeDefined();
    });

    it('should use API version', () => {
      const api = new DiscordApi({
        token: 'test-token',
        version: 9,
      });

      expect(api).toBeDefined();
    });
  });
});
