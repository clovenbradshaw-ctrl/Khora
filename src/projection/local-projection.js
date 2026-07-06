// The client-side half of Layer 4's two materializations (Part 3): a
// logged-in editor reads from their own device, not the CDN projection
// (src/projection/consumer.js), which filters to publishable entries only
// for anonymous readers. A room member already has full access to
// everything in the room, so this tails a log adapter unfiltered and writes
// each entry, plus a folded Meant-Graph checkpoint, into an injected
// OPFS-shaped store — subsequent reads come from the store, not a
// recomputation over the log, which is where the "instant local reads and
// offline capability" comes from.

import { canonicalHash } from '../kernel/canonical.js';
import { assertOPFSStore } from './opfs-store.js';

export function createLocalProjection({ log, store }) {
  if (!log || typeof log.stream !== 'function') {
    throw new TypeError('createLocalProjection requires a log adapter with a stream() method');
  }
  assertOPFSStore(store);

  let lastSeenId = null;

  async function sync(sinceToken) {
    let count = 0;
    for await (const item of log.stream(sinceToken)) {
      lastSeenId = item.id;
      await store.writeEntry(item.id, item.entry);
      count++;
    }

    const entries = await store.listEntries();
    const graph = { entries: entries.map(({ entry }) => entry) };
    const hash = await canonicalHash(graph);
    const meantGraph = { ...graph, dagHead: lastSeenId, hash, foldedAt: new Date().toISOString() };
    await store.writeMeantGraph(meantGraph);

    return { count, lastSeenId, meantGraph };
  }

  async function read(id) {
    return store.readEntry(id);
  }

  async function readAll() {
    return store.listEntries();
  }

  async function readMeantGraph() {
    return store.readMeantGraph();
  }

  return { sync, read, readAll, readMeantGraph };
}
