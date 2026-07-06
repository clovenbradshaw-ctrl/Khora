import { describe, it, expect, vi, beforeEach } from 'vitest';

const loginWithPasswordMock = vi.fn();
const createClientMock = vi.fn(() => ({ loginWithPassword: loginWithPasswordMock }));

vi.mock('matrix-js-sdk', () => ({
  createClient: (...args) => createClientMock(...args),
}));

// Imported after the mock so client.js picks up the mocked module.
const { createMatrixClient, loginWithPassword, startAndAwaitSync } = await import('../../src/substrate/client.js');

beforeEach(() => {
  createClientMock.mockClear();
  loginWithPasswordMock.mockClear();
});

describe('createMatrixClient', () => {
  it('requires homeserverUrl', () => {
    expect(() => createMatrixClient({ accessToken: 't', userId: '@a:x' })).toThrow(TypeError);
  });

  it('requires accessToken and userId', () => {
    expect(() => createMatrixClient({ homeserverUrl: 'https://matrix.example.org' })).toThrow(TypeError);
  });

  it('passes an arbitrary homeserverUrl straight through — no server is hardcoded', () => {
    createMatrixClient({
      homeserverUrl: 'https://my-own-synapse.example.net',
      accessToken: 'tok',
      userId: '@me:my-own-synapse.example.net',
      deviceId: 'DEV1',
    });
    expect(createClientMock).toHaveBeenCalledWith({
      baseUrl: 'https://my-own-synapse.example.net',
      accessToken: 'tok',
      userId: '@me:my-own-synapse.example.net',
      deviceId: 'DEV1',
    });
  });
});

describe('loginWithPassword', () => {
  it('requires homeserverUrl, username, and password', async () => {
    await expect(loginWithPassword({ username: 'a', password: 'b' })).rejects.toThrow(TypeError);
    await expect(loginWithPassword({ homeserverUrl: 'https://x', password: 'b' })).rejects.toThrow(TypeError);
  });

  it('exchanges credentials against whatever homeserver is named, with no hardcoded server', async () => {
    loginWithPasswordMock.mockResolvedValue({
      access_token: 'AT',
      user_id: '@alice:example.org',
      device_id: 'DEVICE1',
    });

    const creds = await loginWithPassword({
      homeserverUrl: 'https://example.org',
      username: 'alice',
      password: 'hunter2',
    });

    expect(createClientMock).toHaveBeenCalledWith({ baseUrl: 'https://example.org' });
    expect(loginWithPasswordMock).toHaveBeenCalledWith('alice', 'hunter2');
    expect(creds).toEqual({
      homeserverUrl: 'https://example.org',
      accessToken: 'AT',
      userId: '@alice:example.org',
      deviceId: 'DEVICE1',
    });
  });

  it('lets the caller pin a deviceId instead of accepting the server-issued one', async () => {
    loginWithPasswordMock.mockResolvedValue({ access_token: 'AT', user_id: '@a:x', device_id: 'SERVER-ISSUED' });
    const creds = await loginWithPassword({
      homeserverUrl: 'https://x',
      username: 'a',
      password: 'b',
      deviceId: 'PINNED',
    });
    expect(creds.deviceId).toBe('PINNED');
  });
});

describe('startAndAwaitSync', () => {
  function makeFakeSyncingClient() {
    const listeners = new Set();
    return {
      startClient: vi.fn(async () => {}),
      on(event, handler) {
        if (event === 'sync') listeners.add(handler);
      },
      removeListener(event, handler) {
        if (event === 'sync') listeners.delete(handler);
      },
      emitSync(state) {
        for (const handler of listeners) handler(state);
      },
    };
  }

  it('resolves once sync reaches PREPARED', async () => {
    const client = makeFakeSyncingClient();
    const promise = startAndAwaitSync(client, { timeoutMs: 1000 });
    client.emitSync('SYNCING');
    client.emitSync('PREPARED');
    await expect(promise).resolves.toBe(client);
    expect(client.startClient).toHaveBeenCalledWith({ initialSyncLimit: 20 });
  });

  it('rejects if sync reaches ERROR', async () => {
    const client = makeFakeSyncingClient();
    const promise = startAndAwaitSync(client, { timeoutMs: 1000 });
    client.emitSync('ERROR');
    await expect(promise).rejects.toThrow(/sync failed/);
  });

  it('rejects on timeout if sync never lands', async () => {
    const client = makeFakeSyncingClient();
    await expect(startAndAwaitSync(client, { timeoutMs: 20 })).rejects.toThrow(/did not reach PREPARED/);
  });
});
