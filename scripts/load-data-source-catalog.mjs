#!/usr/bin/env node
// Loads docs/data/public-api-catalog.json into a Table surface so the
// catalog is real, queryable data in the substrate rather than a reference
// file nobody's app can read. Backed by either a real Matrix room
// (MatrixLog, same client wiring as scripts/smoke-test-matrix.mjs — any
// homeserver, none hardcoded) or, for a local check, an in-memory log that
// prints a summary and discards itself when the process exits.
//
// Usage — save it into a real Matrix room:
//   EO_HOMESERVER_URL=https://matrix.example.org \
//   EO_USERNAME=alice EO_PASSWORD=hunter2 \
//   EO_ROOM_ID='!catalog:example.org' \
//     node scripts/load-data-source-catalog.mjs
//
// Usage — local dry run, no homeserver needed:
//   node scripts/load-data-source-catalog.mjs --dry-run

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { InMemoryLog } from '../src/kernel/log.js';
import { createTableSurface } from '../src/surfaces/table.js';
import { ingestCatalog } from '../src/data-sources/ingest.js';
import { searchCatalog } from '../src/data-sources/search.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(here, '../docs/data/public-api-catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

const provenance = {
  agent: process.env.EO_LOADER_AGENT ?? 'system:catalog-loader',
  mode_of_givenness: 'catalog-import',
  context: 'public-api-catalog',
};

async function buildLog() {
  const dryRun = process.argv.includes('--dry-run') || !process.env.EO_HOMESERVER_URL;
  if (dryRun) {
    console.log('EO_HOMESERVER_URL not set (or --dry-run passed) — running against an in-memory log only.');
    console.log('Nothing here persists once this process exits; set EO_HOMESERVER_URL + credentials + EO_ROOM_ID to actually save it.\n');
    return { log: new InMemoryLog(), client: null };
  }

  const { createMatrixClient, loginWithPassword, startAndAwaitSync } = await import('../src/substrate/client.js');
  const { adaptClientForLog } = await import('../src/substrate/real-client-adapter.js');
  const { MatrixLog } = await import('../src/substrate/matrix-log.js');

  const homeserverUrl = process.env.EO_HOMESERVER_URL;
  const roomId = process.env.EO_ROOM_ID;
  if (!roomId) {
    console.error('EO_ROOM_ID is required when EO_HOMESERVER_URL is set');
    process.exit(1);
  }

  let credentials;
  if (process.env.EO_ACCESS_TOKEN) {
    credentials = { homeserverUrl, accessToken: process.env.EO_ACCESS_TOKEN, userId: process.env.EO_USER_ID };
  } else {
    credentials = await loginWithPassword({
      homeserverUrl,
      username: process.env.EO_USERNAME,
      password: process.env.EO_PASSWORD,
    });
    console.log(`logged in as ${credentials.userId}`);
  }

  const client = createMatrixClient(credentials);
  console.log('starting client and waiting for initial sync...');
  await startAndAwaitSync(client, { timeoutMs: 60_000 });
  console.log(`synced. saving into room ${roomId}.\n`);

  return { log: new MatrixLog({ client: adaptClientForLog(client), roomId }), client };
}

async function main() {
  const { log, client } = await buildLog();
  const surface = createTableSurface({ log });

  const results = await ingestCatalog(catalog.sources, surface, provenance);
  const appended = results.filter((r) => r.appended).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.appended && !r.skipped);

  console.log(`${appended} appended, ${skipped} already loaded, ${failed.length} failed.`);
  for (const failure of failed) {
    console.error(`  FAILED ${failure.id}: ${failure.errors?.join('; ')}`);
  }

  const rows = await surface.read();
  const spaceRows = searchCatalog(rows, 'space');
  console.log(`\nsanity check — searching the loaded catalog for "space" finds: ${spaceRows.map((r) => r.operand.id).join(', ')}`);

  client?.stopClient();
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('catalog load errored:', err);
  process.exitCode = 1;
});
