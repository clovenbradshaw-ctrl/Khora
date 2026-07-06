import { describe, it, expect } from 'vitest';
import { InMemoryLog } from '../../src/kernel/log.js';
import { generate } from '../../src/generator/generate.js';
import { instantiateSurfaces, isInstantiable } from '../../src/builder/instantiate.js';
import { makeValidAppSpec } from '../generator/fixtures.js';

describe('isInstantiable', () => {
  it('knows the Tier 1 surfaces with a live factory', () => {
    expect(isInstantiable('Table')).toBe(true);
    expect(isInstantiable('Form')).toBe(true);
    expect(isInstantiable('Board')).toBe(false);
  });
});

function specWithFormFields() {
  const spec = makeValidAppSpec();
  const form = spec.surfaces.find((s) => s.type === 'Form');
  form.operator = 'INS';
  form.homeTerrain = 'Entity';
  return spec;
}

describe('instantiateSurfaces', () => {
  it('builds a real, working surface instance per Tier 1 surface in the spec', async () => {
    const log = new InMemoryLog();
    const result = generate(specWithFormFields(), { log });
    expect(result.ok).toBe(true);

    const instances = instantiateSurfaces(result, log);
    expect(instances.map((i) => i.type)).toEqual(['Table', 'Form']);

    const table = instances.find((i) => i.type === 'Table').instance;
    const write = await table.bindings.addRow(
      { address: { mode: 2, domain: 0, object: 1 }, target: 'record:1', operand: { note: 'x' } },
      { agent: 'alice', mode_of_givenness: 'direct-entry', context: 'procurement-table' },
    );
    expect(write.appended).toBe(true);
    expect(await table.read()).toHaveLength(1);
  });

  it('skips surfaces with no Tier 1 factory instead of guessing', () => {
    const log = new InMemoryLog();
    const spec = specWithFormFields();
    spec.surfaces.push({ type: 'Board', class: 'Kanban', room: 'room:board' });
    const result = generate(spec, { log });
    const instances = instantiateSurfaces(result, log);
    expect(instances.map((i) => i.type)).toEqual(['Table', 'Form']);
  });
});
