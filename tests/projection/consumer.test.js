import { describe, it, expect } from 'vitest';
import { InMemoryLog } from '../../src/kernel/log.js';
import { createProjectionConsumer } from '../../src/projection/consumer.js';

function groundedEntry(target, grounding = ['event:source-1']) {
  return { op: 'INS', target, grounding };
}

describe('createProjectionConsumer', () => {
  it('requires a log adapter with stream()', () => {
    expect(() => createProjectionConsumer({ log: {} })).toThrow(TypeError);
  });

  it('materializes only publishable entries', async () => {
    const log = new InMemoryLog();
    await log.append(groundedEntry('a'));
    await log.append({ op: 'INS', target: 'b' }); // no grounding
    await log.append(groundedEntry('c'));

    const consumer = createProjectionConsumer({ log });
    const result = await consumer.tail();
    expect(result).toEqual({ seen: 3, published: 2, lastSeenId: 2 });

    expect(await consumer.read('a')).toMatchObject({ target: 'a' });
    expect(await consumer.read('b')).toBeNull();
    const all = await consumer.readAll();
    expect(all.map((e) => e.target).sort()).toEqual(['a', 'c']);
  });

  it('applies policy rules at tail time', async () => {
    const log = new InMemoryLog();
    await log.append(groundedEntry('spam:1'));
    await log.append(groundedEntry('good:1'));

    const consumer = createProjectionConsumer({ log, policyRules: [{ pattern: 'spam:*' }] });
    await consumer.tail();

    expect(await consumer.read('spam:1')).toBeNull();
    expect(await consumer.read('good:1')).toMatchObject({ target: 'good:1' });
  });

  it('a later entry for the same target overwrites the materialized view', async () => {
    const log = new InMemoryLog();
    await log.append(groundedEntry('a'));
    const consumer = createProjectionConsumer({ log });
    await consumer.tail();
    await log.append({ op: 'DEF', target: 'a', grounding: ['event:source-2'] });
    await consumer.tail(1);

    const materialized = await consumer.read('a');
    expect(materialized.op).toBe('DEF');
  });

  it('snapshot stamps the DAG head and a stable hash', async () => {
    const log = new InMemoryLog();
    await log.append(groundedEntry('a'));
    const consumer = createProjectionConsumer({ log });
    await consumer.tail();

    const snap = await consumer.snapshot();
    expect(snap.dagHead).toBe(0);
    expect(snap.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(snap.entries).toHaveLength(1);
    expect(typeof snap.projectionTime).toBe('string');
  });

  it('publish hands the snapshot payload to an injected publisher', async () => {
    const log = new InMemoryLog();
    await log.append(groundedEntry('a'));
    const consumer = createProjectionConsumer({ log });
    await consumer.tail();

    let received = null;
    const result = await consumer.publish((payload) => {
      received = payload;
    });
    expect(received).toEqual(result);
    expect(received.entries).toHaveLength(1);
  });
});
