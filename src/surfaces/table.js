// Table: the database grid, the backbone (design doc Part 4, Tier 1: Table).
// Home terrain Entity, borrowing Kind. Adding a row is INS, editing a cell
// is DEF, changing the schema is REC. Grouping is a read-only SEG view, so
// it reshapes `read` and never appends — it is not a binding here.

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

export function createTableSurface({ log }) {
  const cache = { rows: [], pendingDrafts: [] };

  async function write(op, payload, provenance) {
    const { address, target, operand } = payload ?? {};
    const result = validateBinding({ emit: { op, address, target }, provenance });
    if (!result.valid) {
      cache.pendingDrafts.push({ op, address, target, operand, provenance, errors: result.errors });
      return { appended: false, errors: result.errors };
    }
    const entry = buildEntry(op, address, target, operand, provenance);
    const { id } = await log.append(entry);
    const row = { id, ...entry };
    cache.rows.push(row);
    return { appended: true, id, entry: row };
  }

  return {
    homeTerrain: 'Entity/Kind',

    async read(query = {}) {
      const filter = query.filter ?? (() => true);
      const rows = await log.slice(filter);
      cache.rows = rows.map(({ id, entry }) => ({ id, ...entry }));
      return cache.rows;
    },

    bindings: Object.freeze({
      addRow: (payload, provenance) => write('INS', payload, provenance),
      editCell: (payload, provenance) => write('DEF', payload, provenance),
      changeSchema: (payload, provenance) => write('REC', payload, provenance),
    }),

    // Fallback per Part 4: cached rows editable as pending drafts. Rows are
    // the last successful read/write; pendingDrafts are writes that failed
    // validation (or never got a chance to reach the log) and are held
    // locally rather than dropped.
    fallback() {
      return { rows: cache.rows, pendingDrafts: cache.pendingDrafts };
    },
  };
}

/**
 * Render (browser only, not exercised under Node/vitest — no DOM here).
 *
 * Mounts TanStack Table (imported via the app's import map, e.g.
 * `https://esm.sh/@tanstack/react-table`), or a canvas grid for large data,
 * over `surface.read()`'s rows. The grid's "add row" affordance calls
 * `surface.bindings.addRow`, a cell commit calls `surface.bindings.editCell`,
 * and a schema editor calls `surface.bindings.changeSchema` — each with a
 * provenance envelope from the ambient session. Grouping is local UI state
 * that re-calls `read`, never a binding. If the log is unreachable, renders
 * `surface.fallback()`'s rows as editable pending drafts instead of wedging.
 *
 * @param {ReturnType<typeof createTableSurface>} surface
 * @param {unknown} container - a DOM element in the browser
 */
export function render(surface, container) {
  throw new Error('render() is a browser-only stub; see the JSDoc above for the intended React mount.');
}
