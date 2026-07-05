// The renderer half of Part 5: instantiate the surfaces a validated AppSpec
// names, wired to their rooms via one log adapter, and turn each declared
// binding into a callable that appends a validated entry. The talker never
// reaches this file — it only ever produces the AppSpec that generate()
// consumes.

import { validateAppSpec } from './appspec.js';
import { validateBinding } from '../kernel/validate.js';

export function generate(spec, { log, now = () => new Date().toISOString() } = {}) {
  const { valid, errors, residue } = validateAppSpec(spec);
  if (!valid) {
    return { ok: false, errors, residue };
  }
  if (!log || typeof log.append !== 'function') {
    throw new TypeError('generate requires a log adapter (with an append method) to bind surfaces to');
  }

  const surfaces = spec.surfaces.map((surfaceSpec) => ({
    type: surfaceSpec.type,
    room: surfaceSpec.room,
    spec: surfaceSpec,
  }));

  const bindings = {};
  for (const bindingSpec of spec.bindings) {
    bindings[bindingSpec.on] = async (payload, agent) => {
      const target =
        typeof bindingSpec.emit.target === 'function' ? bindingSpec.emit.target(payload) : bindingSpec.emit.target;

      const provenance = {
        agent,
        mode_of_givenness: bindingSpec.provenance.mode_of_givenness,
        context: bindingSpec.provenance.context,
      };

      const validation = validateBinding({
        emit: { op: bindingSpec.emit.op, address: bindingSpec.emit.address },
        provenance,
      });
      if (!validation.valid) {
        return { ok: false, errors: validation.errors };
      }

      const entry = {
        rules_rev: spec.rules_rev,
        op: bindingSpec.emit.op,
        address: bindingSpec.emit.address,
        target,
        operand: payload ?? null,
        given: { mode_of_givenness: provenance.mode_of_givenness, context: provenance.context },
        grounding: bindingSpec.grounding ?? [],
        agent,
        timestamp: now(),
      };

      const result = await log.append(entry);
      return { ok: true, entry, result };
    };
  }

  return { ok: true, surfaces, bindings, spec };
}
