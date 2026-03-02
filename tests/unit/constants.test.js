/**
 * EVT Constants — Event type namespace integrity
 * Source: app/constants.js (EVT object, line 2)
 *
 * Tier 2: Data Integrity — duplicate event types would cause data collisions.
 */
import { describe, it, expect } from 'vitest';

describe('EVT namespace', () => {
  it('all EVT values are unique (no duplicate event types)', () => {
    const values = Object.values(EVT);
    const unique = new Set(values);
    const dupes = values.filter((v, i) => values.indexOf(v) !== i);
    expect(dupes).toEqual([]);
    expect(unique.size).toBe(values.length);
  });

  it('all EVT values start with io.khora.', () => {
    for (const [key, val] of Object.entries(EVT)) {
      expect(val).toMatch(/^io\.khora\./);
    }
  });

  it('NS constant is io.khora', () => {
    expect(NS).toBe('io.khora');
  });

  it('critical event types are present', () => {
    expect(EVT.IDENTITY).toBe('io.khora.identity');
    expect(EVT.OP).toBe('io.khora.op');
    expect(EVT.VAULT_SNAPSHOT).toBe('io.khora.vault.snapshot');
    expect(EVT.VAULT_PROVIDERS).toBe('io.khora.vault.providers');
    expect(EVT.BRIDGE_META).toBe('io.khora.bridge.meta');
    expect(EVT.BRIDGE_REFS).toBe('io.khora.bridge.refs');
    expect(EVT.OBSERVATION).toBe('io.khora.observation');
    expect(EVT.SCHEMA_FORM).toBe('io.khora.schema.form');
    expect(EVT.METRIC).toBe('io.khora.metric');
    expect(EVT.FIELD_DEF).toBe('io.khora.field.definition');
  });

  it('ROLES constant has client and provider', () => {
    expect(ROLES).toBeDefined();
    expect(ROLES.client).toBeDefined();
    expect(ROLES.provider).toBeDefined();
  });

  it('MATURITY_LEVELS has expected keys', () => {
    expect(MATURITY_LEVELS).toBeDefined();
    const keys = Object.keys(MATURITY_LEVELS);
    for (const k of ['draft', 'trial', 'normative', 'de_facto', 'deprecated']) {
      expect(keys).toContain(k);
    }
  });
});
