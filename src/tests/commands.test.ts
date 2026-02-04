/**
 * Unit tests for command parsing
 */

import { parseCommandInteraction } from '../commands/parse';

describe('Commands', () => {
  describe('parseCommandInteraction', () => {
    it('should parse basic command without options', () => {
      const result = parseCommandInteraction({
        name: 'oc-status',
      });

      expect(result.name).toBe('oc-status');
      expect(result.options).toEqual({});
    });

    it('should parse command with string option', () => {
      const result = parseCommandInteraction({
        name: 'test',
        options: [
          { name: 'username', type: 3, value: 'john' },
        ],
      });

      expect(result.name).toBe('test');
      expect(result.options.username).toBe('john');
    });

    it('should parse command with boolean option (string true)', () => {
      const result = parseCommandInteraction({
        name: 'oc-status',
        options: [
          { name: 'detail', type: 5, value: 'true' },
        ],
      });

      expect(result.name).toBe('oc-status');
      expect(result.options.detail).toBe(true);
    });

    it('should parse command with boolean option (boolean true)', () => {
      const result = parseCommandInteraction({
        name: 'oc-status',
        options: [
          { name: 'detail', type: 5, value: true },
        ],
      });

      expect(result.name).toBe('oc-status');
      expect(result.options.detail).toBe(true);
    });

    it('should parse command with integer option', () => {
      const result = parseCommandInteraction({
        name: 'test',
        options: [
          { name: 'count', type: 4, value: '42' },
        ],
      });

      expect(result.name).toBe('test');
      expect(result.options.count).toBe(42);
    });

    it('should parse command with multiple options', () => {
      const result = parseCommandInteraction({
        name: 'test',
        options: [
          { name: 'verbose', type: 5, value: 'true' },
          { name: 'count', type: 4, value: '10' },
          { name: 'name', type: 3, value: 'test' },
        ],
      });

      expect(result.name).toBe('test');
      expect(result.options.verbose).toBe(true);
      expect(result.options.count).toBe(10);
      expect(result.options.name).toBe('test');
    });

    it('should handle empty options array', () => {
      const result = parseCommandInteraction({
        name: 'oc-help',
        options: [],
      });

      expect(result.name).toBe('oc-help');
      expect(result.options).toEqual({});
    });

    it('should parse command with number option', () => {
      const result = parseCommandInteraction({
        name: 'test',
        options: [
          { name: 'amount', type: 10, value: '3.14' },
        ],
      });

      expect(result.name).toBe('test');
      expect(result.options.amount).toBe(3.14);
    });
  });
});
