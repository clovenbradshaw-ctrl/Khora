/**
 * Bridge Flow — Client-Provider data sharing
 * Tests bridge room creation, metadata, encrypted field sharing, and power levels.
 *
 * Tier 1 + Tier 2: Security-critical path for field sharing between client and provider.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockMatrixClient } from '../setup.js';

describe('Bridge Flow — Client-Provider Sharing', () => {
  let svc;
  let mockClient;
  const PROVIDER = '@provider:test.local';
  const CLIENT = '@alice:test.local';

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    svc = new KhoraService();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = PROVIDER;
  });

  it('create bridge → set BRIDGE_META → read → correct IDs', async () => {
    const roomId = await svc.createClientRoom('Bridge: Alice ↔ Metro Services', 'bridge', [], CLIENT);

    const meta = {
      provider: PROVIDER,
      client: CLIENT,
      org_id: '!org:test.local',
      org_name: 'Metro Services',
      created_at: Date.now(),
      status: 'active',
    };
    await svc.setState(roomId, EVT.BRIDGE_META, meta);

    const saved = await svc.getState(roomId, EVT.BRIDGE_META);
    expect(saved.provider).toBe(PROVIDER);
    expect(saved.client).toBe(CLIENT);
    expect(saved.org_name).toBe('Metro Services');
    expect(saved.status).toBe('active');
  });

  it('encrypted field sharing via BRIDGE_REFS round-trip', async () => {
    const roomId = await svc.createClientRoom('Bridge', 'bridge', [], CLIENT);

    // Simulate client sharing encrypted fields
    const key = await FieldCrypto.generateKey();
    const { ciphertext: encName, iv: ivName } = await FieldCrypto.encrypt('Alice Smith', key);
    const { ciphertext: encDob, iv: ivDob } = await FieldCrypto.encrypt('1990-01-15', key);

    const refs = {
      encryption_key: key,
      shared_fields: {
        full_name: { ciphertext: encName, iv: ivName },
        dob: { ciphertext: encDob, iv: ivDob },
      },
      shared_at: Date.now(),
      shared_by: CLIENT,
    };
    await svc.setState(roomId, EVT.BRIDGE_REFS, refs);

    // Provider reads and decrypts
    const savedRefs = await svc.getState(roomId, EVT.BRIDGE_REFS);
    expect(savedRefs.encryption_key).toBe(key);

    const decName = await FieldCrypto.decrypt(
      savedRefs.shared_fields.full_name.ciphertext,
      savedRefs.shared_fields.full_name.iv,
      savedRefs.encryption_key,
    );
    const decDob = await FieldCrypto.decrypt(
      savedRefs.shared_fields.dob.ciphertext,
      savedRefs.shared_fields.dob.iv,
      savedRefs.encryption_key,
    );

    expect(decName).toBe('Alice Smith');
    expect(decDob).toBe('1990-01-15');
  });

  it('revoked bridge has status "revoked" in metadata', async () => {
    const roomId = await svc.createClientRoom('Bridge', 'bridge', [], CLIENT);

    // Create then revoke
    await svc.setState(roomId, EVT.BRIDGE_META, {
      provider: PROVIDER, client: CLIENT, status: 'active', created_at: Date.now(),
    });

    await svc.setState(roomId, EVT.BRIDGE_META, {
      provider: PROVIDER, client: CLIENT, status: 'revoked', revoked_at: Date.now(), revoked_by: CLIENT,
    });

    const meta = await svc.getState(roomId, EVT.BRIDGE_META);
    expect(meta.status).toBe('revoked');
    expect(meta.revoked_by).toBe(CLIENT);
    expect(meta.revoked_at).toBeDefined();
  });

  it('power levels enforce client sovereignty (PL 100 client, PL 50 provider)', async () => {
    const roomId = await svc.createClientRoom('Bridge', 'bridge', [], CLIENT);

    const pl = mockClient._getInternal(roomId, 'm.room.power_levels', '');

    // Client is sovereign — PL 100
    expect(pl.users[CLIENT]).toBe(100);
    // Provider has restricted access — PL 50
    expect(pl.users[PROVIDER]).toBe(50);
    // Bridge state events locked to client only (PL 100)
    expect(pl.events[EVT.BRIDGE_META]).toBe(100);
    expect(pl.events[EVT.BRIDGE_REFS]).toBe(100);
    expect(pl.events[EVT.IDENTITY]).toBe(100);
  });

  it('multiple bridges for same client with different providers stay independent', async () => {
    const roomId1 = await svc.createClientRoom('Bridge 1', 'bridge', [], CLIENT);
    const roomId2 = await svc.createClientRoom('Bridge 2', 'bridge', [], CLIENT);

    await svc.setState(roomId1, EVT.BRIDGE_META, {
      provider: PROVIDER, client: CLIENT, org_name: 'Metro Services',
    });
    await svc.setState(roomId2, EVT.BRIDGE_META, {
      provider: '@other_prov:test', client: CLIENT, org_name: 'Health Clinic',
    });

    const meta1 = await svc.getState(roomId1, EVT.BRIDGE_META);
    const meta2 = await svc.getState(roomId2, EVT.BRIDGE_META);

    expect(meta1.org_name).toBe('Metro Services');
    expect(meta2.org_name).toBe('Health Clinic');
    expect(meta1.provider).toBe(PROVIDER);
    expect(meta2.provider).toBe('@other_prov:test');
  });

  it('observation lifecycle: create → store → retrieve → values match', async () => {
    const roomId = await svc.createClientRoom('Bridge', 'bridge', [], CLIENT);

    const observation = {
      id: genOpId(),
      category: 'housing',
      value: 'Client reports stable housing, lease renewed for 12 months.',
      observed_by: PROVIDER,
      observed_at: Date.now(),
      source: 'provider_observation',
      bridge_room_id: roomId,
    };

    // Store as a state event in bridge (keyed by observation ID)
    await svc.setState(roomId, EVT.OBSERVATION, observation, observation.id);

    const saved = await svc.getState(roomId, EVT.OBSERVATION, observation.id);
    expect(saved.category).toBe('housing');
    expect(saved.value).toContain('stable housing');
    expect(saved.observed_by).toBe(PROVIDER);
  });
});
