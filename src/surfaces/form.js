// Form: the intake surface (design doc Part 4, Tier 1: Form). Home terrain
// is whatever it targets, and its single write operator (INS or DEF) is
// bound at spec-creation time — so both are constructor config here, not
// fixed by this module.

import { validateBinding } from '../kernel/validate.js';

const CONFIGURABLE_OPS = new Set(['INS', 'DEF']);

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

export function createFormSurface({ log, operator, homeTerrain }) {
  if (!CONFIGURABLE_OPS.has(operator)) {
    throw new RangeError(`Form surface operator must be INS or DEF, got ${String(operator)}`);
  }
  if (!homeTerrain) {
    throw new RangeError('Form surface requires homeTerrain (it targets whatever the spec names)');
  }

  const cache = { submissions: [], pendingDrafts: [] };

  return {
    homeTerrain,

    async read(query = {}) {
      const filter = query.filter ?? (() => true);
      const rows = await log.slice(filter);
      cache.submissions = rows.map(({ id, entry }) => ({ id, ...entry }));
      return cache.submissions;
    },

    bindings: Object.freeze({
      submit: async (payload, provenance) => {
        const { address, target, operand } = payload ?? {};
        const result = validateBinding({ emit: { op: operator, address, target }, provenance });
        if (!result.valid) {
          cache.pendingDrafts.push({ op: operator, address, target, operand, provenance, errors: result.errors });
          return { appended: false, errors: result.errors };
        }
        const entry = buildEntry(operator, address, target, operand, provenance);
        const { id } = await log.append(entry);
        const submission = { id, ...entry };
        cache.submissions.push(submission);
        return { appended: true, id, entry: submission };
      },
    }),

    // Fallback per Part 4: a failed submit held as a pending draft.
    fallback() {
      return { submissions: cache.submissions, pendingDrafts: cache.pendingDrafts };
    },
  };
}

/**
 * Render (browser only, not exercised under Node/vitest — no DOM here).
 *
 * Mounts a schema-driven form (react-jsonschema-form or ui-schema, from
 * esm.sh) built from the spec's JSON Schema. On submit, calls
 * `surface.bindings.submit(formData, provenance)`. On rejection — a
 * validation failure or a network-down append — the submission is not
 * lost: it is already sitting in `surface.fallback().pendingDrafts` for the
 * form to re-render as a locally-held draft with a retry affordance.
 *
 * @param {ReturnType<typeof createFormSurface>} surface
 * @param {unknown} container - a DOM element in the browser
 */
export function render(surface, container) {
  throw new Error('render() is a browser-only stub; see the JSDoc above for the intended React mount.');
}
