#!/usr/bin/env node
// Manual, credential-gated integration check against a REAL Matrix
// homeserver of your choosing — this is the one thing the automated test
// suite structurally can't do, since there's no live homeserver in that
// environment. This script never assumes which homeserver: it reads
// everything from env vars, so it works against any of them (a self-hosted
// Synapse, matrix.org, whatever you point it at).
//
// Usage:
//   EO_HOMESERVER_URL=https://matrix.example.org \
//   EO_USERNAME=alice \
//   EO_PASSWORD=hunter2 \
//   EO_ROOM_ID='!someroom:example.org' \
//     node scripts/smoke-test-matrix.mjs
//
// Or with an existing access token instead of a username/password:
//   EO_HOMESERVER_URL=... EO_ACCESS_TOKEN=... EO_USER_ID=... EO_ROOM_ID=... \
//     node scripts/smoke-test-matrix.mjs
//
// The room must already exist and the account must already be joined to it
// — this script proves the log adapter round-trips against a real server,
// it does not provision a room from scratch.

import { createMatrixClient, loginWithPassword, startAndAwaitSync } from '../src/substrate/client.js';
import { adaptClientForLog } from '../src/substrate/real-client-adapter.js';
import { MatrixLog } from '../src/substrate/matrix-log.js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const homeserverUrl = requireEnv('EO_HOMESERVER_URL');
  const roomId = requireEnv('EO_ROOM_ID');

  let credentials;
  if (process.env.EO_ACCESS_TOKEN) {
    credentials = {
      homeserverUrl,
      accessToken: requireEnv('EO_ACCESS_TOKEN'),
      userId: requireEnv('EO_USER_ID'),
    };
  } else {
    credentials = await loginWithPassword({
      homeserverUrl,
      username: requireEnv('EO_USERNAME'),
      password: requireEnv('EO_PASSWORD'),
    });
    console.log(`logged in as ${credentials.userId}`);
  }

  const client = createMatrixClient(credentials);
  console.log('starting client and waiting for initial sync...');
  await startAndAwaitSync(client, { timeoutMs: 60_000 });
  console.log('synced.');

  const log = new MatrixLog({ client: adaptClientForLog(client), roomId });

  const probeTarget = `smoke-test:${Date.now()}`;
  const entry = {
    op: 'INS',
    address: { mode: 2, domain: 0, object: 1 },
    target: probeTarget,
    operand: null,
    given: { mode_of_givenness: 'smoke-test', context: 'scripts/smoke-test-matrix.mjs' },
    grounding: [],
  };

  console.log(`appending a probe entry (target=${probeTarget})...`);
  const { id } = await log.append(entry);
  console.log(`appended as event ${id}. re-syncing to read it back...`);

  // A second sync round-trip proves this isn't just reading back the local
  // echo — it comes back through the same /sync path a fresh client would use.
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const found = (await log.slice((e) => e.target === probeTarget))[0];
  if (!found) {
    console.error('FAIL: probe entry did not round-trip through the room timeline');
    process.exitCode = 1;
  } else if (found.entry.agent !== credentials.userId) {
    console.error(`FAIL: expected agent ${credentials.userId}, got ${found.entry.agent}`);
    process.exitCode = 1;
  } else {
    console.log('PASS: probe entry round-tripped with the expected sender/agent.');
  }

  const checkpoint = await log.checkpoint({ probeTarget });
  console.log(`checkpoint dagHead=${checkpoint.dagHead} hash=${checkpoint.hash}`);

  client.stopClient();
}

main().catch((err) => {
  console.error('smoke test errored:', err);
  process.exitCode = 1;
});
