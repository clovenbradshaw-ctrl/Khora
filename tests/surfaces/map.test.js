import { describe, it, expect } from 'vitest';
import { InMemoryLog } from '../../src/kernel/log.js';
import { makeAddress } from '../../src/kernel/address.js';
import { OPERATORS } from '../../src/kernel/operators.js';
import { createMapSurface } from '../../src/surfaces/map.js';

const provenance = { agent: 'user:bob', mode_of_givenness: 'field-observation', context: 'site-survey' };
const desertAddress = makeAddress(OPERATORS.SYN.mode, OPERATORS.SYN.domain, 0);

describe('map surface', () => {
  it('reports the Field/Entity home terrain', () => {
    const surface = createMapSurface({ log: new InMemoryLog() });
    expect(surface.homeTerrain).toBe('Field/Entity');
  });

  it('read returns features previously appended to the log', async () => {
    const log = new InMemoryLog();
    await log.append({ op: 'INS', target: 'marker-1', operand: { lat: 1, lng: 2 } });
    const surface = createMapSurface({ log });

    const features = await surface.read();

    expect(features).toHaveLength(1);
    expect(features[0].target).toBe('marker-1');
  });

  it('placeMarker appends a correctly-shaped INS entry on valid input', async () => {
    const log = new InMemoryLog();
    const surface = createMapSurface({ log });
    const payload = { address: makeAddress(2, 0, 1), target: 'marker-1', operand: { lat: 36.16, lng: -86.78 } };

    const result = await surface.bindings.placeMarker(payload, provenance);

    expect(result.appended).toBe(true);
    const [stored] = await log.slice(() => true);
    expect(stored.entry.op).toBe('INS');
    expect(stored.entry.operand).toEqual({ lat: 36.16, lng: -86.78 });
  });

  it('drawBoundary appends a correctly-shaped SEG entry on valid input', async () => {
    const log = new InMemoryLog();
    const surface = createMapSurface({ log });
    const payload = { address: makeAddress(0, 1, 1), target: 'boundary-1', operand: { ring: [[0, 0], [1, 1]] } };

    const result = await surface.bindings.drawBoundary(payload, provenance);

    expect(result.appended).toBe(true);
    const [stored] = await log.slice(() => true);
    expect(stored.entry.op).toBe('SEG');
  });

  it('connectPoints appends a correctly-shaped CON entry on valid input', async () => {
    const log = new InMemoryLog();
    const surface = createMapSurface({ log });
    const payload = { address: makeAddress(1, 1, 1), target: 'marker-1--marker-2', operand: null };

    const result = await surface.bindings.connectPoints(payload, provenance);

    expect(result.appended).toBe(true);
    const [stored] = await log.slice(() => true);
    expect(stored.entry.op).toBe('CON');
  });

  it('rejects and does not append on a desert address', async () => {
    const log = new InMemoryLog();
    const surface = createMapSurface({ log });
    const payload = { address: desertAddress, target: 'marker-1', operand: {} };

    const result = await surface.bindings.placeMarker(payload, provenance);

    expect(result.appended).toBe(false);
    expect(await log.slice(() => true)).toHaveLength(0);
  });

  it('rejects and does not append on missing provenance', async () => {
    const log = new InMemoryLog();
    const surface = createMapSurface({ log });
    const payload = { address: makeAddress(2, 0, 1), target: 'marker-1', operand: {} };

    const result = await surface.bindings.placeMarker(payload, undefined);

    expect(result.appended).toBe(false);
    expect(await log.slice(() => true)).toHaveLength(0);
  });

  it('fallback returns the last marker cache plus any pending drafts', async () => {
    const log = new InMemoryLog();
    const surface = createMapSurface({ log });
    await surface.bindings.placeMarker({ address: makeAddress(2, 0, 1), target: 'marker-1', operand: {} }, provenance);
    await surface.bindings.placeMarker({ address: desertAddress, target: 'marker-2', operand: {} }, provenance);

    const fallback = surface.fallback();

    expect(fallback.features).toHaveLength(1);
    expect(fallback.pendingDrafts).toHaveLength(1);
    expect(fallback.pendingDrafts[0].target).toBe('marker-2');
  });
});
