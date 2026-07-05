import { describe, it, expect } from 'vitest';
import { InMemoryLog } from '../../src/kernel/log.js';
import { makeAddress } from '../../src/kernel/address.js';
import { OPERATORS } from '../../src/kernel/operators.js';
import { createTableSurface } from '../../src/surfaces/table.js';

const provenance = { agent: 'user:alice', mode_of_givenness: 'direct-report', context: 'intake-form' };
const desertAddress = makeAddress(OPERATORS.SYN.mode, OPERATORS.SYN.domain, 0);

describe('table surface', () => {
  it('reports the Entity/Kind home terrain', () => {
    const surface = createTableSurface({ log: new InMemoryLog() });
    expect(surface.homeTerrain).toBe('Entity/Kind');
  });

  it('read returns rows previously appended to the log', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'row-1', operand: { name: 'a' } });
    const surface = createTableSurface({ log });
    const rows = await surface.read();
    expect(rows).toHaveLength(1);
    expect(rows[0].target).toBe('row-1');
    expect(rows[0].operand).toEqual({ name: 'a' });
  });

  it('addRow appends a correctly-shaped INS entry on valid input', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    const payload = { address: makeAddress(2, 0, 1), target: 'row-1', operand: { name: 'a' } };

    const result = await surface.bindings.addRow(payload, provenance);

    expect(result.appended).toBe(true);
    const stored = await log.slice(() => true);
    expect(stored).toHaveLength(1);
    expect(stored[0].entry.op).toBe('INS');
    expect(stored[0].entry.target).toBe('row-1');
    expect(stored[0].entry.operand).toEqual({ name: 'a' });
    expect(stored[0].entry.given).toEqual({ mode_of_givenness: 'direct-report', context: 'intake-form' });
  });

  it('editCell appends a correctly-shaped DEF entry on valid input', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    const payload = { address: makeAddress(0, 2, 1), target: 'row-1.col-a', operand: 'revised value' };

    const result = await surface.bindings.editCell(payload, provenance);

    expect(result.appended).toBe(true);
    const [stored] = await log.slice(() => true);
    expect(stored.entry.op).toBe('DEF');
    expect(stored.entry.operand).toBe('revised value');
  });

  it('changeSchema appends a correctly-shaped REC entry on valid input', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    const payload = { address: makeAddress(2, 2, 1), target: 'schema', operand: { columns: ['a', 'b'] } };

    const result = await surface.bindings.changeSchema(payload, provenance);

    expect(result.appended).toBe(true);
    const [stored] = await log.slice(() => true);
    expect(stored.entry.op).toBe('REC');
  });

  it('rejects and does not append on a desert address', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    const payload = { address: desertAddress, target: 'row-1', operand: {} };

    const result = await surface.bindings.addRow(payload, provenance);

    expect(result.appended).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(await log.slice(() => true)).toHaveLength(0);
  });

  it('rejects and does not append on missing provenance', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    const payload = { address: makeAddress(2, 0, 1), target: 'row-1', operand: {} };

    const result = await surface.bindings.addRow(payload, undefined);

    expect(result.appended).toBe(false);
    expect(await log.slice(() => true)).toHaveLength(0);
  });

  it('fallback returns cached rows as pending drafts after mixed writes', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    await surface.bindings.addRow({ address: makeAddress(2, 0, 1), target: 'row-1', operand: {} }, provenance);
    await surface.bindings.addRow({ address: desertAddress, target: 'row-2', operand: {} }, provenance);

    const fallback = surface.fallback();

    expect(fallback.rows).toHaveLength(1);
    expect(fallback.rows[0].target).toBe('row-1');
    expect(fallback.pendingDrafts).toHaveLength(1);
    expect(fallback.pendingDrafts[0].target).toBe('row-2');
  });
});
