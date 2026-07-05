// Small pieces every Tier 2 controller needs, factored out so the flag
// gate, validate, append order can't drift between the six surfaces. Not a
// framework: each controller still builds its own address and payload, this
// just does the mechanical part.

import { validateBinding } from '../../kernel/validate.js';
import { isEnabled } from './flags.js';

// Object axis (Part 1: "Object: Ground, Figure, Pattern"). A single
// distinguished instance (a card, a post, a contact) is Figure. A change to
// the frame itself — REC always, and a SYN cluster — is Pattern. Ground is
// left for whole-context reads; no Tier 2 write here targets it directly,
// and SYN can never target it at all (the desert cell).
export const OBJECT_GROUND = 0;
export const OBJECT_FIGURE = 1;
export const OBJECT_PATTERN = 2;

// Gate on the flag, then build+validate+append a binding. Returns a result
// object rather than throwing, so a disabled or invalid write is a normal
// value a controller's caller can inspect, not an exception.
export async function gatedWrite({ log, flag, op, address, target, operand = null, provenance }) {
  if (!isEnabled(flag)) {
    return { ok: false, reason: 'disabled', flag };
  }

  const binding = { emit: { op, address }, provenance, target, operand };
  const { valid, errors } = validateBinding(binding);
  if (!valid) {
    return { ok: false, reason: 'invalid', errors };
  }

  const appended = await log.append(binding);
  return { ok: true, reason: 'appended', entry: binding, ...appended };
}

// Composition helper for Tier 2 surfaces that delegate a write through to an
// injected Tier 1 (or other Tier 2) controller's own binding, e.g. CRM
// calling into a table controller to create a contact row. The composing
// surface's own flag still gates the call — an injected controller with no
// flag of its own must not become a backdoor around the Tier 2 gate.
export async function delegateGated({ flag, controller, bindingName, payload, provenance }) {
  if (!isEnabled(flag)) {
    return { ok: false, reason: 'disabled', flag };
  }

  const binding = controller && controller.bindings && controller.bindings[bindingName];
  if (typeof binding !== 'function') {
    return { ok: false, reason: 'not-wired', bindingName };
  }

  return binding(payload, provenance);
}
