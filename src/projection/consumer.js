// Layer 4: the CQRS read projection (Part 3). Never serve public reads from
// Synapse — it falls over under load and cannot resolve EO notation to
// markup. A consumer tails the rooms (here, any kernel log adapter) and
// materializes a fast read model, filtered through the Layer 3
// publishability predicate, and stamped with the DAG head it was built
// from — the Meant-Graph made servable, provisional by the theorem (Part 1)
// and legible about exactly which log position it reflects.

import { canonicalHash } from '../kernel/canonical.js';
import { isPublishable } from '../substrate/publishability.js';

export function createProjectionConsumer({ log, policyRules = [] } = {}) {
  if (!log || typeof log.stream !== 'function') {
    throw new TypeError('createProjectionConsumer requires a log adapter with a stream() method');
  }

  const materialized = new Map(); // target -> latest publishable entry
  let lastSeenId = null;

  async function tail(sinceToken) {
    let seen = 0;
    let published = 0;
    for await (const item of log.stream(sinceToken)) {
      lastSeenId = item.id;
      seen++;
      if (isPublishable(item.entry, { redacted: item.entry.redacted, policyRules })) {
        materialized.set(item.entry.target, { ...item.entry, materializedFrom: item.id });
        published++;
      }
    }
    return { seen, published, lastSeenId };
  }

  async function read(target) {
    return materialized.get(target) ?? null;
  }

  async function readAll() {
    return Array.from(materialized.values());
  }

  async function snapshot() {
    const entries = await readAll();
    const graph = { entries };
    const hash = await canonicalHash(graph);
    return { ...graph, dagHead: lastSeenId, hash, projectionTime: new Date().toISOString() };
  }

  // Pushing a snapshot to a CDN is out of scope here — there is no real CDN
  // in this environment. `publish` hands the same {entries, dagHead, hash,
  // projectionTime} shape exportSingleFile/exportBundle expect in snapshot
  // mode to an injected `publisher` callback, so wiring a real edge push
  // later is a matter of supplying that callback, not reshaping this method.
  async function publish(publisher) {
    const payload = await snapshot();
    if (typeof publisher === 'function') {
      await publisher(payload);
    }
    return payload;
  }

  return { tail, read, readAll, snapshot, publish };
}
