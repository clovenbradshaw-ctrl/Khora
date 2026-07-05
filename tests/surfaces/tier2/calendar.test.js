import { describe, it, expect, afterEach } from 'vitest';
import { InMemoryLog } from '../../../src/kernel/log.js';
import { createCalendarSurface } from '../../../src/surfaces/tier2/calendar.js';
import { setEnabled } from '../../../src/surfaces/tier2/flags.js';

const provenance = { agent: 'user:alice', mode_of_givenness: 'direct-report', context: 'calendar-ui' };

describe('createCalendarSurface', () => {
  afterEach(() => setEnabled('calendar', false));

  it('refuses every write binding while the flag is off, and appends nothing', async () => {
    const log = new InMemoryLog();
    const calendar = createCalendarSurface({ log });

    const newResult = await calendar.bindings.newEvent({ eventId: 'ev1', title: 'Hearing', startsAt: '2026-08-01' }, provenance);
    const rescheduleResult = await calendar.bindings.reschedule({ eventId: 'ev1', startsAt: '2026-08-08' }, provenance);

    expect(newResult).toEqual({ ok: false, reason: 'disabled', flag: 'calendar' });
    expect(rescheduleResult).toEqual({ ok: false, reason: 'disabled', flag: 'calendar' });
    expect((await log.slice()).length).toBe(0);
  });

  it('appends a valid binding once the flag is enabled', async () => {
    const log = new InMemoryLog();
    const calendar = createCalendarSurface({ log });
    setEnabled('calendar', true);

    const result = await calendar.bindings.newEvent({ eventId: 'ev1', calendarId: 'cal1', title: 'Hearing', startsAt: '2026-08-01' }, provenance);

    expect(result.ok).toBe(true);
    const { events } = await calendar.read({ calendarId: 'cal1' });
    expect(events).toHaveLength(1);
  });

  it('still refuses a binding missing its provenance envelope, even with the flag on', async () => {
    const log = new InMemoryLog();
    const calendar = createCalendarSurface({ log });
    setEnabled('calendar', true);

    const result = await calendar.bindings.reschedule({ eventId: 'ev1', startsAt: '2026-08-08' }, null);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid');
    expect((await log.slice()).length).toBe(0);
  });
});
