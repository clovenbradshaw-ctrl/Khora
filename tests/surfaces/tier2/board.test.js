import { describe, it, expect, afterEach } from 'vitest';
import { InMemoryLog } from '../../../src/kernel/log.js';
import { createBoardSurface } from '../../../src/surfaces/tier2/board.js';
import { setEnabled } from '../../../src/surfaces/tier2/flags.js';

const provenance = { agent: 'user:alice', mode_of_givenness: 'direct-report', context: 'board-ui' };

describe('createBoardSurface', () => {
  afterEach(() => setEnabled('board', false));

  it('refuses every write binding while the board flag is off, and appends nothing', async () => {
    const log = new InMemoryLog();
    const board = createBoardSurface({ log });

    const addResult = await board.bindings.addCard({ cardId: 'card-1', title: 'Follow up' }, provenance);
    const moveResult = await board.bindings.moveCard({ cardId: 'card-1', toColumn: 'doing' }, provenance);
    const redefResult = await board.bindings.redefineColumns({ boardId: 'b1', columns: ['todo', 'doing'] }, provenance);

    expect(addResult).toEqual({ ok: false, reason: 'disabled', flag: 'board' });
    expect(moveResult).toEqual({ ok: false, reason: 'disabled', flag: 'board' });
    expect(redefResult).toEqual({ ok: false, reason: 'disabled', flag: 'board' });
    expect((await log.slice()).length).toBe(0);
  });

  it('appends a valid binding once the flag is enabled', async () => {
    const log = new InMemoryLog();
    const board = createBoardSurface({ log });
    setEnabled('board', true);

    const result = await board.bindings.addCard({ cardId: 'card-1', title: 'Follow up' }, provenance);

    expect(result.ok).toBe(true);
    expect((await log.slice()).length).toBe(1);
    const { read } = board;
    const { cards } = await read();
    expect(cards).toHaveLength(1);
    expect(cards[0].emit.op).toBe('INS');
  });

  it('still refuses a binding missing its provenance envelope, even with the flag on', async () => {
    const log = new InMemoryLog();
    const board = createBoardSurface({ log });
    setEnabled('board', true);

    const result = await board.bindings.addCard({ cardId: 'card-1', title: 'Follow up' }, undefined);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid');
    expect((await log.slice()).length).toBe(0);
  });

  it('exposes a fallback that never throws even with no reads yet', () => {
    const log = new InMemoryLog();
    const board = createBoardSurface({ log });
    expect(board.fallback()).toEqual({ cards: [], stale: true });
  });
});
