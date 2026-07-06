// Turns docs/data/public-api-catalog.json's entries into real, queryable
// Table rows in the EO Substrate rather than leaving them sitting as a
// reference JSON file. Each catalog source becomes one INS entry: a new
// concrete instance entering existence (Part 1), addressed at Existence x
// Generating x Figure — INS is never the desert operator, so any Object
// value is safe, and Figure (a single distinguished instance) fits a single
// catalog record better than Ground (whole-context) or Pattern (a frame).
//
// This works against any kernel log adapter — InMemoryLog for a local/demo
// run, or a real MatrixLog (src/substrate/matrix-log.js) to actually save
// the catalog into a Matrix room, exactly like every other write path in
// this codebase. Nothing here is specific to one storage backend.

import { makeAddress } from '../kernel/address.js';
import { OPERATORS } from '../kernel/operators.js';

const OBJECT_FIGURE = 1;
const CATALOG_ADDRESS = makeAddress(OPERATORS.INS.mode, OPERATORS.INS.domain, OBJECT_FIGURE);

export const CATALOG_GROUNDING = ['doc:docs/data/public-api-catalog.json'];

// Converts one catalog source object to the { address, target, operand,
// grounding } shape src/surfaces/table.js's addRow binding expects.
export function catalogEntryToRow(source) {
  if (!source || !source.id) {
    throw new TypeError('catalog source is missing a required id');
  }
  return {
    address: CATALOG_ADDRESS,
    target: `catalog:${source.id}`,
    operand: source,
    grounding: CATALOG_GROUNDING,
  };
}

// Ingests every source into a Table surface (src/surfaces/table.js),
// skipping any source id that's already present so re-running this against
// a log that already has the catalog loaded doesn't duplicate rows. Returns
// a per-source outcome so a caller can tell what actually landed.
export async function ingestCatalog(sources, tableSurface, provenance) {
  if (!Array.isArray(sources)) {
    throw new TypeError('ingestCatalog requires an array of catalog sources');
  }
  if (!tableSurface || typeof tableSurface.bindings?.addRow !== 'function') {
    throw new TypeError('ingestCatalog requires a Table surface (createTableSurface(...)) to write into');
  }

  const existing = await tableSurface.read();
  const alreadyLoaded = new Set(existing.map((row) => row.target));

  const results = [];
  for (const source of sources) {
    const target = `catalog:${source.id}`;
    if (alreadyLoaded.has(target)) {
      results.push({ id: source.id, skipped: true, reason: 'already loaded' });
      continue;
    }
    const outcome = await tableSurface.bindings.addRow(catalogEntryToRow(source), provenance);
    results.push({ id: source.id, skipped: false, ...outcome });
  }
  return results;
}
