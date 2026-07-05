import { describe, it, expect } from 'vitest';
import { MatrixLog } from '../../src/substrate/matrix-log.js';
import { EO_ENTRY_EVENT_TYPE } from '../../src/substrate/event-mapping.js';
import { assertLogAdapter } from '../../src/kernel/log.js';

// A hand-written fake standing in for matrix-js-sdk's MatrixClient, per
// the duck-typed surface documented at the top of matrix-log.js: it
// records sent events per room and replays them back through
// getRoom(...).getLiveTimeline().getEvents().
function makeFakeClient(sender = '@_site_bot:example.org') {
  const timelines = new Map();
  let nextId = 0;
  return {
    sentEvents: [],
    async sendEvent(roomId, type, content) {
      const event_id = `$evt${nextId++}`;
      const event = { event_id, sender, origin_server_ts: 1000 + nextId, type, content };
      if (!timelines.has(roomId)) timelines.set(roomId, []);
      timelines.get(roomId).push(event);
      this.sentEvents.push(event);
      return { event_id };
    },
    getRoom(roomId) {
      const events = timelines.get(roomId);
      if (!events) return null;
      return { getLiveTimeline: () => ({ getEvents: () => events }) };
    },
  };
}

const ROOM_ID = '!room:example.org';

const entryA = {
  op: 'INS',
  address: { mode: 2, domain: 0, object: 0 },
  target: 'row:1',
  operand: { name: 'first' },
  given: { mode_of_givenness: 'direct-entry', context: 'table-form' },
  grounding: [],
};

const entryB = {
  op: 'DEF',
  address: { mode: 0, domain: 2, object: 1 },
  target: 'row:1',
  operand: { name: 'corrected' },
  given: { mode_of_givenness: 'direct-entry', context: 'table-form' },
  grounding: ['$evt0'],
};

describe('MatrixLog', () => {
  it('satisfies the kernel log adapter interface', () => {
    const log = new MatrixLog({ client: makeFakeClient(), roomId: ROOM_ID });
    expect(() => assertLogAdapter(log)).not.toThrow();
  });

  it('requires a client with sendEvent/getRoom and a roomId', () => {
    expect(() => new MatrixLog({ client: {}, roomId: ROOM_ID })).toThrow();
    expect(() => new MatrixLog({ client: makeFakeClient(), roomId: '' })).toThrow();
  });

  it('append sends a namespaced event and returns its event id', async () => {
    const client = makeFakeClient();
    const log = new MatrixLog({ client, roomId: ROOM_ID });
    const { id } = await log.append(entryA);

    expect(id).toBe('$evt0');
    expect(client.sentEvents).toHaveLength(1);
    expect(client.sentEvents[0].type).toBe(EO_ENTRY_EVENT_TYPE);
    expect(client.sentEvents[0].content.op).toBe('INS');
  });

  it('stream yields appended entries in DAG order, with agent/timestamp attached', async () => {
    const client = makeFakeClient('@_site_bot:example.org');
    const log = new MatrixLog({ client, roomId: ROOM_ID });
    await log.append(entryA);
    await log.append(entryB);

    const seen = [];
    for await (const item of log.stream()) {
      seen.push(item);
    }
    expect(seen).toHaveLength(2);
    expect(seen[0].entry.op).toBe('INS');
    expect(seen[0].entry.agent).toBe('@_site_bot:example.org');
    expect(seen[1].entry.op).toBe('DEF');
  });

  it('stream only yields entries after a given event-id token', async () => {
    const client = makeFakeClient();
    const log = new MatrixLog({ client, roomId: ROOM_ID });
    await log.append(entryA);
    const { id: secondId } = await log.append(entryB);

    const seen = [];
    for await (const item of log.stream('$evt0')) {
      seen.push(item);
    }
    expect(seen).toHaveLength(1);
    expect(seen[0].id).toBe(secondId);
  });

  it('slice filters by predicate over decoded entries', async () => {
    const client = makeFakeClient();
    const log = new MatrixLog({ client, roomId: ROOM_ID });
    await log.append(entryA);
    await log.append(entryB);

    const defs = await log.slice((entry) => entry.op === 'DEF');
    expect(defs).toHaveLength(1);
    expect(defs[0].entry.target).toBe('row:1');
    expect(defs[0].entry.operand).toEqual({ name: 'corrected' });
  });

  it('checkpoint stamps a canonical hash of the graph and the DAG head event id', async () => {
    const client = makeFakeClient();
    const log = new MatrixLog({ client, roomId: ROOM_ID });
    await log.append(entryA);
    const { id: lastId } = await log.append(entryB);

    const checkpoint = await log.checkpoint({ nodes: ['row:1'] });
    expect(checkpoint.dagHead).toBe(lastId);
    expect(checkpoint.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(checkpoint.nodes).toEqual(['row:1']);
  });

  it('checkpoint on a room with no entries yet has a null DAG head', async () => {
    const client = makeFakeClient();
    const log = new MatrixLog({ client, roomId: '!empty:example.org' });
    const checkpoint = await log.checkpoint({ nodes: [] });
    expect(checkpoint.dagHead).toBeNull();
  });
});
