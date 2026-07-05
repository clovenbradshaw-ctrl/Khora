// Feed: the chronological stream, the log made public-facing (design doc
// Part 4, Tier 1: Feed). Read is the room timeline; write is INS to post,
// CON to reply. The Tier 1 entry does not state a home terrain explicitly —
// the nearest named one is the Tier 2 "Social feed" entry's "Entity,
// borrowing Field for the stream," which this follows since a single Feed
// is that surface's one-timeline case without the follow graph (Network).

import { validateBinding } from '../kernel/validate.js';

function buildEntry(op, address, target, operand, provenance) {
  return {
    op,
    address,
    target,
    operand,
    given: {
      mode_of_givenness: provenance?.mode_of_givenness,
      context: provenance?.context,
    },
    agent: provenance?.agent,
  };
}

export function createFeedSurface({ log }) {
  const cache = { timeline: [], pendingDrafts: [] };

  async function write(op, payload, provenance) {
    const { address, target, operand } = payload ?? {};
    const result = validateBinding({ emit: { op, address, target }, provenance });
    if (!result.valid) {
      cache.pendingDrafts.push({ op, address, target, operand, provenance, errors: result.errors });
      return { appended: false, errors: result.errors };
    }
    const entry = buildEntry(op, address, target, operand, provenance);
    const { id } = await log.append(entry);
    const post = { id, ...entry };
    cache.timeline.push(post);
    return { appended: true, id, entry: post };
  }

  return {
    homeTerrain: 'Entity/Field',

    async read(query = {}) {
      const filter = query.filter ?? (() => true);
      const rows = await log.slice(filter);
      cache.timeline = rows.map(({ id, entry }) => ({ id, ...entry }));
      return cache.timeline;
    },

    bindings: Object.freeze({
      post: (payload, provenance) => write('INS', payload, provenance),
      reply: (payload, provenance) => write('CON', payload, provenance),
    }),

    // Fallback per Part 4: the cached timeline.
    fallback() {
      return { timeline: cache.timeline, pendingDrafts: cache.pendingDrafts };
    },
  };
}

/**
 * Render (browser only, not exercised under Node/vitest — no DOM here).
 *
 * Mounts a virtualized list (e.g. react-window, from esm.sh) over
 * `surface.read()`'s timeline. A composer calls `surface.bindings.post`; a
 * reply affordance under a timeline item calls `surface.bindings.reply`.
 * If the log is unreachable, renders `surface.fallback()`'s cached timeline
 * instead of an empty feed.
 *
 * @param {ReturnType<typeof createFeedSurface>} surface
 * @param {unknown} container - a DOM element in the browser
 */
export function render(surface, container) {
  throw new Error('render() is a browser-only stub; see the JSDoc above for the intended React mount.');
}
