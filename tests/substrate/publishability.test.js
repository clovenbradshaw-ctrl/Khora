import { describe, it, expect } from 'vitest';
import { isPublishable } from '../../src/substrate/publishability.js';

describe('isPublishable', () => {
  const grounded = { target: 'article:1', grounding: ['event:archived-source-1'] };

  it('requires a grounding annotation', () => {
    expect(isPublishable({ target: 'article:1', grounding: [] })).toBe(false);
    expect(isPublishable({ target: 'article:1' })).toBe(false);
    expect(isPublishable(grounded)).toBe(true);
  });

  it('refuses a redacted entry regardless of grounding', () => {
    expect(isPublishable(grounded, { redacted: true })).toBe(false);
  });

  it('refuses an entry matching a policy glob rule', () => {
    const policyRules = [{ pattern: 'article:*' }];
    expect(isPublishable(grounded, { policyRules })).toBe(false);
  });

  it('allows an entry that matches no policy rule', () => {
    const policyRules = [{ pattern: 'spam:*' }];
    expect(isPublishable(grounded, { policyRules })).toBe(true);
  });

  it('is false for malformed input rather than throwing', () => {
    expect(isPublishable(null)).toBe(false);
    expect(isPublishable(undefined)).toBe(false);
  });
});
