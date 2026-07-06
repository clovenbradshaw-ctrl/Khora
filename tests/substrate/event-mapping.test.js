import { describe, it, expect } from 'vitest';
import {
  entryToEventContent,
  eventContentToEntry,
  RULES_REV,
  EO_ENTRY_EVENT_TYPE,
} from '../../src/substrate/event-mapping.js';

describe('entryToEventContent', () => {
  it('maps a kernel entry to the social.hyphae.eo.entry content shape', () => {
    const entry = {
      op: 'DEF',
      address: { mode: 0, domain: 2, object: 1 },
      target: 'entity:123',
      operand: 'revised value',
      given: { mode_of_givenness: 'direct-report', context: 'intake-form' },
      grounding: ['$archived-source-1'],
    };
    const content = entryToEventContent(entry);

    expect(content.rules_rev).toBe(RULES_REV);
    expect(content.op).toBe('DEF');
    expect(content.address).toEqual({ act: [0, 2], site: [2, 1], resolution: [0, 1] });
    expect(content.target).toBe('entity:123');
    expect(content.operand).toBe('revised value');
    expect(content.given).toEqual({ mode_of_givenness: 'direct-report', context: 'intake-form' });
    expect(content.grounding).toEqual(['$archived-source-1']);
  });

  it('defaults operand and grounding when absent', () => {
    const entry = {
      op: 'INS',
      address: { mode: 2, domain: 0, object: 0 },
      target: 'entity:1',
      given: { mode_of_givenness: 'observed', context: 'field-note' },
    };
    const content = entryToEventContent(entry);
    expect(content.operand).toBeNull();
    expect(content.grounding).toEqual([]);
  });

  it('rejects an illegal address rather than mapping it out', () => {
    const entry = {
      op: 'DEF',
      address: { mode: 9, domain: 0, object: 0 },
      given: { mode_of_givenness: 'x', context: 'y' },
    };
    expect(() => entryToEventContent(entry)).toThrow();
  });

  it('rejects the desert address (SYN by Ground)', () => {
    const entry = {
      op: 'SYN',
      address: { mode: 2, domain: 1, object: 0 },
      given: { mode_of_givenness: 'x', context: 'y' },
    };
    expect(() => entryToEventContent(entry)).toThrow(/desert/);
  });

  it('rejects an unknown operator code', () => {
    const entry = {
      op: 'SUP',
      address: { mode: 0, domain: 0, object: 0 },
      given: { mode_of_givenness: 'x', context: 'y' },
    };
    expect(() => entryToEventContent(entry)).toThrow();
  });

  it('rejects a missing provenance envelope', () => {
    const entry = { op: 'INS', address: { mode: 2, domain: 0, object: 0 } };
    expect(() => entryToEventContent(entry)).toThrow();
  });
});

describe('eventContentToEntry', () => {
  it('pulls the agent from event.sender and the timestamp from origin_server_ts', () => {
    const event = {
      sender: '@alice:example.org',
      origin_server_ts: 1750000000000,
      type: EO_ENTRY_EVENT_TYPE,
      content: {
        rules_rev: RULES_REV,
        op: 'DEF',
        address: { act: [0, 2], site: [2, 1], resolution: [0, 1] },
        target: 'entity:123',
        operand: 'revised value',
        given: { mode_of_givenness: 'direct-report', context: 'intake-form' },
        grounding: ['$archived-source-1'],
      },
    };
    const entry = eventContentToEntry(event);

    expect(entry.agent).toBe('@alice:example.org');
    expect(entry.timestamp).toBe(1750000000000);
    expect(entry.op).toBe('DEF');
    expect(entry.address).toEqual({ mode: 0, domain: 2, object: 1 });
    expect(entry.target).toBe('entity:123');
    expect(entry.given).toEqual({ mode_of_givenness: 'direct-report', context: 'intake-form' });
    expect(entry.grounding).toEqual(['$archived-source-1']);
  });

  it('rejects an event whose resolution tuple contradicts its act/site tuples', () => {
    const event = {
      sender: '@alice:example.org',
      origin_server_ts: 1,
      content: {
        op: 'DEF',
        address: { act: [0, 2], site: [2, 1], resolution: [9, 9] },
        given: { mode_of_givenness: 'x', context: 'y' },
      },
    };
    expect(() => eventContentToEntry(event)).toThrow();
  });

  it('rejects a desert address reconstructed from event content', () => {
    const event = {
      sender: '@alice:example.org',
      origin_server_ts: 1,
      content: {
        op: 'SYN',
        address: { act: [2, 1], site: [1, 0], resolution: [2, 0] },
        given: { mode_of_givenness: 'x', context: 'y' },
      },
    };
    expect(() => eventContentToEntry(event)).toThrow(/desert/);
  });
});

describe('round trip', () => {
  it('preserves logical content through entry -> event content -> entry', () => {
    const entry = {
      op: 'INS',
      address: { mode: 2, domain: 0, object: 0 },
      target: 'entity:456',
      operand: null,
      given: { mode_of_givenness: 'observed', context: 'field-note' },
      grounding: [],
    };
    const content = entryToEventContent(entry);
    const event = { sender: '@bob:example.org', origin_server_ts: 42, type: EO_ENTRY_EVENT_TYPE, content };
    const roundTripped = eventContentToEntry(event);

    expect(roundTripped.op).toBe(entry.op);
    expect(roundTripped.address).toEqual(entry.address);
    expect(roundTripped.target).toBe(entry.target);
    expect(roundTripped.operand).toBe(entry.operand);
    expect(roundTripped.given).toEqual(entry.given);
    expect(roundTripped.grounding).toEqual(entry.grounding);
    expect(roundTripped.agent).toBe('@bob:example.org');
    expect(roundTripped.timestamp).toBe(42);
  });
});
