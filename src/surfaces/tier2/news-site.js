// News site: a publication, composed (Part 4, Tier 2 — "How surfaces
// compose"). Home terrain Entity borrowing the Significance terrains Lens
// and Paradigm. It composes a public feed of pieces (delegated to an
// injected Tier 1 Feed controller) and an intake form (delegated to an
// injected Tier 1 Form controller), split from a private editing room
// where corrections, editorial judgment, and retractions are appended
// directly. Publishing is INS, a correction is DEF, editorial judgment is
// EVA, a retraction or reframe is REC.
//
// Tier 3's Document reader is explicitly deferred by the design doc ("it
// waits because the substrate has to be proven under lighter surfaces
// first") — this uses a minimal single-piece read of its own instead of the
// eoreader clause-addressed reader, which is a real simplification, not a
// stand-in for it.
//
// This composition assumes the injected feed/form controllers are Tier 1's
// src/surfaces/feed.js and form.js, whose `post` and `submit` bindings take
// { address, target, operand } directly (the operator is fixed by the
// binding itself, or by the form's own construction) rather than
// domain-shaped fields, so that shape is built here before delegating.

import { makeAddress } from '../../kernel/address.js';
import { OPERATORS } from '../../kernel/operators.js';
import { gatedWrite, delegateGated, OBJECT_FIGURE, OBJECT_PATTERN } from './shared.js';

const FLAG = 'news-site';

export function createNewsSiteSurface({ log, feedController, formController }) {
  let lastRead = { pieces: [] };

  // The minimal reader per piece: the published content (from the public
  // feed) plus this piece's own editorial history (from the private room).
  async function readPiece(pieceId) {
    const publishedResult = feedController ? await feedController.read({ postId: pieceId }) : { posts: [] };
    const editorialEntries = await log.slice((entry) => entry.target === pieceId);
    return {
      pieceId,
      published: publishedResult.posts ?? publishedResult,
      editorial: editorialEntries.map(({ entry }) => entry),
    };
  }

  async function read(query = {}) {
    if (query.pieceId) {
      return readPiece(query.pieceId);
    }
    const feedResult = feedController ? await feedController.read(query) : { posts: [] };
    lastRead = { pieces: feedResult.posts ?? feedResult };
    return lastRead;
  }

  const bindings = {
    // INS: publishing a piece — delegated to the feed controller, which owns
    // posts. Feed's post binding wants { address, target, operand } directly.
    publish: (payload, provenance) =>
      delegateGated({
        flag: FLAG,
        controller: feedController,
        bindingName: 'post',
        payload: {
          address: makeAddress(OPERATORS.INS.mode, OPERATORS.INS.domain, OBJECT_FIGURE),
          target: payload?.pieceId,
          operand: payload,
        },
        provenance,
      }),

    // DEF: a correction revises the piece without changing what it is,
    // recorded in the private editing room.
    correction: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'DEF',
        address: makeAddress(OPERATORS.DEF.mode, OPERATORS.DEF.domain, OBJECT_FIGURE),
        target: payload?.pieceId,
        operand: { correctedText: payload?.correctedText, note: payload?.note },
        provenance,
      }),

    // EVA: editorial judgment, holding two positions under evaluation.
    editorialJudgment: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'EVA',
        address: makeAddress(OPERATORS.EVA.mode, OPERATORS.EVA.domain, OBJECT_FIGURE),
        target: payload?.pieceId,
        operand: { judgment: payload?.judgment, basis: payload?.basis },
        provenance,
      }),

    // REC: a retraction or reframe changes the frame the piece is read under.
    retractOrReframe: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'REC',
        address: makeAddress(OPERATORS.REC.mode, OPERATORS.REC.domain, OBJECT_PATTERN),
        target: payload?.pieceId,
        operand: { reason: payload?.reason, reframedAs: payload?.reframedAs ?? null },
        provenance,
      }),

    // Intake — delegated to the form controller, which owns submissions.
    // Form's operator is fixed at its own construction; the address built
    // here just needs to be a legal, non-desert address for that operator,
    // which INS/Figure is for an incoming tip.
    submitTip: (payload, provenance) =>
      delegateGated({
        flag: FLAG,
        controller: formController,
        bindingName: 'submit',
        payload: {
          address: makeAddress(OPERATORS.INS.mode, OPERATORS.INS.domain, OBJECT_FIGURE),
          target: payload?.tipId,
          operand: payload,
        },
        provenance,
      }),
  };

  function fallback() {
    return { ...lastRead, stale: true };
  }

  return { homeTerrain: 'Entity borrowing Lens and Paradigm', read, bindings, fallback };
}
