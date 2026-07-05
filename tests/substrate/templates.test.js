import { describe, it, expect } from 'vitest';
import { TEMPLATES, PUBLIC_READ_ONLY, PRIVATE_INVITE_ONLY, GHOST_WRITABLE } from '../../src/substrate/templates.js';
import { EO_ENTRY_EVENT_TYPE } from '../../src/substrate/event-mapping.js';

describe('room templates', () => {
  it('every template fixes a visibility, a join rule, and a power-level map', () => {
    for (const template of Object.values(TEMPLATES)) {
      expect(['public', 'private']).toContain(template.visibility);
      expect(['public', 'invite']).toContain(template.join_rule);
      expect(typeof template.power_levels).toBe('object');
      expect(typeof template.power_levels[EO_ENTRY_EVENT_TYPE]).toBe('number');
    }
  });

  it('public read-only is world-readable but requires elevated power to append entries', () => {
    expect(PUBLIC_READ_ONLY.visibility).toBe('public');
    expect(PUBLIC_READ_ONLY.join_rule).toBe('public');
    expect(PUBLIC_READ_ONLY.history_visibility).toBe('world_readable');
    expect(PUBLIC_READ_ONLY.power_levels[EO_ENTRY_EVENT_TYPE]).toBeGreaterThan(0);
  });

  it('private invite-only gates read access through membership', () => {
    expect(PRIVATE_INVITE_ONLY.visibility).toBe('private');
    expect(PRIVATE_INVITE_ONLY.join_rule).toBe('invite');
    expect(PRIVATE_INVITE_ONLY.history_visibility).toBe('invited');
  });

  it('ghost-writable accepts writes at the default power level', () => {
    expect(GHOST_WRITABLE.join_rule).toBe('public');
    expect(GHOST_WRITABLE.power_levels[EO_ENTRY_EVENT_TYPE]).toBe(0);
  });

  it('templates and their power-level maps are frozen', () => {
    for (const template of Object.values(TEMPLATES)) {
      expect(Object.isFrozen(template)).toBe(true);
      expect(Object.isFrozen(template.power_levels)).toBe(true);
    }
  });
});
