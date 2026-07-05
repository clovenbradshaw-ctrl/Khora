import { describe, it, expect } from 'vitest';
import {
  mintGhostUserId,
  isGhostUserId,
  provisionGhost,
  joinGhostToRoom,
  convertToUser,
} from '../../src/substrate/appservice.js';

// A hand-written fake standing in for the Application Service HTTP API
// client documented at the top of appservice.js.
function makeFakeAsClient() {
  return {
    registered: [],
    joined: [],
    credentialed: [],
    async register(userId) {
      this.registered.push(userId);
    },
    async joinRoom(userId, roomId) {
      this.joined.push({ userId, roomId });
    },
    async addCredentials(userId, credentials) {
      this.credentialed.push({ userId, credentials });
    },
  };
}

describe('mintGhostUserId', () => {
  it('mints an id under the @_site_ namespace', () => {
    const id = mintGhostUserId('reader-42', 'example.org');
    expect(id).toBe('@_site_reader-42:example.org');
    expect(isGhostUserId(id)).toBe(true);
  });

  it('rejects an empty or illegal localpart', () => {
    expect(() => mintGhostUserId('', 'example.org')).toThrow();
    expect(() => mintGhostUserId('Has Spaces', 'example.org')).toThrow();
  });

  it('requires a homeserver domain', () => {
    expect(() => mintGhostUserId('reader-42', '')).toThrow();
  });

  it('isGhostUserId is false for an ordinary user id', () => {
    expect(isGhostUserId('@alice:example.org')).toBe(false);
  });
});

describe('provisionGhost', () => {
  it('registers a ghost with the appservice and returns its user id', async () => {
    const asClient = makeFakeAsClient();
    const userId = await provisionGhost(asClient, 'reader-42', 'example.org');
    expect(userId).toBe('@_site_reader-42:example.org');
    expect(asClient.registered).toEqual([userId]);
  });
});

describe('joinGhostToRoom', () => {
  it('auto-joins a provisioned ghost into a room', async () => {
    const asClient = makeFakeAsClient();
    const userId = await provisionGhost(asClient, 'reader-42', 'example.org');
    const result = await joinGhostToRoom(asClient, userId, '!room:example.org');

    expect(result).toEqual({ userId, roomId: '!room:example.org' });
    expect(asClient.joined).toEqual([{ userId, roomId: '!room:example.org' }]);
  });

  it('refuses to join a non-ghost user id', async () => {
    const asClient = makeFakeAsClient();
    await expect(joinGhostToRoom(asClient, '@alice:example.org', '!room:example.org')).rejects.toThrow();
    expect(asClient.joined).toEqual([]);
  });
});

describe('convertToUser', () => {
  it('attaches credentials without changing the user id, so prior entries stay owned', async () => {
    const asClient = makeFakeAsClient();
    const userId = await provisionGhost(asClient, 'reader-42', 'example.org');
    const result = await convertToUser(asClient, userId, { email: 'reader@example.com' });

    expect(result.userId).toBe(userId);
    expect(result.claimed).toBe(true);
    expect(asClient.credentialed).toEqual([{ userId, credentials: { email: 'reader@example.com' } }]);
  });

  it('accepts a password credential in place of an email', async () => {
    const asClient = makeFakeAsClient();
    const userId = await provisionGhost(asClient, 'reader-7', 'example.org');
    const result = await convertToUser(asClient, userId, { password: 'hunter2' });
    expect(result.claimed).toBe(true);
  });

  it('rejects converting a non-ghost user id', async () => {
    const asClient = makeFakeAsClient();
    await expect(convertToUser(asClient, '@alice:example.org', { email: 'x@example.com' })).rejects.toThrow();
  });

  it('requires an email or a password', async () => {
    const asClient = makeFakeAsClient();
    const userId = await provisionGhost(asClient, 'reader-42', 'example.org');
    await expect(convertToUser(asClient, userId, {})).rejects.toThrow();
  });
});
