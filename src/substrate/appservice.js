// Ghost-user provisioning (Part 3, Layer 2). An Application Service owns a
// namespace of ghost users (`@_site_*`), holds a registration token, and
// can mint ghosts, auto-join them to rooms, and intercept events in its
// namespace. This module is the correspondence: functions over an
// injected AS API client, so provisioning is testable without a live
// appservice.
//
// AS API client surface this module depends on. It is duck-typed, not
// matrix-js-sdk or an AS SDK — no such package is imported here — but it
// is shaped after the real Application Service HTTP API
// (https://spec.matrix.org/latest/application-service-api/) so a
// production build can inject a thin wrapper over that API with no change
// here:
//
//   asClient.register(userId) => Promise<void>
//     POST /_matrix/client/v3/register, type
//     "m.login.application_service". Provisions the ghost's account.
//     Idempotent per the spec: registering an already-registered user id
//     is a no-op, not an error.
//
//   asClient.joinRoom(userId, roomId) => Promise<void>
//     POST /_matrix/client/v3/join/{roomId}?user_id={userId}, using the AS
//     API's impersonation query parameter. Auto-joins the ghost to a room.
//
//   asClient.addCredentials(userId, credentials) => Promise<void>
//     Attaches an email or password to an *existing* account without
//     changing its user id — the claimable-account pattern (Layer 2:
//     "attaches an email or password without changing the user id, so
//     prior entries stay owned").

const GHOST_NAMESPACE_PREFIX = '_site_';
const LOCALPART_RE = /^[a-z0-9._=-]+$/;

export function mintGhostUserId(localpart, homeserverDomain) {
  if (!localpart || !LOCALPART_RE.test(localpart)) {
    throw new RangeError(
      `localpart must be non-empty and match ${LOCALPART_RE}, got ${JSON.stringify(localpart)}`,
    );
  }
  if (!homeserverDomain) {
    throw new RangeError('homeserverDomain is required');
  }
  return `@${GHOST_NAMESPACE_PREFIX}${localpart}:${homeserverDomain}`;
}

export function isGhostUserId(userId) {
  return typeof userId === 'string' && userId.startsWith(`@${GHOST_NAMESPACE_PREFIX}`);
}

// A real account is provisioned only on first interaction (Layer 2: "Do
// not mint a ghost for every anonymous reader ... A real account is
// provisioned only on first interaction"), so this is called from a
// surface's write path, not from a page view.
export async function provisionGhost(asClient, localpart, homeserverDomain) {
  const userId = mintGhostUserId(localpart, homeserverDomain);
  await asClient.register(userId);
  return userId;
}

export async function joinGhostToRoom(asClient, ghostUserId, roomId) {
  if (!isGhostUserId(ghostUserId)) {
    throw new RangeError(`${ghostUserId} is not in the ghost namespace (@${GHOST_NAMESPACE_PREFIX}*)`);
  }
  await asClient.joinRoom(ghostUserId, roomId);
  return { userId: ghostUserId, roomId };
}

// The claimable-account pattern: attach credentials to the ghost's
// existing user id rather than migrating its entries to a new one, so
// every entry the ghost already appended (event.sender is this user id)
// stays owned across the claim, and the account becomes portable.
export async function convertToUser(asClient, ghostUserId, credentials) {
  if (!isGhostUserId(ghostUserId)) {
    throw new RangeError(`${ghostUserId} is not in the ghost namespace (@${GHOST_NAMESPACE_PREFIX}*)`);
  }
  if (!credentials || (!credentials.email && !credentials.password)) {
    throw new TypeError('credentials must include an email or a password');
  }
  await asClient.addCredentials(ghostUserId, credentials);
  return { userId: ghostUserId, claimed: true };
}
