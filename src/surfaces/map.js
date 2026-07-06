// Map: points and regions on geography (design doc Part 4, Tier 1: Map).
// Home terrain Field, borrowing Entity. Placing a marker is INS, drawing a
// boundary is SEG, connecting points is CON.

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

export function createMapSurface({ log }) {
  const cache = { features: [], pendingDrafts: [] };

  async function write(op, payload, provenance) {
    const { address, target, operand } = payload ?? {};
    const result = validateBinding({ emit: { op, address, target }, provenance });
    if (!result.valid) {
      cache.pendingDrafts.push({ op, address, target, operand, provenance, errors: result.errors });
      return { appended: false, errors: result.errors };
    }
    const entry = buildEntry(op, address, target, operand, provenance);
    const { id } = await log.append(entry);
    const feature = { id, ...entry };
    cache.features.push(feature);
    return { appended: true, id, entry: feature };
  }

  return {
    homeTerrain: 'Field/Entity',

    async read(query = {}) {
      const filter = query.filter ?? (() => true);
      const rows = await log.slice(filter);
      cache.features = rows.map(({ id, entry }) => ({ id, ...entry }));
      return cache.features;
    },

    bindings: Object.freeze({
      placeMarker: (payload, provenance) => write('INS', payload, provenance),
      drawBoundary: (payload, provenance) => write('SEG', payload, provenance),
      connectPoints: (payload, provenance) => write('CON', payload, provenance),
    }),

    // Fallback per Part 4: the last tile/marker cache. There are no raster
    // tiles inside the log, so "tile cache" here is the last-read feature
    // set (markers, boundaries, connections); pendingDrafts holds writes
    // the log rejected or couldn't be reached to receive.
    fallback() {
      return { features: cache.features, pendingDrafts: cache.pendingDrafts };
    },
  };
}

/**
 * Render (browser only, not exercised under Node/vitest — no DOM here).
 *
 * Mounts MapLibre GL (from esm.sh) with OpenStreetMap raster tiles, no key
 * required, or Leaflet. `surface.read()`'s features are drawn as layers: a
 * map click calls `surface.bindings.placeMarker`, a draw-tool boundary calls
 * `surface.bindings.drawBoundary`, and picking two existing points calls
 * `surface.bindings.connectPoints`. If tiles or the log are unreachable,
 * renders `surface.fallback()`'s last tile/marker cache instead of a blank
 * map.
 *
 * @param {ReturnType<typeof createMapSurface>} surface
 * @param {unknown} container - a DOM element in the browser
 */
export function render(surface, container) {
  throw new Error('render() is a browser-only stub; see the JSDoc above for the intended React mount.');
}
