import { describe, it, expect } from 'vitest';
import { generate } from '../../src/generator/generate.js';
import { InMemoryLog } from '../../src/kernel/log.js';
import { makeValidAppSpec } from './fixtures.js';

describe('generate', () => {
  it('refuses an invalid spec and returns its residue instead of silently repairing it', () => {
    const log = new InMemoryLog();
    const result = generate({ rules_rev: 'nope' }, { log });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.residue.length).toBeGreaterThan(0);
  });

  it('requires a log adapter', () => {
    expect(() => generate(makeValidAppSpec(), {})).toThrow(TypeError);
  });

  it('instantiates one surface entry per declared surface', () => {
    const log = new InMemoryLog();
    const result = generate(makeValidAppSpec(), { log });
    expect(result.ok).toBe(true);
    expect(result.surfaces).toHaveLength(2);
    expect(result.surfaces.map((s) => s.type)).toEqual(['Table', 'Form']);
  });

  it('a bound UI event appends a validated entry carrying full provenance', async () => {
    const log = new InMemoryLog();
    const result = generate(makeValidAppSpec(), { log, now: () => 'T0' });
    const outcome = await result.bindings['table:addRow']({ id: 'abc' }, 'user:alice');
    expect(outcome.ok).toBe(true);
    expect(outcome.entry).toMatchObject({
      op: 'INS',
      target: 'record:abc',
      agent: 'user:alice',
      timestamp: 'T0',
      given: { mode_of_givenness: 'direct-entry', context: 'procurement-table' },
    });

    const appended = await log.slice(() => true);
    expect(appended).toHaveLength(1);
    expect(appended[0].entry.target).toBe('record:abc');
  });

  it('refuses to append when the runtime binding has no acting agent', async () => {
    const log = new InMemoryLog();
    const result = generate(makeValidAppSpec(), { log });
    const outcome = await result.bindings['table:addRow']({ id: 'abc' }, undefined);
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.some((e) => e.includes('agent'))).toBe(true);

    const appended = await log.slice(() => true);
    expect(appended).toHaveLength(0);
  });

  it('each declared binding is independently callable and targets its own room-bound surface', async () => {
    const log = new InMemoryLog();
    const result = generate(makeValidAppSpec(), { log });
    await result.bindings['table:addRow']({ id: '1' }, 'user:alice');
    await result.bindings['form:submit']({ id: '2' }, 'user:bob');

    const appended = await log.slice(() => true);
    expect(appended).toHaveLength(2);
    expect(appended.map((e) => e.entry.target)).toEqual(['record:1', 'tip:2']);
  });
});
