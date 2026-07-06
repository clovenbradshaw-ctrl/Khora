import { describe, it, expect } from 'vitest';
import { InMemoryLog } from '../../src/kernel/log.js';
import { makeAddress } from '../../src/kernel/address.js';
import { OPERATORS } from '../../src/kernel/operators.js';
import { createFormSurface } from '../../src/surfaces/form.js';

const provenance = { agent: 'user:dana', mode_of_givenness: 'direct-report', context: 'tip-submission' };
const desertAddress = makeAddress(OPERATORS.SYN.mode, OPERATORS.SYN.domain, 0);

describe('form surface', () => {
  it('throws at creation if the configured operator is not INS or DEF', () => {
    expect(() =>
      createFormSurface({ log: new InMemoryLog(), operator: 'REC', homeTerrain: 'Entity' }),
    ).toThrow();
  });

  it('throws at creation if homeTerrain is not supplied', () => {
    expect(() => createFormSurface({ log: new InMemoryLog(), operator: 'INS' })).toThrow();
  });

  it('reports the configured homeTerrain', () => {
    const surface = createFormSurface({ log: new InMemoryLog(), operator: 'INS', homeTerrain: 'Entity' });
    expect(surface.homeTerrain).toBe('Entity');
  });

  it('read returns submissions previously appended to the log', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'tip-1', operand: { text: 'a tip' } });
    const surface = createFormSurface({ log, operator: 'INS', homeTerrain: 'Entity' });

    const submissions = await surface.read();

    expect(submissions).toHaveLength(1);
    expect(submissions[0].target).toBe('tip-1');
  });

  it('submit uses the operator configured at spec-creation time (INS)', async () => {
    const log = new InMemoryLog();
    const surface = createFormSurface({ log, operator: 'INS', homeTerrain: 'Entity' });
    const payload = { address: makeAddress(2, 0, 0), target: 'tip-1', operand: { text: 'hello' } };

    const result = await surface.bindings.submit(payload, provenance);

    expect(result.appended).toBe(true);
    const [stored] = await log.slice(() => true);
    expect(stored.entry.op).toBe('INS');
  });

  it('submit uses the operator configured at spec-creation time (DEF)', async () => {
    const log = new InMemoryLog();
    const surface = createFormSurface({ log, operator: 'DEF', homeTerrain: 'Entity' });
    const payload = { address: makeAddress(0, 2, 0), target: 'correction-1', operand: { text: 'revised' } };

    const result = await surface.bindings.submit(payload, provenance);

    expect(result.appended).toBe(true);
    const [stored] = await log.slice(() => true);
    expect(stored.entry.op).toBe('DEF');
  });

  it('rejects and does not append on a desert address', async () => {
    const log = new InMemoryLog();
    const surface = createFormSurface({ log, operator: 'INS', homeTerrain: 'Entity' });
    const payload = { address: desertAddress, target: 'tip-1', operand: {} };

    const result = await surface.bindings.submit(payload, provenance);

    expect(result.appended).toBe(false);
    expect(await log.slice(() => true)).toHaveLength(0);
  });

  it('rejects and does not append on missing provenance', async () => {
    const log = new InMemoryLog();
    const surface = createFormSurface({ log, operator: 'INS', homeTerrain: 'Entity' });
    const payload = { address: makeAddress(2, 0, 0), target: 'tip-1', operand: {} };

    const result = await surface.bindings.submit(payload, undefined);

    expect(result.appended).toBe(false);
    expect(await log.slice(() => true)).toHaveLength(0);
  });

  it('fallback holds a failed submit as a pending draft', async () => {
    const log = new InMemoryLog();
    const surface = createFormSurface({ log, operator: 'INS', homeTerrain: 'Entity' });
    await surface.bindings.submit({ address: desertAddress, target: 'tip-1', operand: { text: 'x' } }, provenance);

    const fallback = surface.fallback();

    expect(fallback.pendingDrafts).toHaveLength(1);
    expect(fallback.pendingDrafts[0].target).toBe('tip-1');
  });
});
