// The log adapter interface, not an implementation (Part 2). The Matrix
// substrate (src/substrate/matrix-log.js) is the real implementation.
// InMemoryLog below is a reference/test double only — it exists so the
// kernel, generator, and surfaces can be exercised without a homeserver.

const REQUIRED_METHODS = ['append', 'stream', 'slice', 'checkpoint'];

export function assertLogAdapter(adapter) {
  for (const method of REQUIRED_METHODS) {
    if (!adapter || typeof adapter[method] !== 'function') {
      throw new TypeError(`log adapter missing required method: ${method}`);
    }
  }
  return adapter;
}

export class InMemoryLog {
  constructor() {
    this._entries = [];
  }

  async append(entry) {
    const id = this._entries.length;
    this._entries.push({ id, entry });
    return { id };
  }

  // eslint-disable-next-line require-yield
  async *stream(sinceToken = 0) {
    for (let i = sinceToken; i < this._entries.length; i++) {
      yield this._entries[i];
    }
  }

  async slice(filter = () => true) {
    return this._entries.filter(({ entry }) => filter(entry));
  }

  async checkpoint(meantGraph) {
    return { ...meantGraph, checkpointedAt: this._entries.length };
  }
}
