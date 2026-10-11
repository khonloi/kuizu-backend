import { describe, it, expect } from 'vitest';
import { escapeRegex } from './regex.util';

describe('escapeRegex', () => {
  it('should escape special regex characters', () => {
    const input = 'hello.*+?^${}()|[]\\world';
    const escaped = escapeRegex(input);
    expect(escaped).toBe(
      'hello\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\world',
    );
  });

  it('should return empty string for empty input', () => {
    expect(escapeRegex('')).toBe('');
  });

  it('should leave normal alphanumeric text unchanged', () => {
    expect(escapeRegex('JavaScript 101')).toBe('JavaScript 101');
  });
});
