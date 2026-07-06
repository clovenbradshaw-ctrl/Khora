import { describe, it, expect } from 'vitest';
import { InMemoryLog } from '../../src/kernel/log.js';
import { createChartSurface } from '../../src/surfaces/chart.js';

describe('chart surface', () => {
  it('reports the Kind home terrain', () => {
    const surface = createChartSurface({ log: new InMemoryLog() });
    expect(surface.homeTerrain).toBe('Kind');
  });

  it('exposes no write bindings at all', () => {
    const surface = createChartSurface({ log: new InMemoryLog() });
    expect(Object.keys(surface.bindings)).toHaveLength(0);
    expect(Object.isFrozen(surface.bindings)).toBe(true);
  });

  it('read returns an aggregation over the log', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'demographic-a' });
    await log.append({ op: 'INS', target: 'demographic-a' });
    await log.append({ op: 'INS', target: 'demographic-b' });
    const surface = createChartSurface({ log });

    const snapshot = await surface.read();

    const a = snapshot.find((bucket) => bucket.key === 'demographic-a');
    const b = snapshot.find((bucket) => bucket.key === 'demographic-b');
    expect(a.count).toBe(2);
    expect(b.count).toBe(1);
  });

  it('fallback returns a cached snapshot with a staleness note after a prior read', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'demographic-a' });
    const surface = createChartSurface({ log });
    await surface.read();

    const fallback = surface.fallback();

    expect(fallback.snapshot.length).toBeGreaterThan(0);
    expect(fallback.stale).toBe(true);
    expect(typeof fallback.note).toBe('string');
    expect(fallback.note.length).toBeGreaterThan(0);
  });

  it('fallback before any read reports no cached data rather than throwing', () => {
    const surface = createChartSurface({ log: new InMemoryLog() });

    const fallback = surface.fallback();

    expect(fallback.snapshot).toEqual([]);
    expect(fallback.asOf).toBeNull();
  });
});
