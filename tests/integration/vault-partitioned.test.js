/**
 * Vault Partitioned Fields — Category-based state event storage
 * Tests the new VAULT_FIELDS partitioned format alongside legacy VAULT_SNAPSHOT.
 *
 * Phase 0: Vault snapshot decomposition — fields partitioned by category,
 * observations as timeline events.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockMatrixClient } from '../setup.js';

describe('Vault Partitioned Fields', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@alice:test.local';
  });

  it('VAULT_FIELDS constant exists with correct namespace', () => {
    expect(EVT.VAULT_FIELDS).toBe('io.khora.vault.fields');
  });

  it('VAULT_OBSERVATION constant exists with correct namespace', () => {
    expect(EVT.VAULT_OBSERVATION).toBe('io.khora.vault.observation');
  });

  it('partitioned fields save and load by category', async () => {
    const roomId = (await mockClient.createRoom({ name: 'vault' })).room_id;

    // Write partitioned data
    await svc.setState(roomId, EVT.VAULT_FIELDS, {
      fields: { first_name: 'Alice', last_name: 'Smith', dob: '1990-01-15' },
      last_modified_at: 1000
    }, 'identity');

    await svc.setState(roomId, EVT.VAULT_FIELDS, {
      fields: { phone: '555-0100', email: 'alice@test.com' },
      last_modified_at: 1000
    }, 'contact');

    await svc.setState(roomId, EVT.VAULT_FIELDS, {
      fields: { ssn_last4: '1234' },
      last_modified_at: 1000
    }, 'ids');

    // Read each category independently
    const identity = await svc.getState(roomId, EVT.VAULT_FIELDS, 'identity');
    const contact = await svc.getState(roomId, EVT.VAULT_FIELDS, 'contact');
    const ids = await svc.getState(roomId, EVT.VAULT_FIELDS, 'ids');

    expect(identity.fields.first_name).toBe('Alice');
    expect(identity.fields.dob).toBe('1990-01-15');
    expect(contact.fields.phone).toBe('555-0100');
    expect(ids.fields.ssn_last4).toBe('1234');
  });

  it('settings partition stores consent and frameworks', async () => {
    const roomId = (await mockClient.createRoom({ name: 'vault' })).room_id;

    await svc.setState(roomId, EVT.VAULT_FIELDS, {
      metrics_consent: { enabled: true, categories: ['housing'] },
      custom_field_defs: [{ id: 'cf_1', label: 'Preferred Name', type: 'text' }],
      enabled_frameworks: ['hmis', 'sdoh'],
      last_modified_at: 1000
    }, 'settings');

    const settings = await svc.getState(roomId, EVT.VAULT_FIELDS, 'settings');
    expect(settings.metrics_consent.enabled).toBe(true);
    expect(settings.custom_field_defs).toHaveLength(1);
    expect(settings.enabled_frameworks).toEqual(['hmis', 'sdoh']);
  });

  it('categories are independent — updating one does not affect others', async () => {
    const roomId = (await mockClient.createRoom({ name: 'vault' })).room_id;

    await svc.setState(roomId, EVT.VAULT_FIELDS, {
      fields: { first_name: 'Alice' }, last_modified_at: 1000
    }, 'identity');

    await svc.setState(roomId, EVT.VAULT_FIELDS, {
      fields: { phone: '555-0100' }, last_modified_at: 1000
    }, 'contact');

    // Update identity only
    await svc.setState(roomId, EVT.VAULT_FIELDS, {
      fields: { first_name: 'Alicia' }, last_modified_at: 2000
    }, 'identity');

    // Contact should be unchanged
    const contact = await svc.getState(roomId, EVT.VAULT_FIELDS, 'contact');
    expect(contact.fields.phone).toBe('555-0100');

    const identity = await svc.getState(roomId, EVT.VAULT_FIELDS, 'identity');
    expect(identity.fields.first_name).toBe('Alicia');
  });

  it('fieldCategory maps fields to correct categories', () => {
    expect(fieldCategory('first_name')).toBe('identity');
    expect(fieldCategory('last_name')).toBe('identity');
    expect(fieldCategory('dob')).toBe('identity');
    expect(fieldCategory('phone')).toBe('contact');
    expect(fieldCategory('email')).toBe('contact');
    expect(fieldCategory('ssn_last4')).toBe('ids');
    expect(fieldCategory('hmis_id')).toBe('ids');
    // Unknown fields default to 'identity'
    expect(fieldCategory('custom_field_xyz')).toBe('identity');
  });

  it('observation timeline events save and retrieve via getTimeline', async () => {
    const roomId = (await mockClient.createRoom({ name: 'vault' })).room_id;

    const obs1 = { id: 'obs_1', category: 'housing', value: 'Stable', ts: 1000 };
    const obs2 = { id: 'obs_2', category: 'employment', value: 'Full-time', ts: 2000 };

    await svc.sendEvent(roomId, EVT.VAULT_OBSERVATION, obs1);
    await svc.sendEvent(roomId, EVT.VAULT_OBSERVATION, obs2);

    const timeline = await svc.getTimeline(roomId, EVT.VAULT_OBSERVATION);
    expect(timeline).toHaveLength(2);
    expect(timeline[0].content.category).toBe('housing');
    expect(timeline[1].content.category).toBe('employment');
  });

  it('legacy VAULT_SNAPSHOT still works as fallback', async () => {
    const roomId = (await mockClient.createRoom({ name: 'vault' })).room_id;

    // Write only legacy snapshot (no VAULT_FIELDS)
    const snapshot = {
      fields: { first_name: 'Alice', phone: '555-0100' },
      observations: [{ id: 'obs_1', category: 'housing', value: 'Stable' }],
      metrics_consent: { enabled: false, categories: [] },
      custom_field_defs: [],
      enabled_frameworks: ['hmis'],
      last_modified_at: 1000
    };
    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, snapshot);

    // Reading VAULT_FIELDS should return null (not set)
    const identity = await svc.getState(roomId, EVT.VAULT_FIELDS, 'identity');
    expect(identity).toBeNull();

    // Legacy snapshot should still be readable
    const legacy = await svc.getState(roomId, EVT.VAULT_SNAPSHOT);
    expect(legacy.fields.first_name).toBe('Alice');
    expect(legacy.observations).toHaveLength(1);
  });
});
