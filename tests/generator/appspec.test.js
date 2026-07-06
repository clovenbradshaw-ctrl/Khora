import { describe, it, expect } from 'vitest';
import { validateAppSpec, RULES_REV } from '../../src/generator/appspec.js';
import { makeValidAppSpec } from './fixtures.js';

describe('validateAppSpec', () => {
  it('accepts a well-formed hardcoded AppSpec', () => {
    const result = validateAppSpec(makeValidAppSpec());
    expect(result).toEqual({ valid: true, errors: [], residue: [] });
  });

  it('rejects a stale or missing rules_rev', () => {
    const spec = { ...makeValidAppSpec(), rules_rev: '2020-01-01.a' };
    const result = validateAppSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.residue.some((r) => r.path === 'rules_rev')).toBe(true);
  });

  it('rejects an unknown surface type (including the deferred Document reader)', () => {
    const spec = makeValidAppSpec();
    spec.surfaces.push({ type: 'DocumentReader', room: 'room:whatever' });
    const result = validateAppSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.residue.some((r) => r.reason.includes('DocumentReader'))).toBe(true);
  });

  it('rejects a desert cell', () => {
    const spec = makeValidAppSpec();
    spec.cells.push({ address: { mode: 2, domain: 1, object: 0 } }); // SYN x Ground
    const result = validateAppSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('desert'))).toBe(true);
  });

  it('rejects a desert binding', () => {
    const spec = makeValidAppSpec();
    spec.bindings.push({
      on: 'board:mergeIntoGround',
      emit: { op: 'SYN', address: { mode: 2, domain: 1, object: 0 }, target: 'x' },
      provenance: { mode_of_givenness: 'inferred', context: 'test' },
    });
    const result = validateAppSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('desert'))).toBe(true);
  });

  it('rejects a binding missing its provenance template', () => {
    const spec = makeValidAppSpec();
    delete spec.bindings[0].provenance;
    const result = validateAppSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.residue.some((r) => r.path === 'bindings[0].provenance')).toBe(true);
  });

  it('rejects a non-object spec without throwing', () => {
    expect(validateAppSpec(null).valid).toBe(false);
    expect(validateAppSpec(undefined).valid).toBe(false);
  });

  it('reports every failure at once rather than stopping at the first', () => {
    const result = validateAppSpec({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('exposes the pinned RULES_REV', () => {
    expect(RULES_REV).toBe('2026-07-05.a');
  });
});
