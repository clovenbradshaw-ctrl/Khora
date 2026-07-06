// Pure entry <-> Matrix event content mapping (Part 3, Layer 1). No client
// dependency here — this is the correspondence, not the transport. A
// homeserver's DAG supplies the entry id, signature, agent, and timestamp;
// this module only ever handles the `social.hyphae.eo.entry` content shape
// and the kernel entry it stands for.

import { isLegalAddress, faceOf, recover } from '../kernel/address.js';
import { isDesert } from '../kernel/validate.js';
import { isOperatorCode } from '../kernel/operators.js';

export const RULES_REV = '2026-07-05.a';
export const EO_ENTRY_EVENT_TYPE = 'social.hyphae.eo.entry';

const FACES = Object.freeze(['act', 'site', 'resolution']);

// The event content carries all three face projections of the address (see
// the Part 3 code block), not the raw {mode,domain,object} triple, because
// that is the shape a room-timeline reader can resolve without importing
// the kernel's address module. The three tuples are redundant with each
// other by construction (act+site alone already fix mode, domain, and
// object), which is exploited below to detect a tampered/corrupt event.
function addressToContentAddress(address) {
  const out = {};
  for (const face of FACES) {
    const { a, b } = faceOf(address, face);
    out[face] = [a, b];
  }
  return out;
}

function contentAddressToAddress(contentAddress) {
  if (!contentAddress || !Array.isArray(contentAddress.act) || !Array.isArray(contentAddress.site)) {
    throw new TypeError('event content.address must carry act and site face tuples');
  }
  const [mode, domain] = contentAddress.act;
  const [, object] = contentAddress.site;
  // recover() runs the full address through makeAddress, so an out-of-range
  // axis throws here rather than mapping silently.
  const address = recover({ face: 'act', a: mode, b: domain, droppedAxis: 'object' }, object);

  if (Array.isArray(contentAddress.resolution)) {
    const [resolvedMode, resolvedObject] = contentAddress.resolution;
    if (resolvedMode !== address.mode || resolvedObject !== address.object) {
      throw new RangeError('event content.address.resolution is inconsistent with its act/site tuples');
    }
  }

  return address;
}

function requireGiven(given, sourceLabel) {
  if (!given || !given.mode_of_givenness || !given.context) {
    throw new TypeError(`${sourceLabel}.given.mode_of_givenness and .context are required`);
  }
  return { mode_of_givenness: given.mode_of_givenness, context: given.context };
}

// Maps a kernel entry to the social.hyphae.eo.entry content shape (Part 3).
// A desert or illegal address is rejected here rather than mapped out —
// the room DAG is append-only, so a bad address written to it cannot be
// un-written, only redacted.
export function entryToEventContent(entry) {
  if (!entry || typeof entry !== 'object') {
    throw new TypeError('entry must be an object');
  }
  if (!isOperatorCode(entry.op)) {
    throw new RangeError(`entry.op is not a known operator: ${String(entry.op)}`);
  }
  if (!isLegalAddress(entry.address)) {
    throw new RangeError('entry.address is not a legal address');
  }
  if (isDesert(entry.address)) {
    throw new RangeError('entry.address is the desert cell (SYN by Ground), which is prohibited');
  }
  const given = requireGiven(entry.given, 'entry');

  return {
    rules_rev: RULES_REV,
    op: entry.op,
    address: addressToContentAddress(entry.address),
    target: entry.target ?? null,
    operand: entry.operand ?? null,
    given,
    grounding: entry.grounding ? [...entry.grounding] : [],
  };
}

// Inverse mapping. Per Part 3: "The agent is event.sender. The timestamp is
// origin_server_ts." — those live on the event envelope, not the content,
// so this takes the whole event rather than just event.content.
export function eventContentToEntry(event) {
  if (!event || typeof event !== 'object' || !event.content) {
    throw new TypeError('event must be a Matrix event with a content field');
  }
  const content = event.content;
  if (!isOperatorCode(content.op)) {
    throw new RangeError(`event content.op is not a known operator: ${String(content.op)}`);
  }
  const address = contentAddressToAddress(content.address);
  if (isDesert(address)) {
    throw new RangeError('event content.address is the desert cell (SYN by Ground), which is prohibited');
  }
  const given = requireGiven(content.given, 'event content');

  return {
    op: content.op,
    address,
    target: content.target ?? null,
    operand: content.operand ?? null,
    given,
    grounding: content.grounding ? [...content.grounding] : [],
    agent: event.sender,
    timestamp: event.origin_server_ts,
  };
}
