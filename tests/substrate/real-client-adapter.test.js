import { describe, it, expect } from 'vitest';
import { adaptClientForLog } from '../../src/substrate/real-client-adapter.js';
import { MatrixLog } from '../../src/substrate/matrix-log.js';
import { entryToEventContent, EO_ENTRY_EVENT_TYPE } from '../../src/substrate/event-mapping.js';

// A hand-rolled stand-in for matrix-js-sdk's getter-based MatrixEvent, since
// installing the real SDK just to construct one event object would drag in
// a full client/store just for this shape.
function makeFakeMatrixEvent({ id, sender, ts, type, content }) {
  return {
    getId: () => id,
    getSender: () => sender,
    getTs: () => ts,
    getType: () => type,
    getContent: () => content,
  };
}

function makeFakeRealClient(initialEvents = []) {
  const events = [...initialEvents];
  let nextId = events.length;
  return {
    events,
    async sendEvent(roomId, type, content) {
      const event_id = `$evt${nextId++}`;
      events.push(makeFakeMatrixEvent({ id: event_id, sender: '@bot:example.org', ts: Date.now(), type, content }));
      return { event_id };
    },
    getRoom(roomId) {
      if (roomId !== 'room:test') return null;
      return {
        getLiveTimeline: () => ({ getEvents: () => events }),
      };
    },
  };
}

describe('adaptClientForLog', () => {
  it('requires a client with sendEvent and getRoom', () => {
    expect(() => adaptClientForLog({})).toThrow(TypeError);
  });

  it('maps a getter-based MatrixEvent to the plain fields matrix-log.js expects', () => {
    const realClient = makeFakeRealClient([
      makeFakeMatrixEvent({
        id: '$abc',
        sender: '@alice:example.org',
        ts: 1720000000000,
        type: EO_ENTRY_EVENT_TYPE,
        content: { op: 'INS' },
      }),
    ]);
    const adapted = adaptClientForLog(realClient);
    const events = adapted.getRoom('room:test').getLiveTimeline().getEvents();
    expect(events).toEqual([
      {
        event_id: '$abc',
        sender: '@alice:example.org',
        origin_server_ts: 1720000000000,
        type: EO_ENTRY_EVENT_TYPE,
        content: { op: 'INS' },
      },
    ]);
  });

  it('returns null for a room the client does not know about', () => {
    const adapted = adaptClientForLog(makeFakeRealClient());
    expect(adapted.getRoom('room:unknown')).toBeNull();
  });

  it('passes sendEvent straight through', async () => {
    const realClient = makeFakeRealClient();
    const adapted = adaptClientForLog(realClient);
    const result = await adapted.sendEvent('room:test', EO_ENTRY_EVENT_TYPE, { op: 'INS' });
    expect(result).toEqual({ event_id: '$evt0' });
  });

  // The point of this adapter: MatrixLog, written against the plain-field
  // duck type, works unmodified over a real-shaped (getter-based) client
  // once it's wrapped.
  it('drives a full MatrixLog append/stream/slice/checkpoint cycle through the adapter', async () => {
    const realClient = makeFakeRealClient();
    const log = new MatrixLog({ client: adaptClientForLog(realClient), roomId: 'room:test' });

    const entry = {
      op: 'INS',
      address: { mode: 2, domain: 0, object: 1 },
      target: 'record:1',
      operand: null,
      given: { mode_of_givenness: 'direct-entry', context: 'test' },
      // A real MatrixClient#sendEvent has no "sender" parameter — the
      // sender is always whoever the client is authenticated as. Passing
      // entry.agent here is a no-op; eventContentToEntry reads the real
      // event.sender instead (see below), which is the point of the test.
      agent: '@alice:example.org',
      grounding: [],
    };
    const { id } = await log.append(entry);
    expect(id).toBe('$evt0');

    const sliced = await log.slice(() => true);
    expect(sliced).toHaveLength(1);
    expect(sliced[0].entry.target).toBe('record:1');
    expect(sliced[0].entry.agent).toBe('@bot:example.org');

    const streamed = [];
    for await (const item of log.stream()) streamed.push(item);
    expect(streamed).toHaveLength(1);

    const checkpoint = await log.checkpoint({ nodes: [] });
    expect(checkpoint.dagHead).toBe('$evt0');
    expect(checkpoint.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('round-trips entryToEventContent through the adapter unchanged', async () => {
    const realClient = makeFakeRealClient();
    const adapted = adaptClientForLog(realClient);
    const content = entryToEventContent({
      op: 'DEF',
      address: { mode: 0, domain: 2, object: 1 },
      target: 'x',
      operand: null,
      given: { mode_of_givenness: 'm', context: 'c' },
      grounding: ['event:src'],
    });
    await adapted.sendEvent('room:test', EO_ENTRY_EVENT_TYPE, content);
    const [event] = adapted.getRoom('room:test').getLiveTimeline().getEvents();
    expect(event.content).toEqual(content);
  });
});
