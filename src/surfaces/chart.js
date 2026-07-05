// Chart: a read-only projection, never a write surface (design doc Part 4,
// Tier 1: Chart), which makes it the safest to ship. Home terrain Kind. A
// selection can drive a filter — a SEG view — but it appends nothing, so
// this module exposes no write path at all.

export function createChartSurface({ log }) {
  const cache = { snapshot: [], asOf: null };

  return {
    homeTerrain: 'Kind',

    // Read is an aggregation over the log (Part 4), not a row projection.
    // `query.groupBy` picks the bucket key (defaults to `entry.target`);
    // `query.filter` narrows which entries are aggregated at all.
    async read(query = {}) {
      const filter = query.filter ?? (() => true);
      const groupBy = query.groupBy ?? ((entry) => entry.target);
      const rows = await log.slice(filter);
      const buckets = new Map();
      for (const { entry } of rows) {
        const key = groupBy(entry);
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
      cache.snapshot = Array.from(buckets, ([key, count]) => ({ key, count }));
      cache.asOf = new Date().toISOString();
      return cache.snapshot;
    },

    // No bindings, by design: Chart never appends to the log.
    bindings: Object.freeze({}),

    // Fallback per Part 4: a cached snapshot with a staleness note.
    fallback() {
      return {
        snapshot: cache.snapshot,
        asOf: cache.asOf,
        stale: true,
        note: cache.asOf
          ? `cached aggregation as of ${cache.asOf}; may be stale`
          : 'no cached aggregation available yet',
      };
    },
  };
}

/**
 * Render (browser only, not exercised under Node/vitest — no DOM here).
 *
 * Mounts Observable Plot or Recharts (from esm.sh) over `surface.read()`'s
 * aggregation. A brush/selection narrows the view by re-calling `read` with
 * a `filter` or `groupBy` — it never calls a binding, because
 * `surface.bindings` is intentionally empty. If the log is unreachable,
 * renders `surface.fallback()`'s cached snapshot with its staleness note
 * visible rather than an empty chart.
 *
 * @param {ReturnType<typeof createChartSurface>} surface
 * @param {unknown} container - a DOM element in the browser
 */
export function render(surface, container) {
  throw new Error('render() is a browser-only stub; see the JSDoc above for the intended React mount.');
}
