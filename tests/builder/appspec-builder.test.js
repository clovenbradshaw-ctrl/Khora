import { describe, it, expect } from 'vitest';
import {
  createBuilderState,
  setSite,
  addSurface,
  removeSurface,
  addBinding,
  removeBinding,
  toAppSpec,
  validateBuilderState,
  surfaceFieldRequirements,
  RULES_REV,
} from '../../src/builder/appspec-builder.js';

function withProcurementApp() {
  let state = createBuilderState();
  state = setSite(state, {
    space_or_room: 'space:procurement',
    visibility: 'private',
    power_template: 'contributor-write',
  });
  state = addSurface(state, { type: 'Table', class: 'ProcurementRecord', room: 'room:procurement-records' });
  state = addBinding(state, {
    on: 'table:addRow',
    op: 'INS',
    address: { mode: 2, domain: 0, object: 1 },
    target: (payload) => `record:${payload.id}`,
    mode_of_givenness: 'direct-entry',
    context: 'procurement-table',
  });
  return state;
}

describe('appspec-builder', () => {
  it('starts empty and invalid', () => {
    const state = createBuilderState();
    const { valid, errors } = validateBuilderState(state);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('stamps rules_rev and assembles a valid AppSpec end to end', () => {
    const state = withProcurementApp();
    const { valid, errors, spec } = validateBuilderState(state);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
    expect(spec.rules_rev).toBe(RULES_REV);
    expect(spec.surfaces).toHaveLength(1);
    expect(spec.bindings).toHaveLength(1);
  });

  it('derives cells from binding addresses, deduplicated', () => {
    let state = withProcurementApp();
    state = addBinding(state, {
      on: 'table:editCell',
      op: 'DEF',
      address: { mode: 2, domain: 0, object: 1 },
      target: (payload) => `record:${payload.id}`,
      mode_of_givenness: 'direct-entry',
      context: 'procurement-table',
    });
    const spec = toAppSpec(state);
    expect(spec.cells).toEqual([{ address: { mode: 2, domain: 0, object: 1 } }]);
  });

  it('surfaces a desert-cell binding as residue instead of silently repairing it', () => {
    let state = withProcurementApp();
    state = addBinding(state, {
      on: 'table:synthesize',
      op: 'SYN',
      address: { mode: 2, domain: 1, object: 0 },
      target: 'x',
      mode_of_givenness: 'direct-entry',
      context: 'procurement-table',
    });
    const { valid, residue } = validateBuilderState(state);
    expect(valid).toBe(false);
    expect(residue.some((r) => r.path === 'bindings[1].emit.address')).toBe(true);
  });

  it('removes surfaces and bindings by index', () => {
    const state = withProcurementApp();
    const noSurfaces = removeSurface(state, 0);
    expect(noSurfaces.surfaces).toHaveLength(0);
    const noBindings = removeBinding(state, 0);
    expect(noBindings.bindings).toHaveLength(0);
  });

  it('reports which extra fields each surface type needs', () => {
    expect(surfaceFieldRequirements('Form')).toEqual(['class', 'operator', 'homeTerrain']);
    expect(surfaceFieldRequirements('Table')).toEqual(['class']);
    expect(surfaceFieldRequirements('Nope')).toEqual([]);
  });
});
