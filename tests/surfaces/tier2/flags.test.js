import { describe, it, expect, afterEach } from 'vitest';
import { isEnabled, setEnabled, FLAG_NAMES } from '../../../src/surfaces/tier2/flags.js';

describe('Tier 2 flags', () => {
  afterEach(() => {
    for (const name of FLAG_NAMES) setEnabled(name, false);
  });

  it('defaults every Tier 2 flag to false', () => {
    for (const name of FLAG_NAMES) {
      expect(isEnabled(name)).toBe(false);
    }
  });

  it('lets a flag be turned on and back off', () => {
    setEnabled('board', true);
    expect(isEnabled('board')).toBe(true);
    setEnabled('board', false);
    expect(isEnabled('board')).toBe(false);
  });

  it('throws for an unknown flag name on read or write', () => {
    expect(() => isEnabled('not-a-real-flag')).toThrow(RangeError);
    expect(() => setEnabled('not-a-real-flag', true)).toThrow(RangeError);
  });

  it('rejects a non-boolean value', () => {
    expect(() => setEnabled('board', 'yes')).toThrow(TypeError);
  });
});
