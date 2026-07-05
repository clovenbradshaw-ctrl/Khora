import { isLegalAddress } from './address.js';
import { OPERATORS, isOperatorCode } from './operators.js';

const OBJECT_GROUND = 0;

export { isLegalAddress };

// The desert cell: SYN by Ground. No verb meaning "synthesize a condition"
// appears anywhere in the ~32,000-verb corpus (Part 1, "The empirical
// ground"). The kernel treats this as a hard prohibition, not a gap to fill.
export function isDesert(address) {
  if (!isLegalAddress(address)) return false;
  return (
    address.mode === OPERATORS.SYN.mode &&
    address.domain === OPERATORS.SYN.domain &&
    address.object === OBJECT_GROUND
  );
}

// A binding is what a surface emits when a user action fires: an operator
// call plus the provenance envelope every Given-Log entry must carry
// (Part 3: agent, mode_of_givenness, context).
export function validateBinding(binding) {
  const errors = [];

  if (!binding || typeof binding !== 'object') {
    return { valid: false, errors: ['binding must be an object'] };
  }

  const emit = binding.emit;
  if (!emit || typeof emit !== 'object') {
    errors.push('binding.emit is required');
  } else {
    if (!isOperatorCode(emit.op)) {
      errors.push(`binding.emit.op is not a known operator: ${String(emit.op)}`);
    }
    if (!isLegalAddress(emit.address)) {
      errors.push('binding.emit.address is not a legal address');
    } else if (isDesert(emit.address)) {
      errors.push('binding.emit.address is the desert cell (SYN by Ground), which is prohibited');
    }
  }

  const provenance = binding.provenance;
  if (!provenance || typeof provenance !== 'object') {
    errors.push('binding.provenance is required');
  } else {
    if (!provenance.agent) errors.push('binding.provenance.agent is required');
    if (!provenance.mode_of_givenness) errors.push('binding.provenance.mode_of_givenness is required');
    if (!provenance.context) errors.push('binding.provenance.context is required');
  }

  return { valid: errors.length === 0, errors };
}

// The residue-test primitive (Part 1, "The epistemic spine"): given a
// described transformation split into segments, and the address assigned to
// each segment (or null/undefined if none was assigned), returns the
// segments that got no address. Empty means no residue. Underdetermination
// (multiple valid addresses fit one segment) and empty cells (an address
// with no occupying transformation) are not residue and are not what this
// checks — this only checks "did every segment get *an* address."
export function residue(description, addresses) {
  if (!Array.isArray(description) || !Array.isArray(addresses)) {
    throw new TypeError('residue requires description and addresses to be arrays');
  }
  if (description.length !== addresses.length) {
    throw new TypeError('residue requires description and addresses to be the same length');
  }
  return description
    .map((segment, i) => ({ segment, address: addresses[i] }))
    .filter(({ address }) => !isLegalAddress(address));
}
