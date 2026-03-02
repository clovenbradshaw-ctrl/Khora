/**
 * Vault Snapshot — Data persistence round-trip
 * Tests the complete vault save/load cycle with encrypted field storage.
 *
 * Tier 2 + Tier 4: Vault data must survive save → encrypt → decrypt → render.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockMatrixClient } from '../setup.js';

describe('Vault Snapshot — Save/Load Cycle', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@alice:test.local';
    LocalVaultCrypto.clear();
  });

  it('full snapshot structure saves and loads with all fields intact', async () => {
    const svc = new KhoraService();
    const roomId = (await mockClient.createRoom({ name: 'vault' })).room_id;

    const snapshot = {
      fields: {
        first_name: 'Alice',
        last_name: 'Smith',
        dob: '1990-01-15',
        gender: 'female',
        race_ethnicity: ['White', 'Hispanic'],
        veteran_status: 'no',
        disability_status: 'none',
      },
      observations: [
        { id: 'obs_1', category: 'housing', value: 'Stable', date: '2024-06-01', source: 'self-report' },
      ],
      metrics_consent: true,
      custom_field_defs: [
        { id: 'cf_1', label: 'Preferred Name', type: 'text' },
      ],
      enabled_frameworks: ['hmis', 'sdoh'],
      last_modified_by: '@alice:test.local',
      last_modified_at: Date.now(),
      origin_server: 'test.local',
    };

    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, snapshot);
    const loaded = await svc.getState(roomId, EVT.VAULT_SNAPSHOT);

    expect(loaded).toEqual(snapshot);
  });

  it('empty observations array stays as empty array (not undefined)', async () => {
    const svc = new KhoraService();
    const roomId = (await mockClient.createRoom({ name: 'vault' })).room_id;

    const snapshot = {
      fields: { first_name: 'Bob' },
      observations: [],
      metrics_consent: false,
      custom_field_defs: [],
      enabled_frameworks: [],
      last_modified_by: '@bob:test.local',
      last_modified_at: Date.now(),
    };

    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, snapshot);
    const loaded = await svc.getState(roomId, EVT.VAULT_SNAPSHOT);

    expect(loaded.observations).toEqual([]);
    expect(loaded.custom_field_defs).toEqual([]);
    expect(loaded.enabled_frameworks).toEqual([]);
    expect(loaded.metrics_consent).toBe(false);
  });

  it('last_modified_by and last_modified_at are preserved', async () => {
    const svc = new KhoraService();
    const roomId = (await mockClient.createRoom({ name: 'vault' })).room_id;
    const ts = Date.now();

    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, {
      fields: {},
      last_modified_by: '@alice:test.local',
      last_modified_at: ts,
    });

    const loaded = await svc.getState(roomId, EVT.VAULT_SNAPSHOT);
    expect(loaded.last_modified_by).toBe('@alice:test.local');
    expect(loaded.last_modified_at).toBe(ts);
  });

  it('vault snapshot encrypted with LocalVaultCrypto round-trips correctly', async () => {
    await LocalVaultCrypto.deriveKey('@alice:test.local', 'token_abc', 'DEV_1');

    const data = {
      fields: { first_name: 'Alice', ssn_last4: '1234' },
      observations: [{ id: 'obs_1', value: 'housing stable' }],
      metrics_consent: true,
    };

    // Encrypt
    const encrypted = await LocalVaultCrypto.encrypt(data);
    expect(encrypted.__enc).toBe(1);
    expect(encrypted.ct).toBeDefined();

    // Decrypt
    const decrypted = await LocalVaultCrypto.decrypt(encrypted);
    expect(decrypted).toEqual(data);
    expect(decrypted.fields.first_name).toBe('Alice');
    expect(decrypted.fields.ssn_last4).toBe('1234');
    expect(decrypted.observations[0].value).toBe('housing stable');
  });

  it('sequential updates preserve data correctly', async () => {
    const svc = new KhoraService();
    const roomId = (await mockClient.createRoom({ name: 'vault' })).room_id;

    // V1: initial
    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, {
      fields: { first_name: 'Alice', last_name: 'Smith' },
      observations: [],
      last_modified_at: 1000,
    });

    // V2: add observation
    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, {
      fields: { first_name: 'Alice', last_name: 'Smith' },
      observations: [{ id: 'obs_1', value: 'stable housing' }],
      last_modified_at: 2000,
    });

    // V3: update name
    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, {
      fields: { first_name: 'Alice', last_name: 'Johnson' },
      observations: [{ id: 'obs_1', value: 'stable housing' }],
      last_modified_at: 3000,
    });

    const final = await svc.getState(roomId, EVT.VAULT_SNAPSHOT);
    expect(final.fields.last_name).toBe('Johnson');
    expect(final.observations).toHaveLength(1);
    expect(final.last_modified_at).toBe(3000);
  });
});
