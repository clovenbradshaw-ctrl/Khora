// Board: the kanban pipeline (Part 4, Tier 2). Home terrain Network. Adding
// a card is INS, moving it between columns is DEF, redefining the columns
// themselves is REC — a frame-level change, so it targets Pattern rather
// than a single card's Figure.

import { makeAddress } from '../../kernel/address.js';
import { OPERATORS } from '../../kernel/operators.js';
import { gatedWrite, OBJECT_FIGURE, OBJECT_PATTERN } from './shared.js';

const FLAG = 'board';

export function createBoardSurface({ log }) {
  let lastRead = { cards: [] };

  async function read(query = {}) {
    const boardId = query.boardId;
    const entries = await log.slice((entry) => !boardId || entry.target === boardId || entry.operand?.boardId === boardId);
    lastRead = { cards: entries.map(({ entry }) => entry) };
    return lastRead;
  }

  const bindings = {
    // INS: a new card enters the pipeline.
    addCard: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'INS',
        address: makeAddress(OPERATORS.INS.mode, OPERATORS.INS.domain, OBJECT_FIGURE),
        target: payload?.cardId,
        operand: { boardId: payload?.boardId, title: payload?.title, column: payload?.column },
        provenance,
      }),

    // DEF: a card moves to another column without the column set changing.
    moveCard: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'DEF',
        address: makeAddress(OPERATORS.DEF.mode, OPERATORS.DEF.domain, OBJECT_FIGURE),
        target: payload?.cardId,
        operand: { toColumn: payload?.toColumn },
        provenance,
      }),

    // REC: the column set itself is re-categorized, not a card within it.
    redefineColumns: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'REC',
        address: makeAddress(OPERATORS.REC.mode, OPERATORS.REC.domain, OBJECT_PATTERN),
        target: payload?.boardId,
        operand: { columns: payload?.columns },
        provenance,
      }),
  };

  function fallback() {
    return { ...lastRead, stale: true };
  }

  return { homeTerrain: 'Network', read, bindings, fallback };
}
