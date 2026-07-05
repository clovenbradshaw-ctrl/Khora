// Calendar: time-addressed entities (Part 4, Tier 2). Home terrain Entity
// borrowing Field. A new event is INS, a reschedule is DEF — a revision of
// when the event holds, not a change to what kind of thing it is.

import { makeAddress } from '../../kernel/address.js';
import { OPERATORS } from '../../kernel/operators.js';
import { gatedWrite, OBJECT_FIGURE } from './shared.js';

const FLAG = 'calendar';

export function createCalendarSurface({ log }) {
  let lastRead = { events: [] };

  async function read(query = {}) {
    const calendarId = query.calendarId;
    const entries = await log.slice((entry) => !calendarId || entry.operand?.calendarId === calendarId);
    lastRead = { events: entries.map(({ entry }) => entry) };
    return lastRead;
  }

  const bindings = {
    // INS: a new event enters the calendar.
    newEvent: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'INS',
        address: makeAddress(OPERATORS.INS.mode, OPERATORS.INS.domain, OBJECT_FIGURE),
        target: payload?.eventId,
        operand: { calendarId: payload?.calendarId, title: payload?.title, startsAt: payload?.startsAt },
        provenance,
      }),

    // DEF: a reschedule revises when the event holds, same event.
    reschedule: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'DEF',
        address: makeAddress(OPERATORS.DEF.mode, OPERATORS.DEF.domain, OBJECT_FIGURE),
        target: payload?.eventId,
        operand: { startsAt: payload?.startsAt },
        provenance,
      }),
  };

  function fallback() {
    return { ...lastRead, stale: true };
  }

  return { homeTerrain: 'Entity borrowing Field', read, bindings, fallback };
}
