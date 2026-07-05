// The Matrix-backed implementation of the kernel's log adapter interface
// (src/kernel/log.js#assertLogAdapter). A room's timeline IS the
// append-only, signed, hash-linked log (Part 3, Layer 1) — this class only
// does the correspondence between kernel entries and
// `social.hyphae.eo.entry` events, via event-mapping.js.
//
// Client surface this class depends on. It is duck-typed, not
// matrix-js-sdk — no such package is imported here — but it is shaped to
// match the real MatrixClient so a production build can inject the genuine
// client with no change to this file:
//
//   client.sendEvent(roomId, eventType, content) => Promise<{ event_id }>
//     Same call signature as MatrixClient#sendEvent. Appends a new event
//     to the room DAG.
//
//   client.getRoom(roomId) => Room | null
//     Same as MatrixClient#getRoom. The returned Room must expose
//     getLiveTimeline().getEvents(), an array of event objects shaped like
//     the raw Matrix event JSON: { event_id, sender, origin_server_ts,
//     type, content }. Real matrix-js-sdk MatrixEvent instances hide this
//     data behind getters (getId(), getSender(), getTs(), getType(),
//     getContent()) instead of plain fields; an integration layer between
//     the real SDK and this class is expected to map one to the other.
//     That mapping is deliberately not part of this module, which only
//     needs the plain shape to stay testable without the SDK installed.
//
// sinceToken (stream's argument, and the id returned by append/slice
// entries) is an event_id, not an integer offset — Matrix's own /sync uses
// opaque tokens rather than array indices, and an event_id is the token
// this adapter already has on hand from a prior append or stream.

import { entryToEventContent, eventContentToEntry, EO_ENTRY_EVENT_TYPE } from './event-mapping.js';
import { canonicalHash } from '../kernel/canonical.js';

export class MatrixLog {
  constructor({ client, roomId }) {
    if (!client || typeof client.sendEvent !== 'function' || typeof client.getRoom !== 'function') {
      throw new TypeError('MatrixLog requires a client with sendEvent and getRoom');
    }
    if (!roomId) {
      throw new TypeError('MatrixLog requires a roomId');
    }
    this._client = client;
    this._roomId = roomId;
  }

  async append(entry) {
    const content = entryToEventContent(entry);
    const { event_id } = await this._client.sendEvent(this._roomId, EO_ENTRY_EVENT_TYPE, content);
    return { id: event_id };
  }

  // Only entries in our own namespaced event type count as log entries —
  // a room's timeline also carries state events (name, power levels, ...)
  // that are not part of the Given-Log.
  _entryEvents() {
    const room = this._client.getRoom(this._roomId);
    if (!room) return [];
    return room.getLiveTimeline().getEvents().filter((event) => event.type === EO_ENTRY_EVENT_TYPE);
  }

  async *stream(sinceToken) {
    const events = this._entryEvents();
    let startIndex = 0;
    if (sinceToken != null) {
      const foundAt = events.findIndex((event) => event.event_id === sinceToken);
      startIndex = foundAt === -1 ? events.length : foundAt + 1;
    }
    for (let i = startIndex; i < events.length; i++) {
      yield { id: events[i].event_id, entry: eventContentToEntry(events[i]) };
    }
  }

  async slice(filter = () => true) {
    const results = [];
    for (const event of this._entryEvents()) {
      const entry = eventContentToEntry(event);
      if (filter(entry)) results.push({ id: event.event_id, entry });
    }
    return results;
  }

  // Stamped with a stable hash of the graph plus the DAG head it was built
  // from (Part 3, Layer 4: "stamped with the DAG head it was built from"),
  // so a projection consumer downstream can tell which prefix of the room
  // timeline a given checkpoint reflects.
  async checkpoint(meantGraph) {
    const events = this._entryEvents();
    const dagHead = events.length ? events[events.length - 1].event_id : null;
    const hash = await canonicalHash(meantGraph);
    return { ...meantGraph, dagHead, hash };
  }
}
