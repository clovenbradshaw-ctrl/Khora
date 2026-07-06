// Social feed: the scrolling stream from people you follow (Part 4, Tier
// 2). Home terrain Entity, borrowing Field for the stream and Network for
// the follow graph. Matrix.org's Cerulean is the proven model this follows:
// each person's posts live in their own room, so every binding here targets
// the acting user's own room, never someone else's — posting, following,
// reacting, and replying are all things you do in your own space, even when
// they're about someone else's content.

import { makeAddress } from '../../kernel/address.js';
import { OPERATORS } from '../../kernel/operators.js';
import { gatedWrite, OBJECT_FIGURE } from './shared.js';

const FLAG = 'social-feed';

function ownRoomOf(provenance) {
  return provenance?.agent ? `room:${provenance.agent}` : undefined;
}

export function createSocialFeedSurface({ log }) {
  let lastRead = { posts: [] };

  async function read(query = {}) {
    const rooms = query.rooms; // rooms the reader follows, including their own
    const entries = await log.slice((entry) => !rooms || rooms.includes(entry.target));
    lastRead = { posts: entries.map(({ entry }) => entry) };
    return lastRead;
  }

  const bindings = {
    // INS into your own room: a post is a new instance of you saying something.
    post: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'INS',
        address: makeAddress(OPERATORS.INS.mode, OPERATORS.INS.domain, OBJECT_FIGURE),
        target: ownRoomOf(provenance),
        operand: { body: payload?.body, media: payload?.media ?? null },
        provenance,
      }),

    // CON: a subscription is a connection across the boundary between your
    // room and theirs, recorded in your own room.
    follow: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'CON',
        address: makeAddress(OPERATORS.CON.mode, OPERATORS.CON.domain, OBJECT_FIGURE),
        target: ownRoomOf(provenance),
        operand: { subscribesTo: payload?.room },
        provenance,
      }),

    // SIG: a reaction is a difference coming to notice, a Matrix reaction event.
    react: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'SIG',
        address: makeAddress(OPERATORS.SIG.mode, OPERATORS.SIG.domain, OBJECT_FIGURE),
        target: ownRoomOf(provenance),
        operand: { reactsTo: payload?.postId, reaction: payload?.reaction },
        provenance,
      }),

    // CON: a threaded reply, also recorded in your own room.
    reply: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'CON',
        address: makeAddress(OPERATORS.CON.mode, OPERATORS.CON.domain, OBJECT_FIGURE),
        target: ownRoomOf(provenance),
        operand: { threadRoot: payload?.threadRoot, body: payload?.body },
        provenance,
      }),
  };

  function fallback() {
    return { ...lastRead, stale: true };
  }

  return { homeTerrain: 'Entity borrowing Field and Network', read, bindings, fallback };
}
