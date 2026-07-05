import { describe, it, expect } from 'vitest';
import { canonicalize, canonicalHash } from '../../src/kernel/canonical.js';

describe('canonicalize', () => {
  // Golden test: two serializations of one entry canonicalize to the same
  // bytes, regardless of key order or nesting order.
  it('produces identical output for differently-ordered keys', () => {
    const a = { op: 'DEF', target: 'x', address: { mode: 0, domain: 2, object: 1 } };
    const b = { address: { object: 1, mode: 0, domain: 2 }, target: 'x', op: 'DEF' };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('produces identical output for arrays regardless of object key order within them', () => {
    const a = { grounding: [{ id: 1, type: 'a' }, { id: 2, type: 'b' }] };
    const b = { grounding: [{ type: 'a', id: 1 }, { type: 'b', id: 2 }] };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('is sensitive to actual content differences', () => {
    const a = { op: 'DEF' };
    const b = { op: 'REC' };
    expect(canonicalize(a)).not.toBe(canonicalize(b));
  });
});

describe('canonicalHash', () => {
  it('hashes two serializations of one entry to the same digest', async () => {
    const a = { op: 'DEF', target: 'x', given: { context: 'c', mode_of_givenness: 'm' } };
    const b = { given: { mode_of_givenness: 'm', context: 'c' }, target: 'x', op: 'DEF' };
    const [hashA, hashB] = await Promise.all([canonicalHash(a), canonicalHash(b)]);
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different content', async () => {
    const hashA = await canonicalHash({ op: 'DEF' });
    const hashB = await canonicalHash({ op: 'REC' });
    expect(hashA).not.toBe(hashB);
  });
});
