import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAppServiceHttpClient } from '../../src/substrate/appservice-client.js';

function jsonResponse(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('createAppServiceHttpClient', () => {
  it('requires homeserverUrl and asToken', () => {
    expect(() => createAppServiceHttpClient({ asToken: 't' })).toThrow(TypeError);
    expect(() => createAppServiceHttpClient({ homeserverUrl: 'https://x' })).toThrow(TypeError);
  });

  it('works against whatever homeserverUrl is supplied, not a fixed one', async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, {}));
    const client = createAppServiceHttpClient({ homeserverUrl: 'https://my-synapse.example.net', asToken: 'AS_TOKEN' });
    await client.register('@_site_bob:my-synapse.example.net');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://my-synapse.example.net/_matrix/client/v3/register',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer AS_TOKEN');
    expect(JSON.parse(init.body)).toEqual({ type: 'm.login.application_service', username: '_site_bob' });
  });

  it('treats M_USER_IN_USE on register as success (idempotent per the AS spec)', async () => {
    global.fetch.mockResolvedValue(jsonResponse(400, { errcode: 'M_USER_IN_USE' }));
    const client = createAppServiceHttpClient({ homeserverUrl: 'https://x', asToken: 't' });
    await expect(client.register('@_site_bob:x')).resolves.toBeUndefined();
  });

  it('throws on a genuine register failure', async () => {
    global.fetch.mockResolvedValue(jsonResponse(403, { errcode: 'M_FORBIDDEN', error: 'nope' }));
    const client = createAppServiceHttpClient({ homeserverUrl: 'https://x', asToken: 't' });
    await expect(client.register('@_site_bob:x')).rejects.toThrow(/M_FORBIDDEN/);
  });

  it('joinRoom impersonates the ghost via the user_id query parameter', async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, {}));
    const client = createAppServiceHttpClient({ homeserverUrl: 'https://x', asToken: 't' });
    await client.joinRoom('@_site_bob:x', '!room:x');
    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('/_matrix/client/v3/join/');
    expect(url).toContain('user_id=%40_site_bob%3Ax');
  });

  it('joinRoom throws on failure', async () => {
    global.fetch.mockResolvedValue(jsonResponse(404, { errcode: 'M_NOT_FOUND' }));
    const client = createAppServiceHttpClient({ homeserverUrl: 'https://x', asToken: 't' });
    await expect(client.joinRoom('@_site_bob:x', '!room:x')).rejects.toThrow(/M_NOT_FOUND/);
  });

  it('addCredentials attaches a password by impersonating the ghost', async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, {}));
    const client = createAppServiceHttpClient({ homeserverUrl: 'https://x', asToken: 't' });
    await client.addCredentials('@_site_bob:x', { password: 'hunter2' });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toContain('/_matrix/client/v3/account/password');
    expect(JSON.parse(init.body)).toMatchObject({ new_password: 'hunter2' });
  });

  it('refuses to fake an email claim, which needs an out-of-band validation session', async () => {
    const client = createAppServiceHttpClient({ homeserverUrl: 'https://x', asToken: 't' });
    await expect(client.addCredentials('@_site_bob:x', { email: 'bob@example.org' })).rejects.toThrow(
      /out-of-band/,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('addCredentials throws on failure', async () => {
    global.fetch.mockResolvedValue(jsonResponse(401, { errcode: 'M_UNAUTHORIZED' }));
    const client = createAppServiceHttpClient({ homeserverUrl: 'https://x', asToken: 't' });
    await expect(client.addCredentials('@_site_bob:x', { password: 'p' })).rejects.toThrow(/M_UNAUTHORIZED/);
  });
});
