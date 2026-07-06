// A real Application Service API client over fetch, implementing the
// asClient duck type appservice.js already depends on (register, joinRoom,
// addCredentials — see that file's header comment for the exact contract).
// homeserverUrl is always a parameter here too — any homeserver that grants
// this appservice's registration token works, none is assumed.
//
// Spec: https://spec.matrix.org/latest/application-service-api/

function localpartOf(userId) {
  const match = /^@([^:]+):/.exec(userId);
  if (!match) throw new RangeError(`not a valid Matrix user id: ${userId}`);
  return match[1];
}

async function asRequest(homeserverUrl, asToken, method, path, body) {
  const response = await fetch(`${homeserverUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${asToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

export function createAppServiceHttpClient({ homeserverUrl, asToken }) {
  if (!homeserverUrl) {
    throw new TypeError('createAppServiceHttpClient requires homeserverUrl (any homeserver base URL)');
  }
  if (!asToken) {
    throw new TypeError('createAppServiceHttpClient requires asToken (this appservice\'s registration token)');
  }

  return {
    // Idempotent per the AS spec: registering an already-registered user id
    // is a no-op here, not an error — M_USER_IN_USE is swallowed.
    async register(userId) {
      const { ok, payload } = await asRequest(homeserverUrl, asToken, 'POST', '/_matrix/client/v3/register', {
        type: 'm.login.application_service',
        username: localpartOf(userId),
      });
      if (!ok && payload.errcode !== 'M_USER_IN_USE') {
        throw new Error(`appservice register(${userId}) failed: ${payload.errcode ?? ''} ${payload.error ?? ''}`);
      }
    },

    async joinRoom(userId, roomId) {
      const path = `/_matrix/client/v3/join/${encodeURIComponent(roomId)}?user_id=${encodeURIComponent(userId)}`;
      const { ok, payload } = await asRequest(homeserverUrl, asToken, 'POST', path, {});
      if (!ok) {
        throw new Error(`appservice joinRoom(${userId}, ${roomId}) failed: ${payload.errcode ?? ''} ${payload.error ?? ''}`);
      }
    },

    // Password can be attached directly, impersonating the ghost via the
    // user_id query param. Email/3pid cannot: the spec requires an
    // out-of-band validation session (a token emailed to the address,
    // confirmed out of band, then submitted back) that has no synchronous
    // equivalent, so it's refused here rather than faked.
    async addCredentials(userId, credentials) {
      if (credentials.email && !credentials.password) {
        throw new Error(
          'addCredentials cannot attach an email synchronously — Matrix requires an out-of-band 3pid ' +
            'validation session (POST .../account/3pid/email/requestToken, then a confirmed sid). Attach a ' +
            'password here, and drive the email validation flow separately.',
        );
      }
      const path = `/_matrix/client/v3/account/password?user_id=${encodeURIComponent(userId)}`;
      const { ok, payload } = await asRequest(homeserverUrl, asToken, 'POST', path, {
        new_password: credentials.password,
        logout_devices: false,
      });
      if (!ok) {
        throw new Error(
          `appservice addCredentials(${userId}) failed: ${payload.errcode ?? ''} ${payload.error ?? ''}. ` +
            'Some homeservers require User-Interactive Auth here even for AS-impersonated requests; this client does not drive a UIA flow.',
        );
      }
    },
  };
}
