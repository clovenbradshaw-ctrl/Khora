// The AppSpec is what the talker emits: a JSON construal of an app, never
// app logic (Part 5). validateAppSpec is the grounder's gate — a spec that
// fails is returned with its residue, not silently repaired.

import { isLegalAddress } from '../kernel/address.js';
import { isDesert } from '../kernel/validate.js';
import { isOperatorCode } from '../kernel/operators.js';

export const RULES_REV = '2026-07-05.a';

// Tier 1 (src/surfaces/*.js) and Tier 2 (src/surfaces/tier2/*.js), per
// Part 4. Tier 3 (Document reader) is deliberately absent — the doc defers
// it "because the substrate has to be proven under lighter surfaces first",
// so an AppSpec naming it is rejected as an unknown surface type, same as
// any other typo.
export const KNOWN_SURFACE_TYPES = Object.freeze([
  'Table',
  'Chart',
  'Map',
  'Feed',
  'Form',
  'Board',
  'SocialFeed',
  'CRM',
  'Graph',
  'NewsSite',
  'Calendar',
]);

function pushResidue(residue, path, reason) {
  residue.push({ path, reason });
}

export function validateAppSpec(spec) {
  const errors = [];
  const residue = [];

  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['AppSpec must be an object'], residue: [{ path: '$', reason: 'not an object' }] };
  }

  if (spec.rules_rev !== RULES_REV) {
    errors.push(`AppSpec.rules_rev must be stamped as "${RULES_REV}", got ${JSON.stringify(spec.rules_rev)}`);
    pushResidue(residue, 'rules_rev', 'missing or stale stamp');
  }

  if (!spec.site || typeof spec.site !== 'object') {
    errors.push('AppSpec.site is required');
    pushResidue(residue, 'site', 'missing');
  } else {
    if (!spec.site.space_or_room) {
      errors.push('AppSpec.site.space_or_room is required');
      pushResidue(residue, 'site.space_or_room', 'missing');
    }
    if (spec.site.visibility !== 'public' && spec.site.visibility !== 'private') {
      errors.push('AppSpec.site.visibility must be "public" or "private"');
      pushResidue(residue, 'site.visibility', 'not public/private');
    }
    if (!spec.site.power_template) {
      errors.push('AppSpec.site.power_template is required');
      pushResidue(residue, 'site.power_template', 'missing');
    }
  }

  if (!Array.isArray(spec.surfaces) || spec.surfaces.length === 0) {
    errors.push('AppSpec.surfaces must be a non-empty array');
    pushResidue(residue, 'surfaces', 'missing or empty');
  } else {
    spec.surfaces.forEach((surface, i) => {
      if (!surface || typeof surface !== 'object') {
        errors.push(`AppSpec.surfaces[${i}] must be an object`);
        pushResidue(residue, `surfaces[${i}]`, 'not an object');
        return;
      }
      if (!KNOWN_SURFACE_TYPES.includes(surface.type)) {
        errors.push(`AppSpec.surfaces[${i}].type is not a known surface: ${surface.type}`);
        pushResidue(residue, `surfaces[${i}].type`, `unknown surface type: ${surface.type}`);
      }
      if (!surface.room) {
        errors.push(`AppSpec.surfaces[${i}].room is required`);
        pushResidue(residue, `surfaces[${i}].room`, 'missing');
      }
    });
  }

  if (!Array.isArray(spec.cells)) {
    errors.push('AppSpec.cells must be an array');
    pushResidue(residue, 'cells', 'missing');
  } else {
    spec.cells.forEach((cell, i) => {
      if (!cell || !isLegalAddress(cell.address)) {
        errors.push(`AppSpec.cells[${i}].address is not a legal address`);
        pushResidue(residue, `cells[${i}].address`, 'illegal or missing');
      } else if (isDesert(cell.address)) {
        errors.push(`AppSpec.cells[${i}].address is the desert cell (SYN by Ground), which is prohibited`);
        pushResidue(residue, `cells[${i}].address`, 'desert cell');
      }
    });
  }

  if (!Array.isArray(spec.bindings)) {
    errors.push('AppSpec.bindings must be an array');
    pushResidue(residue, 'bindings', 'missing');
  } else {
    spec.bindings.forEach((binding, i) => {
      if (!binding || typeof binding !== 'object' || !binding.on) {
        errors.push(`AppSpec.bindings[${i}].on is required`);
        pushResidue(residue, `bindings[${i}].on`, 'missing UI event name');
        return;
      }
      const emit = binding.emit;
      if (!emit || !isOperatorCode(emit.op)) {
        errors.push(`AppSpec.bindings[${i}].emit.op is not a known operator`);
        pushResidue(residue, `bindings[${i}].emit.op`, 'unknown operator');
      }
      if (!emit || !isLegalAddress(emit.address)) {
        errors.push(`AppSpec.bindings[${i}].emit.address is not a legal address`);
        pushResidue(residue, `bindings[${i}].emit.address`, 'illegal or missing');
      } else if (isDesert(emit.address)) {
        errors.push(`AppSpec.bindings[${i}].emit.address is the desert cell, which is prohibited`);
        pushResidue(residue, `bindings[${i}].emit.address`, 'desert cell');
      }
      if (!emit || !emit.target) {
        errors.push(`AppSpec.bindings[${i}].emit.target is required`);
        pushResidue(residue, `bindings[${i}].emit.target`, 'missing');
      }
      // The AppSpec can't know the acting agent ahead of time — that's
      // filled in when the binding actually fires — but every entry must
      // still carry a provenance envelope, so the spec pre-declares how
      // mode_of_givenness and context are derived for this binding.
      if (!binding.provenance || !binding.provenance.mode_of_givenness || !binding.provenance.context) {
        errors.push(`AppSpec.bindings[${i}].provenance must declare mode_of_givenness and context`);
        pushResidue(residue, `bindings[${i}].provenance`, 'incomplete provenance template');
      }
    });
  }

  return { valid: errors.length === 0, errors, residue };
}
