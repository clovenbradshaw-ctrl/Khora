/**
 * BridgeKeyManager — Key separation from ciphertext
 * Tests key storage, retrieval, revocation, and backward-compatible decryption.
 *
 * Phase 1: Genuine two-factor security model — keys and ciphertext stored separately.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockMatrixClient } from '../setup.js';

describe('BridgeKeyManager — Key Separation', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@alice:test.local';
  });

  it('storeKeys + getKeys round-trip', async () => {
    const roomId = (await mockClient.createRoom({ name: 'bridge' })).room_id;
    const keys = { full_name: 'key_aaa', dob: 'key_bbb' };

    await BridgeKeyManager.storeKeys(roomId, keys);
    const loaded = await BridgeKeyManager.getKeys(roomId);

    expect(loaded.full_name).toBe('key_aaa');
    expect(loaded.dob).toBe('key_bbb');
  });

  it('revokeKeys clears all keys and marks revoked', async () => {
    const roomId = (await mockClient.createRoom({ name: 'bridge' })).room_id;
    await BridgeKeyManager.storeKeys(roomId, { full_name: 'key_aaa' });

    await BridgeKeyManager.revokeKeys(roomId);

    const state = await svc.getState(roomId, EVT.BRIDGE_KEYS);
    expect(state.keys).toEqual({});
    expect(state.revoked).toBe(true);
  });

  it('getKeys returns empty object for room with no keys', async () => {
    const roomId = (await mockClient.createRoom({ name: 'bridge' })).room_id;
    const keys = await BridgeKeyManager.getKeys(roomId);
    expect(keys).toEqual({});
  });

  it('decryptRefs with new format (separated keys)', async () => {
    const roomId = (await mockClient.createRoom({ name: 'bridge' })).room_id;

    // Encrypt fields
    const key1 = await FieldCrypto.generateKey();
    const key2 = await FieldCrypto.generateKey();
    const enc1 = await FieldCrypto.encrypt('Alice Smith', key1);
    const enc2 = await FieldCrypto.encrypt('1990-01-15', key2);

    // Store ciphertext in refs (NO keys)
    const refs = {
      fields: {
        full_name: { ciphertext: enc1.ciphertext, iv: enc1.iv },
        dob: { ciphertext: enc2.ciphertext, iv: enc2.iv },
      }
    };
    await svc.setState(roomId, EVT.BRIDGE_REFS, refs);

    // Store keys separately
    await BridgeKeyManager.storeKeys(roomId, { full_name: key1, dob: key2 });

    // Decrypt — should find keys from BRIDGE_KEYS
    const decrypted = await BridgeKeyManager.decryptRefs(refs, roomId);
    expect(decrypted.full_name).toBe('Alice Smith');
    expect(decrypted.dob).toBe('1990-01-15');
  });

  it('decryptRefs with legacy format (inline keys)', async () => {
    const roomId = (await mockClient.createRoom({ name: 'bridge' })).room_id;

    // Legacy format: keys stored inline with ciphertext
    const key = await FieldCrypto.generateKey();
    const enc = await FieldCrypto.encrypt('Alice Smith', key);
    const refs = {
      fields: {
        full_name: { ciphertext: enc.ciphertext, iv: enc.iv, key }
      }
    };

    // No separate BRIDGE_KEYS event — legacy bridge
    const decrypted = await BridgeKeyManager.decryptRefs(refs, roomId);
    expect(decrypted.full_name).toBe('Alice Smith');
  });

  it('decryptRefs returns empty object for empty refs', async () => {
    const roomId = (await mockClient.createRoom({ name: 'bridge' })).room_id;
    const decrypted = await BridgeKeyManager.decryptRefs({ fields: {} }, roomId);
    expect(decrypted).toEqual({});
  });

  it('decryptRefs returns empty object for null refs', async () => {
    const roomId = (await mockClient.createRoom({ name: 'bridge' })).room_id;
    const decrypted = await BridgeKeyManager.decryptRefs(null, roomId);
    expect(decrypted).toEqual({});
  });

  it('decryptRefs skips fields with wrong key gracefully', async () => {
    const roomId = (await mockClient.createRoom({ name: 'bridge' })).room_id;

    const realKey = await FieldCrypto.generateKey();
    const wrongKey = await FieldCrypto.generateKey();
    const enc = await FieldCrypto.encrypt('Alice Smith', realKey);

    const refs = {
      fields: {
        full_name: { ciphertext: enc.ciphertext, iv: enc.iv }
      }
    };

    // Store wrong key
    await BridgeKeyManager.storeKeys(roomId, { full_name: wrongKey });

    const decrypted = await BridgeKeyManager.decryptRefs(refs, roomId);
    // Should be empty — wrong key returns null from FieldCrypto.decrypt
    expect(decrypted.full_name).toBeUndefined();
  });

  it('BRIDGE_KEYS constant exists and has correct namespace', () => {
    expect(EVT.BRIDGE_KEYS).toBe('io.khora.bridge.keys');
  });

  it('power levels lock BRIDGE_KEYS to PL 100 (client-only)', async () => {
    const roomId = await svc.createClientRoom('Bridge', 'test', [], '@client:test.local');
    const pl = mockClient._getInternal(roomId, 'm.room.power_levels', '');
    expect(pl.events[EVT.BRIDGE_KEYS]).toBe(100);
  });
});
