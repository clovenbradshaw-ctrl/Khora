// CRM: a composed tool (Part 4, Tier 2 — "How surfaces compose"). Home
// terrains Link and Network. A CRM is a table of contacts, an entity card
// per contact (a single-row read over the same table, not a separate
// surface), a board for the pipeline, and a graph of relationships, over
// one room. Creating a contact and linking and advancing a stage delegate
// to the injected Tier 1/Tier 2 controllers that already own those actions;
// qualifying a lead (EVA) and re-segmenting (REC) have no Tier 1 analog —
// Tier 1 never emits those operators — so this surface appends them itself.
//
// This composition assumes the injected controllers expose bindings named
// `addRow` (table, matching src/surfaces/table.js), and `moveCard` /
// `addEdge` (the Tier 2 board and graph controllers in this directory). A
// Tier 1 write binding takes `{ address, target, operand }` directly rather
// than domain-shaped fields, so createContact builds that shape itself
// before delegating.

import { makeAddress } from '../../kernel/address.js';
import { OPERATORS } from '../../kernel/operators.js';
import { gatedWrite, delegateGated, OBJECT_FIGURE, OBJECT_PATTERN } from './shared.js';

const FLAG = 'crm';

export function createCRMSurface({ log, tableController, boardController, graphController }) {
  let lastRead = { contacts: [] };

  async function read(query = {}) {
    // The "entity card per contact" is just this same read narrowed to one id.
    const rows = tableController ? await tableController.read(query) : { rows: [] };
    lastRead = { contacts: rows.rows ?? rows };
    return lastRead;
  }

  const bindings = {
    // INS: a new contact — delegated to the table controller, which owns
    // rows. Table's addRow binding wants { address, target, operand }
    // directly, so that shape is built here rather than passed through raw.
    createContact: (payload, provenance) =>
      delegateGated({
        flag: FLAG,
        controller: tableController,
        bindingName: 'addRow',
        payload: {
          address: makeAddress(OPERATORS.INS.mode, OPERATORS.INS.domain, OBJECT_FIGURE),
          target: payload?.contactId,
          operand: payload,
        },
        provenance,
      }),

    // CON: a relationship link — delegated to the graph controller, which owns edges.
    link: (payload, provenance) =>
      delegateGated({
        flag: FLAG,
        controller: graphController,
        bindingName: 'addEdge',
        payload,
        provenance,
      }),

    // DEF: advancing a pipeline stage — delegated to the board controller, which owns cards.
    advanceStage: (payload, provenance) =>
      delegateGated({
        flag: FLAG,
        controller: boardController,
        bindingName: 'moveCard',
        payload,
        provenance,
      }),

    // EVA: qualifying a lead is a CRM-native judgment, no Tier 1 surface emits EVA.
    qualifyLead: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'EVA',
        address: makeAddress(OPERATORS.EVA.mode, OPERATORS.EVA.domain, OBJECT_FIGURE),
        target: payload?.contactId,
        operand: { qualified: payload?.qualified, basis: payload?.basis },
        provenance,
      }),

    // REC: re-segmenting recategorizes the frame the contacts are read against.
    resegment: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'REC',
        address: makeAddress(OPERATORS.REC.mode, OPERATORS.REC.domain, OBJECT_PATTERN),
        target: payload?.segmentationId,
        operand: { segments: payload?.segments },
        provenance,
      }),
  };

  function fallback() {
    return { ...lastRead, stale: true };
  }

  return { homeTerrain: 'Link and Network', read, bindings, fallback };
}
