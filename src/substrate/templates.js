// Room templates (Part 3, Layer 2): "each fixing a visibility, a join
// rule, and a power-level map from event type to required level." This is
// the one piece of the account/permission structure the substrate authors
// rather than inherits — the DAG, the signing, and the state resolution
// are Matrix's.
//
// The shape mirrors real Matrix vocabulary directly: `visibility` is the
// POST /createRoom field, `join_rule` is the m.room.join_rules content,
// and `power_levels` mirrors m.room.power_levels' `events` map (event type
// -> required power level integer). A template's fields can be passed
// straight through to a real homeserver's room-creation call with no
// translation.

import { EO_ENTRY_EVENT_TYPE } from './event-mapping.js';

const BASE_POWER_LEVELS = Object.freeze({
  'm.room.power_levels': 100,
  'm.room.name': 50,
  'm.room.topic': 50,
});

// A public projection surface: the room the CQRS projection tails (Part
// 3, Layer 4). Anyone can read the timeline with no account, but only a
// moderator (or the appservice acting as one) can append entries.
export const PUBLIC_READ_ONLY = Object.freeze({
  name: 'public-read-only',
  visibility: 'public',
  join_rule: 'public',
  history_visibility: 'world_readable',
  power_levels: Object.freeze({
    ...BASE_POWER_LEVELS,
    [EO_ENTRY_EVENT_TYPE]: 50,
  }),
});

// A private room: membership is by invite only, and membership itself is
// the read permission (Layer 2: "Room membership is read permission,
// power levels are write permission"). Any invited member may append.
export const PRIVATE_INVITE_ONLY = Object.freeze({
  name: 'private-invite-only',
  visibility: 'private',
  join_rule: 'invite',
  history_visibility: 'invited',
  power_levels: Object.freeze({
    ...BASE_POWER_LEVELS,
    [EO_ENTRY_EVENT_TYPE]: 0,
  }),
});

// A room a provisioned ghost user (namespace @_site_*, Layer 2) can write
// into the moment the appservice auto-joins it, at the default power
// level — no separate promotion step, because the ghost is the site's own
// write gateway, not an arbitrary visitor.
export const GHOST_WRITABLE = Object.freeze({
  name: 'ghost-writable',
  visibility: 'public',
  join_rule: 'public',
  history_visibility: 'world_readable',
  power_levels: Object.freeze({
    ...BASE_POWER_LEVELS,
    [EO_ENTRY_EVENT_TYPE]: 0,
  }),
});

export const TEMPLATES = Object.freeze({
  publicReadOnly: PUBLIC_READ_ONLY,
  privateInviteOnly: PRIVATE_INVITE_ONLY,
  ghostWritable: GHOST_WRITABLE,
});
