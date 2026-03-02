/**
 * Data Lifecycle — Create → Save → Retrieve → Verify
 * Tests the full data round-trip through KhoraService with MockMatrixClient.
 *
 * Tier 2 + Tier 4: Ensures data is actually created, saved, and retrievable.
 * This is the core "data is actually being created and saved" test the user requested.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockMatrixClient } from '../setup.js';

describe('Data Lifecycle — Full Round-Trip', () => {
  let svc;
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    svc = new KhoraService();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@provider:test.local';
  });

  it('create room → set identity → read identity → data matches', async () => {
    const roomId = await svc.createRoom('Client Vault', 'Vault for Alice');
    expect(roomId).toBeTruthy();

    const identity = { account_type: 'client', owner: '@alice:test.local', created_at: Date.now() };
    await svc.setState(roomId, EVT.IDENTITY, identity);

    const result = await svc.getState(roomId, EVT.IDENTITY);
    expect(result).toEqual(identity);
    expect(result.account_type).toBe('client');
    expect(result.owner).toBe('@alice:test.local');
  });

  it('vault snapshot: save fields → retrieve → all fields match', async () => {
    const roomId = await svc.createRoom('Vault', 'Client vault');

    const snapshot = {
      fields: {
        first_name: 'Alice',
        last_name: 'Smith',
        dob: '1990-01-15',
        ssn_last4: '1234',
        phone: '555-0100',
        email: 'alice@example.com',
      },
      observations: [
        { id: 'obs_1', category: 'housing', value: 'Stable housing, lease current', ts: Date.now() },
        { id: 'obs_2', category: 'employment', value: 'Full-time employed', ts: Date.now() },
      ],
      metrics_consent: true,
      custom_field_defs: [],
      enabled_frameworks: ['hmis', 'sdoh'],
      last_modified_by: '@alice:test.local',
      last_modified_at: Date.now(),
      origin_server: 'test.local',
    };

    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, snapshot);
    const saved = await svc.getState(roomId, EVT.VAULT_SNAPSHOT);

    // Verify every field was saved and retrieved correctly
    expect(saved.fields.first_name).toBe('Alice');
    expect(saved.fields.last_name).toBe('Smith');
    expect(saved.fields.dob).toBe('1990-01-15');
    expect(saved.fields.ssn_last4).toBe('1234');
    expect(saved.fields.phone).toBe('555-0100');
    expect(saved.fields.email).toBe('alice@example.com');
    expect(saved.observations).toHaveLength(2);
    expect(saved.observations[0].category).toBe('housing');
    expect(saved.metrics_consent).toBe(true);
    expect(saved.enabled_frameworks).toEqual(['hmis', 'sdoh']);
    expect(saved.last_modified_by).toBe('@alice:test.local');
  });

  it('update single field → retrieve → only that field changed', async () => {
    const roomId = await svc.createRoom('Vault', 'Client vault');

    // Initial save
    const initial = {
      fields: { first_name: 'Alice', last_name: 'Smith', dob: '1990-01-15' },
      observations: [],
      last_modified_by: '@alice:test.local',
      last_modified_at: Date.now(),
    };
    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, initial);

    // Update: change last_name only
    const updated = {
      ...initial,
      fields: { ...initial.fields, last_name: 'Johnson' },
      last_modified_at: Date.now() + 1000,
    };
    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, updated);

    const result = await svc.getState(roomId, EVT.VAULT_SNAPSHOT);
    expect(result.fields.first_name).toBe('Alice');       // unchanged
    expect(result.fields.last_name).toBe('Johnson');       // changed
    expect(result.fields.dob).toBe('1990-01-15');          // unchanged
  });

  it('multiple event types in same room remain independent', async () => {
    const roomId = await svc.createRoom('Vault', 'vault');

    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, { fields: { name: 'Alice' } });
    await svc.setState(roomId, EVT.VAULT_PROVIDERS, { providers: [{ id: '@p:test', name: 'Dr. Smith' }] });
    await svc.setState(roomId, EVT.IDENTITY, { account_type: 'client', owner: '@alice:test' });

    // Each event type returns its own data — no cross-contamination
    const snapshot = await svc.getState(roomId, EVT.VAULT_SNAPSHOT);
    const providers = await svc.getState(roomId, EVT.VAULT_PROVIDERS);
    const identity = await svc.getState(roomId, EVT.IDENTITY);

    expect(snapshot.fields.name).toBe('Alice');
    expect(providers.providers[0].name).toBe('Dr. Smith');
    expect(identity.account_type).toBe('client');
  });

  it('EO operation: emitOp sends event and returns event object', async () => {
    const roomId = await svc.createRoom('Vault', 'vault');
    // emitOp uses the global svc, so wire it up
    globalThis.svc = svc;

    const event = await emitOp(roomId, 'INS', dot('vault', 'fields', 'name'), {
      value: 'Alice', source: 'client_input',
    }, { type: 'vault', epistemic: 'given' });

    expect(event).not.toBeNull();
    expect(event.op).toBe('INS');
    expect(event.target).toBe('vault.fields.name');
    expect(event.operand.value).toBe('Alice');
    expect(event.id).toMatch(/^op_/);
    expect(event.provenance).toBeDefined();

    // Verify the event was actually sent to the room timeline
    expect(mockClient._timeline.length).toBe(1);
    expect(mockClient._timeline[0].content.op).toBe('INS');
  });

  it('provider index: save and retrieve provider list', async () => {
    const roomId = await svc.createRoom('Vault', 'vault');

    const providers = {
      providers: [
        { bridgeRoomId: '!bridge1:test', orgName: 'Metro Services', sharedFields: { first_name: true, dob: true } },
        { bridgeRoomId: '!bridge2:test', orgName: 'Health Clinic', sharedFields: { first_name: true } },
      ],
    };
    await svc.setState(roomId, EVT.VAULT_PROVIDERS, providers);
    const saved = await svc.getState(roomId, EVT.VAULT_PROVIDERS);

    expect(saved.providers).toHaveLength(2);
    expect(saved.providers[0].orgName).toBe('Metro Services');
    expect(saved.providers[1].orgName).toBe('Health Clinic');
    expect(saved.providers[0].sharedFields.dob).toBe(true);
  });
});
