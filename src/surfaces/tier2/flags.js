// Tier 2 flag registry (Part 4: "Tier 2, confident, behind a flag"). Every
// Tier 2 write binding must check its flag before it may append, and every
// flag defaults to false so a freshly generated app ships with Tier 2
// writes off until someone turns them on. In-memory only, matching the
// kernel's log adapter being the only real persistence layer.

const DEFAULT_FLAGS = Object.freeze({
  board: false,
  'social-feed': false,
  crm: false,
  graph: false,
  'news-site': false,
  calendar: false,
});

const flags = new Map(Object.entries(DEFAULT_FLAGS));

function assertKnown(flagName) {
  if (!flags.has(flagName)) {
    throw new RangeError(`unknown Tier 2 flag: ${flagName}`);
  }
}

export function isEnabled(flagName) {
  assertKnown(flagName);
  return flags.get(flagName);
}

export function setEnabled(flagName, value) {
  assertKnown(flagName);
  if (typeof value !== 'boolean') {
    throw new TypeError('flag value must be a boolean');
  }
  flags.set(flagName, value);
}

export const FLAG_NAMES = Object.freeze(Object.keys(DEFAULT_FLAGS));
