import { describe, it, expect } from 'vitest';
import { assertOPFSStore, createInMemoryOPFSStore, createOPFSStore } from '../../src/projection/opfs-store.js';

describe('assertOPFSStore', () => {
  it('throws naming the missing method', () => {
    expect(() => assertOPFSStore({ writeEntry() {}, readEntry() {} })).toThrow(/listEntries/);
  });
});

describe('createInMemoryOPFSStore', () => {
  it('satisfies the OPFS store interface', () => {
    expect(() => assertOPFSStore(createInMemoryOPFSStore())).not.toThrow();
  });

  it('round-trips entries by id', async () => {
    const store = createInMemoryOPFSStore();
    await store.writeEntry('a', { op: 'INS', target: 'x' });
    expect(await store.readEntry('a')).toEqual({ op: 'INS', target: 'x' });
    expect(await store.readEntry('missing')).toBeNull();
  });

  it('lists every written entry', async () => {
    const store = createInMemoryOPFSStore();
    await store.writeEntry('a', { op: 'INS' });
    await store.writeEntry('b', { op: 'DEF' });
    const listed = await store.listEntries();
    expect(listed.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('round-trips the folded Meant-Graph as a unit', async () => {
    const store = createInMemoryOPFSStore();
    expect(await store.readMeantGraph()).toBeNull();
    await store.writeMeantGraph({ nodes: [{ id: 1 }] });
    expect(await store.readMeantGraph()).toEqual({ nodes: [{ id: 1 }] });
  });
});

describe('createOPFSStore', () => {
  it('refuses to run outside a browser rather than silently no-op-ing', async () => {
    await expect(createOPFSStore()).rejects.toThrow(/Origin Private File System/);
  });
});
