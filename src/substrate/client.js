// A real matrix-js-sdk client factory. Nothing here hardcodes a homeserver —
// `homeserverUrl` is always a caller-supplied parameter, so this connects to
// any Matrix homeserver (a self-hosted Synapse, matrix.org, any other
// implementation of the spec) the caller points it at, not one this repo
// assumes.
//
// This is the piece the rest of src/substrate/ was deliberately written
// against a duck type instead of importing directly (see matrix-log.js's
// header comment) — that duck type is satisfied by the real MatrixClient
// once its events are adapted to plain fields, which
// real-client-adapter.js does.

import { createClient as sdkCreateClient } from 'matrix-js-sdk';

export function createMatrixClient({ homeserverUrl, accessToken, userId, deviceId }) {
  if (!homeserverUrl) {
    throw new TypeError('createMatrixClient requires homeserverUrl (any homeserver base URL)');
  }
  if (!accessToken || !userId) {
    throw new TypeError('createMatrixClient requires accessToken and userId — use loginWithPassword to obtain them');
  }
  return sdkCreateClient({ baseUrl: homeserverUrl, accessToken, userId, deviceId });
}

// Exchanges a username/password for the credentials createMatrixClient
// needs, against whatever homeserver is named. Uses a short-lived
// unauthenticated client only to perform the login call.
export async function loginWithPassword({ homeserverUrl, username, password, deviceId }) {
  if (!homeserverUrl) {
    throw new TypeError('loginWithPassword requires homeserverUrl (any homeserver base URL)');
  }
  if (!username || !password) {
    throw new TypeError('loginWithPassword requires username and password');
  }
  const anonymousClient = sdkCreateClient({ baseUrl: homeserverUrl });
  const response = await anonymousClient.loginWithPassword(username, password);
  return {
    homeserverUrl,
    accessToken: response.access_token,
    userId: response.user_id,
    deviceId: deviceId ?? response.device_id,
  };
}

// MatrixLog reads room state synchronously (client.getRoom(roomId)), which
// only reflects what /sync has already delivered — a freshly created client
// has nothing until it syncs at least once. This starts the client and
// resolves once the first sync lands (or rejects on timeout), so a caller
// doesn't have to hand-roll the ClientEvent.Sync listener every time.
export function startAndAwaitSync(client, { timeoutMs = 30_000 } = {}) {
  // The listener must be attached before startClient() is called, not
  // after it resolves — startClient() only kicks off the sync loop, and a
  // fast first sync could otherwise fire before anything is listening.
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.removeListener('sync', onSync);
      reject(new Error(`matrix client did not reach PREPARED sync state within ${timeoutMs}ms`));
    }, timeoutMs);

    function onSync(state) {
      if (state === 'PREPARED') {
        clearTimeout(timer);
        client.removeListener('sync', onSync);
        resolve(client);
      } else if (state === 'ERROR') {
        clearTimeout(timer);
        client.removeListener('sync', onSync);
        reject(new Error('matrix client sync failed'));
      }
    }

    client.on('sync', onSync);
    client.startClient({ initialSyncLimit: 20 }).catch((err) => {
      clearTimeout(timer);
      client.removeListener('sync', onSync);
      reject(err);
    });
  });
}
