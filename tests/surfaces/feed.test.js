import { describe, it, expect } from 'vitest';
import { InMemoryLog } from '../../src/kernel/log.js';
import { makeAddress } from '../../src/kernel/address.js';
import { OPERATORS } from '../../src/kernel/operators.js';
import { createFeedSurface } from '../../src/surfaces/feed.js';

const provenance = { agent: 'user:carol', mode_of_givenness: 'direct-report', context: 'public-feed' };
const desertAddress = makeAddress(OPERATORS.SYN.mode, OPERATORS.SYN.domain, 0);

describe('feed surface', () => {
  it('reports the Entity/Field home terrain', () => {
    const surface = createFeedSurface({ log: new InMemoryLog() });
    expect(surface.homeTerrain).toBe('Entity/Field');
  });

  it('read returns the timeline previously appended to the log', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'post-1', operand: { text: 'hello' } });
    const surface = createFeedSurface({ log });

    const timeline = await surface.read();

    expect(timeline).toHaveLength(1);
    expect(timeline[0].target).toBe('post-1');
  });

  it('post appends a correctly-shaped INS entry on valid input', async () => {
    const log = new InMemoryLog();
    const surface = createFeedSurface({ log });
    const payload = { address: makeAddress(2, 0, 1), target: 'post-1', operand: { text: 'hello world' } };

    const result = await surface.bindings.post(payload, provenance);

    expect(result.appended).toBe(true);
    const [stored] = await log.slice(() => true);
    expect(stored.entry.op).toBe('INS');
    expect(stored.entry.operand).toEqual({ text: 'hello world' });
  });

  it('reply appends a correctly-shaped CON entry on valid input', async () => {
    const log = new InMemoryLog();
    const surface = createFeedSurface({ log });
    const payload = { address: makeAddress(1, 1, 1), target: 'post-1--reply-1', operand: { text: 'a reply' } };

    const result = await surface.bindings.reply(payload, provenance);

    expect(result.appended).toBe(true);
    const [stored] = await log.slice(() => true);
    expect(stored.entry.op).toBe('CON');
  });

  it('rejects and does not append on a desert address', async () => {
    const log = new InMemoryLog();
    const surface = createFeedSurface({ log });
    const payload = { address: desertAddress, target: 'post-1', operand: {} };

    const result = await surface.bindings.post(payload, provenance);

    expect(result.appended).toBe(false);
    expect(await log.slice(() => true)).toHaveLength(0);
  });

  it('rejects and does not append on missing provenance', async () => {
    const log = new InMemoryLog();
    const surface = createFeedSurface({ log });
    const payload = { address: makeAddress(2, 0, 1), target: 'post-1', operand: {} };

    const result = await surface.bindings.post(payload, undefined);

    expect(result.appended).toBe(false);
    expect(await log.slice(() => true)).toHaveLength(0);
  });

  it('fallback returns the cached timeline plus any pending drafts', async () => {
    const log = new InMemoryLog();
    const surface = createFeedSurface({ log });
    await surface.bindings.post({ address: makeAddress(2, 0, 1), target: 'post-1', operand: {} }, provenance);
    await surface.bindings.post({ address: desertAddress, target: 'post-2', operand: {} }, provenance);

    const fallback = surface.fallback();

    expect(fallback.timeline).toHaveLength(1);
    expect(fallback.pendingDrafts).toHaveLength(1);
    expect(fallback.pendingDrafts[0].target).toBe('post-2');
  });
});
