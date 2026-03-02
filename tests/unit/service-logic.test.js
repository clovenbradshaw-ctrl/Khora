/**
 * KhoraService — Transport layer reliability
 * Source: app/service.js
 *
 * Tier 3: Reliability — retry logic, encryption enforcement, power levels.
 * Tests are run against the real KhoraService class with a MockMatrixClient.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockMatrixClient } from '../setup.js';

describe('KhoraService', () => {
  let svcInstance;
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    svcInstance = new KhoraService();
    // Wire up KhoraAuth private fields (it uses getters)
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@provider:test.local';
    KhoraAuth._token = 'test_token';
    KhoraAuth._baseUrl = 'https://matrix.test.local';
  });

  describe('_withRetry', () => {
    it('returns the result on success', async () => {
      const result = await svcInstance._withRetry(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('retries on rate-limit errors', async () => {
      let attempts = 0;
      const fn = () => {
        attempts++;
        if (attempts < 3) {
          const err = new Error('too many requests');
          err.data = { retry_after_ms: 10 };
          throw err;
        }
        return Promise.resolve('ok');
      };
      const result = await svcInstance._withRetry(fn, 5);
      expect(result).toBe('ok');
      expect(attempts).toBe(3);
    });

    it('throws immediately on non-rate-limit errors', async () => {
      const fn = () => { throw new Error('Not found'); };
      await expect(svcInstance._withRetry(fn)).rejects.toThrow('Not found');
    });
  });

  describe('createRoom', () => {
    it('always includes encryption state event', async () => {
      const roomId = await svcInstance.createRoom('Test Room', 'A test room');
      expect(roomId).toMatch(/^!room/);

      // Verify m.room.encryption was set
      const enc = mockClient._getInternal(roomId, 'm.room.encryption', '');
      expect(enc).toEqual({ algorithm: 'm.megolm.v1.aes-sha2' });
    });

    it('includes extra state events', async () => {
      const extra = [{ type: 'io.khora.identity', state_key: '', content: { account_type: 'client' } }];
      const roomId = await svcInstance.createRoom('Client Room', 'topic', extra);

      const identity = mockClient._getInternal(roomId, 'io.khora.identity', '');
      expect(identity).toEqual({ account_type: 'client' });
    });
  });

  describe('createClientRoom', () => {
    it('sets client PL 100 and provider PL 50', async () => {
      const clientId = '@client:test.local';
      const roomId = await svcInstance.createClientRoom('Bridge', 'bridge room', [], clientId);

      const pl = mockClient._getInternal(roomId, 'm.room.power_levels', '');
      expect(pl.users[clientId]).toBe(100);
      expect(pl.users['@provider:test.local']).toBe(50);
    });

    it('locks bridge state events to client-only (PL 100)', async () => {
      const clientId = '@client:test.local';
      const roomId = await svcInstance.createClientRoom('Bridge', 'bridge room', [], clientId);

      const pl = mockClient._getInternal(roomId, 'm.room.power_levels', '');
      expect(pl.events[EVT.BRIDGE_META]).toBe(100);
      expect(pl.events[EVT.BRIDGE_REFS]).toBe(100);
      expect(pl.events[EVT.IDENTITY]).toBe(100);
    });

    it('includes encryption by default', async () => {
      const roomId = await svcInstance.createClientRoom('Bridge', 'topic', [], '@c:test');
      const enc = mockClient._getInternal(roomId, 'm.room.encryption', '');
      expect(enc).toEqual({ algorithm: 'm.megolm.v1.aes-sha2' });
    });
  });

  describe('setState / getState', () => {
    it('round-trip: write then read returns same content', async () => {
      const roomId = (await mockClient.createRoom({ name: 'test' })).room_id;
      const content = { fields: { name: 'Alice', dob: '1990-01-01' }, last_modified: Date.now() };
      await svcInstance.setState(roomId, EVT.VAULT_SNAPSHOT, content);
      const result = await svcInstance.getState(roomId, EVT.VAULT_SNAPSHOT);
      expect(result).toEqual(content);
    });

    it('different state types in same room do not clobber each other', async () => {
      const roomId = (await mockClient.createRoom({ name: 'test' })).room_id;
      await svcInstance.setState(roomId, EVT.VAULT_SNAPSHOT, { fields: { name: 'Alice' } });
      await svcInstance.setState(roomId, EVT.VAULT_PROVIDERS, { providers: ['@prov:test'] });

      const snapshot = await svcInstance.getState(roomId, EVT.VAULT_SNAPSHOT);
      const providers = await svcInstance.getState(roomId, EVT.VAULT_PROVIDERS);
      expect(snapshot.fields.name).toBe('Alice');
      expect(providers.providers).toEqual(['@prov:test']);
    });

    it('getState returns null for non-existent room', async () => {
      const result = await svcInstance.getState('!nonexistent:test', EVT.VAULT_SNAPSHOT);
      expect(result).toBeNull();
    });
  });

  describe('sendEvent', () => {
    it('sends timeline event successfully', async () => {
      const roomId = (await mockClient.createRoom({ name: 'test' })).room_id;
      // sendEvent doesn't return a value — verify via mock timeline
      await svcInstance.sendEvent(roomId, EVT.OP, { op: 'INS', target: 'test' });
      expect(mockClient._timeline.length).toBe(1);
      expect(mockClient._timeline[0].content.op).toBe('INS');
      expect(mockClient._timeline[0].content.target).toBe('test');
    });
  });

  describe('_isRoomEncrypted', () => {
    it('returns true for encrypted room', async () => {
      const roomId = await svcInstance.createRoom('Encrypted', 'topic');
      expect(svcInstance._isRoomEncrypted(roomId)).toBe(true);
    });

    it('defaults to true when room is unknown (safe assumption)', () => {
      expect(svcInstance._isRoomEncrypted('!unknown:test')).toBe(true);
    });
  });
});
