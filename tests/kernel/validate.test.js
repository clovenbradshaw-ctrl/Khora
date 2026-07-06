import { describe, it, expect } from 'vitest';
import { makeAddress } from '../../src/kernel/address.js';
import { isDesert, validateBinding, residue } from '../../src/kernel/validate.js';
import { OPERATORS } from '../../src/kernel/operators.js';

describe('isDesert', () => {
  // Golden test: a desert address is rejected. SYN by Ground is the one
  // cell the corpus never fills (Part 1, "The empirical ground").
  it('flags exactly SYN x Ground and nothing else', () => {
    const groundAddr = makeAddress(OPERATORS.SYN.mode, OPERATORS.SYN.domain, 0);
    expect(isDesert(groundAddr)).toBe(true);

    const figureAddr = makeAddress(OPERATORS.SYN.mode, OPERATORS.SYN.domain, 1);
    const patternAddr = makeAddress(OPERATORS.SYN.mode, OPERATORS.SYN.domain, 2);
    expect(isDesert(figureAddr)).toBe(false);
    expect(isDesert(patternAddr)).toBe(false);

    const nonSynGround = makeAddress(OPERATORS.DEF.mode, OPERATORS.DEF.domain, 0);
    expect(isDesert(nonSynGround)).toBe(false);
  });

  it('returns false for an illegal address rather than throwing', () => {
    expect(isDesert({ mode: 9, domain: 0, object: 0 })).toBe(false);
  });
});

describe('validateBinding', () => {
  const provenance = { agent: 'user:alice', mode_of_givenness: 'direct-report', context: 'intake-form' };

  it('accepts a well-formed, non-desert binding', () => {
    const result = validateBinding({
      emit: { op: 'INS', address: makeAddress(2, 0, 0) },
      provenance,
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects a desert binding', () => {
    const result = validateBinding({
      emit: { op: 'SYN', address: makeAddress(OPERATORS.SYN.mode, OPERATORS.SYN.domain, 0) },
      provenance,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('desert'))).toBe(true);
  });

  it('rejects an unknown operator code', () => {
    const result = validateBinding({
      emit: { op: 'SUP', address: makeAddress(0, 0, 0) },
      provenance,
    });
    expect(result.valid).toBe(false);
  });

  it('rejects a missing provenance envelope', () => {
    const result = validateBinding({ emit: { op: 'INS', address: makeAddress(2, 0, 0) } });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-object binding without throwing', () => {
    expect(validateBinding(null).valid).toBe(false);
    expect(validateBinding(undefined).valid).toBe(false);
  });
});

describe('residue', () => {
  // Golden test: empty for a fully addressed description, non-empty for one
  // with a remainder.
  it('returns empty when every segment is addressed', () => {
    const description = ['a fungus performs SEG', 'a fungus performs CON'];
    const addresses = [makeAddress(0, 1, 1), makeAddress(1, 1, 1)];
    expect(residue(description, addresses)).toEqual([]);
  });

  it('returns the unaddressed segments when one is missing', () => {
    const description = ['addressed clause', 'unaddressed clause'];
    const addresses = [makeAddress(0, 0, 0), null];
    const result = residue(description, addresses);
    expect(result).toHaveLength(1);
    expect(result[0].segment).toBe('unaddressed clause');
  });

  it('throws on mismatched array lengths', () => {
    expect(() => residue(['a', 'b'], [makeAddress(0, 0, 0)])).toThrow(TypeError);
  });
});
