import { describe, it, expect } from 'vitest';
import { assertLogAdapter, InMemoryLog } from '../../src/kernel/log.js';

describe('assertLogAdapter', () => {
  it('accepts an object implementing all four methods', () => {
    const adapter = { append() {}, stream() {}, slice() {}, checkpoint() {} };
    expect(assertLogAdapter(adapter)).toBe(adapter);
  });

  it('throws naming the missing method', () => {
    expect(() => assertLogAdapter({ append() {}, stream() {}, slice() {} })).toThrow(/checkpoint/);
  });
});

describe('InMemoryLog', () => {
  it('satisfies the log adapter interface', () => {
    expect(() => assertLogAdapter(new InMemoryLog())).not.toThrow();
  });

  it('appends and streams entries in order', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'a' });
    await log.append({ op: 'DEF', target: 'b' });

    const streamed = [];
    for await (const item of log.stream()) {
      streamed.push(item.entry);
    }
    expect(streamed).toEqual([
      { op: 'INS', target: 'a' },
      { op: 'DEF', target: 'b' },
    ]);
  });

  it('streams only entries after a given token', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'a' });
    await log.append({ op: 'DEF', target: 'b' });

    const streamed = [];
    for await (const item of log.stream(1)) {
      streamed.push(item.entry);
    }
    expect(streamed).toEqual([{ op: 'DEF', target: 'b' }]);
  });

  it('slice filters entries', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'a' });
    await log.append({ op: 'DEF', target: 'b' });

    const defs = await log.slice((entry) => entry.op === 'DEF');
    expect(defs).toHaveLength(1);
    expect(defs[0].entry.target).toBe('b');
  });

  it('checkpoint stamps the current entry count', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'a' });
    const checkpoint = await log.checkpoint({ nodes: [] });
    expect(checkpoint.checkpointedAt).toBe(1);
  });
});
