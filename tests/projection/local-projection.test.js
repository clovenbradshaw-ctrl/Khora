import { describe, it, expect } from 'vitest';
import { InMemoryLog } from '../../src/kernel/log.js';
import { createInMemoryOPFSStore } from '../../src/projection/opfs-store.js';
import { createLocalProjection } from '../../src/projection/local-projection.js';

describe('createLocalProjection', () => {
  it('requires a log adapter and a valid store', () => {
    expect(() => createLocalProjection({ log: {}, store: createInMemoryOPFSStore() })).toThrow(TypeError);
    expect(() => createLocalProjection({ log: new InMemoryLog(), store: {} })).toThrow(TypeError);
  });

  it('materializes every entry unfiltered, unlike the CDN projection', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'a' }); // no grounding — the CDN consumer would drop this
    await log.append({ op: 'DEF', target: 'b', grounding: ['event:src'] });

    const local = createLocalProjection({ log, store: createInMemoryOPFSStore() });
    const result = await local.sync();
    expect(result.count).toBe(2);

    const all = await local.readAll();
    expect(all.map((e) => e.entry.target).sort()).toEqual(['a', 'b']);
  });

  it('reads a single entry by id after sync', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'a' });
    const local = createLocalProjection({ log, store: createInMemoryOPFSStore() });
    await local.sync();
    expect(await local.read(0)).toMatchObject({ target: 'a' });
    expect(await local.read('nope')).toBeNull();
  });

  it('folds a Meant-Graph stamped with a stable hash and the DAG head', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'a' });
    const local = createLocalProjection({ log, store: createInMemoryOPFSStore() });
    const { meantGraph } = await local.sync();

    expect(meantGraph.dagHead).toBe(0);
    expect(meantGraph.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(meantGraph.entries).toHaveLength(1);
    expect(typeof meantGraph.foldedAt).toBe('string');
    expect(await local.readMeantGraph()).toEqual(meantGraph);
  });

  it('an incremental sync only re-tails new entries but re-folds the whole store', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'a' });
    const local = createLocalProjection({ log, store: createInMemoryOPFSStore() });
    const first = await local.sync();
    expect(first.count).toBe(1);

    await log.append({ op: 'DEF', target: 'b' });
    const second = await local.sync(first.lastSeenId + 1);
    expect(second.count).toBe(1);
    expect(second.meantGraph.entries).toHaveLength(2);
  });

  it('gives instant local reads without re-tailing the log (offline capability)', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'a' });
    const store = createInMemoryOPFSStore();
    const local = createLocalProjection({ log, store });
    await local.sync();

    // Simulate being offline: a fresh projection over the same store, with
    // no log to tail, can still read everything sync() already wrote.
    const offlineLocal = createLocalProjection({ log: new InMemoryLog(), store });
    expect(await offlineLocal.readAll()).toHaveLength(1);
    expect((await offlineLocal.readMeantGraph()).entries).toHaveLength(1);
  });
});
