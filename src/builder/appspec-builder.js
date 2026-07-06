// The App Builder: a deterministic, human-driven stand-in for the talker
// (Part 7 defers proposeAppSpec to future work — see src/generator/talker.js).
// Instead of an LLM turning a prompt into an AppSpec, a person assembles one
// directly through a UI, one surface/binding at a time. The result still has
// to clear the exact same gate as any other AppSpec: `toAppSpec` never
// hand-waves a field, and `validateBuilderState` is nothing but
// `validateAppSpec` run against what `toAppSpec` produced — the builder gets
// no shortcut past the grounder.
//
// Pure, framework-free, DOM-free: every function here takes and returns
// plain data, so the whole flow (add a surface, add a binding, see the
// residue) is exercisable under plain Node, same as the rest of this repo.

import { RULES_REV, KNOWN_SURFACE_TYPES, validateAppSpec } from '../generator/appspec.js';
import { OPERATOR_CODES } from '../kernel/operators.js';
import { isLegalAddress } from '../kernel/address.js';

export { RULES_REV, KNOWN_SURFACE_TYPES, OPERATOR_CODES };

// Which extra fields a surface type needs beyond `type` and `room`, so a UI
// can render the right form without hardcoding a switch per surface.
const SURFACE_FIELD_REQUIREMENTS = Object.freeze({
  Table: Object.freeze(['class']),
  Chart: Object.freeze(['class']),
  Map: Object.freeze(['class']),
  Feed: Object.freeze(['class']),
  Form: Object.freeze(['class', 'operator', 'homeTerrain']),
  Board: Object.freeze(['class']),
  SocialFeed: Object.freeze(['class']),
  CRM: Object.freeze(['class']),
  Graph: Object.freeze(['class']),
  NewsSite: Object.freeze(['class']),
  Calendar: Object.freeze(['class']),
});

export function surfaceFieldRequirements(type) {
  return SURFACE_FIELD_REQUIREMENTS[type] ?? [];
}

export function createBuilderState() {
  return {
    site: { space_or_room: '', visibility: 'private', power_template: '' },
    surfaces: [],
    bindings: [],
  };
}

export function setSite(state, site) {
  return { ...state, site: { ...state.site, ...site } };
}

export function addSurface(state, surface) {
  return { ...state, surfaces: [...state.surfaces, { ...surface }] };
}

export function removeSurface(state, index) {
  return { ...state, surfaces: state.surfaces.filter((_, i) => i !== index) };
}

export function addBinding(state, binding) {
  return { ...state, bindings: [...state.bindings, { ...binding }] };
}

export function removeBinding(state, index) {
  return { ...state, bindings: state.bindings.filter((_, i) => i !== index) };
}

// Builds the AppSpec's `cells` array from the addresses actually used by its
// bindings, deduplicated — a builder-state convenience, not a design-doc
// concept: nothing here invents a cell no binding touches, and nothing
// suppresses a binding-touched cell just because it repeats.
function cellsFromBindings(bindings) {
  const seen = new Map();
  for (const binding of bindings) {
    const address = binding?.address;
    if (!isLegalAddress(address)) continue;
    const key = `${address.mode},${address.domain},${address.object}`;
    if (!seen.has(key)) seen.set(key, { address });
  }
  return [...seen.values()];
}

export function toAppSpec(state) {
  return {
    rules_rev: RULES_REV,
    site: { ...state.site },
    surfaces: state.surfaces.map((s) => ({ ...s })),
    cells: cellsFromBindings(state.bindings),
    bindings: state.bindings.map((b) => ({
      on: b.on,
      emit: {
        op: b.op,
        address: b.address,
        target: b.target,
      },
      provenance: { mode_of_givenness: b.mode_of_givenness, context: b.context },
      grounding: b.grounding ?? [],
    })),
  };
}

export function validateBuilderState(state) {
  const spec = toAppSpec(state);
  const { valid, errors, residue } = validateAppSpec(spec);
  return { valid, errors, residue, spec };
}
