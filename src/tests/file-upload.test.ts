/**
 * Unit tests for file upload functionality
 */

import { DiscordApi, createApi } from '../api';
import * as path from 'path';

// Mock the proxy-agent to avoid actual network calls during unit tests
jest.mock('proxy-agent', () => ({
  ProxyAgent: jest.fn().mockImplementation(() => undefined),
}));

describe('File Upload', () => {
  let api: DiscordApi;

  beforeEach(() => {
    // Create API with mock token
    api = createApi('test_token', undefined);
  });

  describe('API Creation', () => {
    it('should create API with token', () => {
      const api = createApi('test_token', undefined);
      expect(api).toBeInstanceOf(DiscordApi);
    });

    it('should create API with proxy', () => {
      const api = createApi('test_token', 'http://proxy:8080');
      expect(api).toBeInstanceOf(DiscordApi);
    });
  });

  describe('uploadFile - error handling', () => {
    it('should throw error for non-existent local file', async () => {
      await expect(
        api.uploadFile('123456789', '/non/existent/file.jpg')
      ).rejects.toThrow();
    });

    it('should throw error for invalid URL', async () => {
      // Mock the internal downloadFile method by mocking the request
      // Since we can't access private methods, we test the public interface
      await expect(
        api.uploadFile('123456789', 'https://invalid.url/file.jpg')
      ).rejects.toThrow();
    });
  });

  describe('Message Creation', () => {
    it('should have createMessage method', () => {
      expect(typeof api.createMessage).toBe('function');
    });

    it('should have uploadFile method', () => {
      expect(typeof api.uploadFile).toBe('function');
    });

    it('should have getChannel method', () => {
      expect(typeof api.getChannel).toBe('function');
    });

    it('should have createDm method', () => {
      expect(typeof api.createDm).toBe('function');
    });
  });
});

describe('URL Detection Helper', () => {
  // Helper function to test URL detection logic
  function isUrl(str: string): boolean {
    try {
      new URL(str);
      return str.startsWith('http://') || str.startsWith('https://');
    } catch {
      return false;
    }
  }

  it('should return true for HTTP URLs', () => {
    expect(isUrl('http://example.com/image.png')).toBe(true);
  });

  it('should return true for HTTPS URLs', () => {
    expect(isUrl('https://example.com/image.png')).toBe(true);
  });

  it('should return false for local file paths (no protocol)', () => {
    expect(isUrl('/home/user/images/photo.jpg')).toBe(false);
    expect(isUrl('C:\\Users\\image.jpg')).toBe(false);
  });

  it('should return false for non-URL strings', () => {
    expect(isUrl('just a string')).toBe(false);
    expect(isUrl('')).toBe(false);
  });

  it('should return false for relative paths', () => {
    expect(isUrl('./images/photo.jpg')).toBe(false);
    expect(isUrl('../file.txt')).toBe(false);
  });
});

describe('MIME Type Helper', () => {
  // Helper function to test MIME type detection logic
  function getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  it('should return correct MIME type for images', () => {
    expect(getMimeType('photo.jpg')).toBe('image/jpeg');
    expect(getMimeType('image.png')).toBe('image/png');
    expect(getMimeType('animation.gif')).toBe('image/gif');
    expect(getMimeType('picture.webp')).toBe('image/webp');
  });

  it('should return correct MIME type for documents', () => {
    expect(getMimeType('document.pdf')).toBe('application/pdf');
    expect(getMimeType('archive.zip')).toBe('application/zip');
    expect(getMimeType('readme.txt')).toBe('text/plain');
  });

  it('should return correct MIME type for media', () => {
    expect(getMimeType('video.mp4')).toBe('video/mp4');
    expect(getMimeType('movie.mov')).toBe('video/quicktime');
    expect(getMimeType('song.mp3')).toBe('audio/mpeg');
    expect(getMimeType('audio.wav')).toBe('audio/wav');
  });

  it('should return octet-stream for unknown types', () => {
    expect(getMimeType('unknown.xyz')).toBe('application/octet-stream');
    expect(getMimeType('file')).toBe('application/octet-stream');
  });

  it('should handle uppercase extensions', () => {
    expect(getMimeType('file.PNG')).toBe('image/png');
    expect(getMimeType('file.JPG')).toBe('image/jpeg');
  });
});
