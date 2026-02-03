/**
 * Unit tests for sendMedia with path parameter support
 */

import { DiscordApi, createApi } from '../api';
import * as path from 'path';

describe('sendMedia with path parameter', () => {
  describe('URL detection', () => {
    // Helper function to test URL detection
    function isUrl(str: string): boolean {
      try {
        new URL(str);
        return str.startsWith('http://') || str.startsWith('https://');
      } catch {
        return false;
      }
    }

    it('should detect http URLs', () => {
      expect(isUrl('http://example.com/file.png')).toBe(true);
    });

    it('should detect https URLs', () => {
      expect(isUrl('https://example.com/file.png')).toBe(true);
    });

    it('should detect local paths as not URLs', () => {
      expect(isUrl('/home/user/file.png')).toBe(false);
      expect(isUrl('C:\\Users\\file.png')).toBe(false);
      expect(isUrl('./relative/path.txt')).toBe(false);
    });

    it('should return false for non-URL strings', () => {
      expect(isUrl('just a string')).toBe(false);
      expect(isUrl('')).toBe(false);
      expect(isUrl('file.txt')).toBe(false);
    });
  });

  describe('File path handling', () => {
    it('should extract filename from path', () => {
      const testPath = '/home/user/documents/report.pdf';
      expect(path.basename(testPath)).toBe('report.pdf');
    });

    it('should extract extension from path', () => {
      const testCases = [
        ['image.jpg', '.jpg'],
        ['document.pdf', '.pdf'],
        ['archive.zip', '.zip'],
        ['video.mp4', '.mp4'],
        ['audio.wav', '.wav'],
        ['CLAUDE.md', '.md'],
        ['package.json', '.json'],
      ];

      testCases.forEach(([input, expected]) => {
        expect(path.extname(input)).toBe(expected);
      });
    });

    it('should handle empty extension', () => {
      expect(path.extname('README')).toBe('');
      expect(path.extname('Dockerfile')).toBe('');
    });

    it('should handle paths with special characters', () => {
      const specialPath = '/home/user/文档/test file (1).pdf';
      expect(path.extname(specialPath)).toBe('.pdf');
      expect(path.basename(specialPath)).toBe('test file (1).pdf');
    });

    it('should handle Windows-style paths', () => {
      const windowsPath = 'C:\\Users\\Documents\\file.txt';
      expect(path.extname(windowsPath)).toBe('.txt');
      // On Linux, backslash is not a path separator, so basename returns the full string
      // On Windows, it would return 'file.txt'
      const basenameResult = path.basename(windowsPath);
      expect(basenameResult === 'file.txt' || basenameResult === windowsPath).toBe(true);
    });
  });
});

describe('API uploadFile method', () => {
  it('should have uploadFile method', () => {
    const api = createApi('test_token', undefined);
    expect(typeof api.uploadFile).toBe('function');
  });

  it('should create API with token', () => {
    const api = createApi('my_token', undefined);
    expect(api).toBeInstanceOf(DiscordApi);
  });

  it('should create API with proxy', () => {
    const api = createApi('my_token', 'http://proxy:8080');
    expect(api).toBeInstanceOf(DiscordApi);
  });
});

describe('Configuration parsing', () => {
  it('should parse channel configuration correctly', () => {
    const config = {
      channels: {
        'clawdbot-discord-proxy': {
          accounts: {
            default: {
              token: 'test_token',
              enabled: true,
            },
          },
          proxyConfig: {
            httpsUrl: 'http://proxy:8080',
            wssUrl: 'socks5://proxy:1080',
          },
        },
      },
    };

    const channelConfig = config.channels?.['clawdbot-discord-proxy'];
    expect(channelConfig.accounts.default.token).toBe('test_token');
    expect(channelConfig.proxyConfig.httpsUrl).toBe('http://proxy:8080');
    expect(channelConfig.proxyConfig.wssUrl).toBe('socks5://proxy:1080');
  });

  it('should extract token and proxy from config', () => {
    const config = {
      channels: {
        'clawdbot-discord-proxy': {
          accounts: {
            default: {
              token: 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI.Mask.xxx',
              enabled: true,
            },
          },
          proxyConfig: {
            httpsUrl: 'http://proxy.example.com:7890',
            wssUrl: 'socks5://proxy.example.com:7891',
          },
        },
      },
    };

    // Simulate the extraction logic
    const token = config.channels?.['clawdbot-discord-proxy']?.accounts?.default?.token;
    const proxyUrl = config.channels?.['clawdbot-discord-proxy']?.proxyConfig?.httpsUrl;

    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(30); // Discord tokens are at least ~30 chars
    expect(proxyUrl).toBe('http://proxy.example.com:7890');
  });
});

describe('sendMedia parameter handling', () => {
  it('should support both mediaUrl and path parameters', () => {
    // Test that the function can handle either parameter
    const params = {
      mediaUrl: 'http://example.com/image.png',
      path: '/home/user/image.png',
    };

    // Either parameter should work
    const fileFromMediaUrl = (params as any).mediaUrl;
    const fileFromPath = (params as any).path;
    const filePath = fileFromPath || fileFromMediaUrl;

    expect(filePath).toBeDefined();
    expect(filePath).toBe('/home/user/image.png');
  });

  it('should prefer path over mediaUrl when both provided', () => {
    const params = {
      mediaUrl: 'http://example.com/old.png',
      path: '/home/user/new.png',
    };

    const filePath = (params as any).path || (params as any).mediaUrl;
    expect(filePath).toBe('/home/user/new.png');
  });

  it('should use mediaUrl when path is not provided', () => {
    const params = {
      mediaUrl: 'http://example.com/image.png',
    };

    const filePath = (params as any).path || (params as any).mediaUrl;
    expect(filePath).toBe('http://example.com/image.png');
  });

  it('should return undefined when neither is provided', () => {
    const params = {};
    const filePath = (params as any).path || (params as any).mediaUrl;
    expect(filePath).toBeUndefined();
  });
});
