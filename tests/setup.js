/**
 * Khora Test Setup
 *
 * Loads global-scope app modules into Node's global context and provides
 * minimal browser API mocks required by app code at parse time.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

// ── Browser global mocks (needed before any app module loads) ──

// localStorage / sessionStorage stub
function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = makeStorage();
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = makeStorage();
}

// Minimal window stub
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    body: { appendChild() {}, removeChild() {}, classList: { add() {}, remove() {} } },
    head: { appendChild() {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    createTextNode: (t) => ({ textContent: t }),
    title: '',
  };
}

// CustomEvent stub (used by emitOp)
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, opts = {}) {
      this.type = type;
      this.detail = opts.detail ?? null;
    }
  };
}
globalThis.window.dispatchEvent = globalThis.window.dispatchEvent || (() => {});

// btoa / atob (available in Node 16+ but ensure they're global)
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
}
if (typeof globalThis.atob === 'undefined') {
  globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}

// TextEncoder/TextDecoder (available in Node, ensure global)
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = await import('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// fetch stub (for tests that don't actually call network)
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = async () => { throw new Error('fetch is not available in test environment'); };
}

// ── Mock Matrix SDK ──

/** In-memory Matrix state store used by both unit and integration tests */
export class MockMatrixClient {
  constructor() {
    this._state = new Map();    // 'roomId::type::stateKey' → content
    this._rooms = new Map();    // roomId → { name, topic, initial_state, ... }
    this._roomCounter = 0;
    this._timeline = [];        // timeline events
    this._cryptoEnabled = true;
  }

  async createRoom(opts = {}) {
    const roomId = `!room${++this._roomCounter}:test.local`;
    this._rooms.set(roomId, { ...opts, roomId });
    // Store initial_state
    for (const s of (opts.initial_state || [])) {
      this._setInternal(roomId, s.type, s.content, s.state_key || '');
    }
    // Store power_level_content_override if present
    if (opts.power_level_content_override) {
      this._setInternal(roomId, 'm.room.power_levels', opts.power_level_content_override, '');
    }
    return { room_id: roomId };
  }

  async sendStateEvent(roomId, type, content, stateKey = '') {
    this._setInternal(roomId, type, content, stateKey);
    return { event_id: `$evt_${Date.now()}` };
  }

  _setInternal(roomId, type, content, stateKey = '') {
    const key = `${roomId}::${type}::${stateKey}`;
    this._state.set(key, structuredClone(content));
  }

  _getInternal(roomId, type, stateKey = '') {
    const key = `${roomId}::${type}::${stateKey}`;
    const content = this._state.get(key);
    return content ? structuredClone(content) : null;
  }

  getRoom(roomId) {
    if (!this._rooms.has(roomId) && !this._hasAnyState(roomId)) return null;
    const self = this;
    return {
      roomId,
      name: this._rooms.get(roomId)?.name,
      currentState: {
        getStateEvents(type, stateKey) {
          if (stateKey !== undefined) {
            const content = self._getInternal(roomId, type, stateKey);
            return content ? { getContent: () => content, getType: () => type } : null;
          }
          // Return all state events of this type
          const events = [];
          for (const [k, v] of self._state) {
            if (k.startsWith(`${roomId}::${type}::`)) {
              const sk = k.split('::')[2];
              events.push({ getContent: () => structuredClone(v), getType: () => type, getStateKey: () => sk });
            }
          }
          return events;
        }
      },
      hasEncryptionStateEvent() {
        return self._getInternal(roomId, 'm.room.encryption', '') !== null;
      }
    };
  }

  _hasAnyState(roomId) {
    for (const k of this._state.keys()) {
      if (k.startsWith(`${roomId}::`)) return true;
    }
    return false;
  }

  isCryptoEnabled() { return this._cryptoEnabled; }

  async sendEvent(roomId, type, content) {
    const evt = { room_id: roomId, type, content, event_id: `$evt_${Date.now()}`, ts: Date.now() };
    this._timeline.push(evt);
    return evt;
  }

  getRooms() {
    return [...this._rooms.keys()].map(id => this.getRoom(id));
  }

  // Get all state for all rooms (used by scanRooms-like logic)
  getAllState() {
    const result = {};
    for (const [key, content] of this._state) {
      const [roomId, type, sk] = key.split('::');
      if (!result[roomId]) result[roomId] = {};
      result[roomId][type] = content;
    }
    return result;
  }
}

// Global mock Matrix SDK
globalThis.matrixcs = {
  createClient: (opts) => new MockMatrixClient(),
  IndexedDBCryptoStore: class {
    constructor() {}
  },
};

// Global mock Olm
globalThis.Olm = {
  init: async () => {},
};

// ── Module loader ──

const APP_DIR = resolve(import.meta.dirname, '..', 'app');

/**
 * Load a JS file into the global context, making its top-level
 * declarations available as globals (the same way browsers load <script> tags).
 */
export function loadModule(filename) {
  const filepath = resolve(APP_DIR, filename);
  const code = readFileSync(filepath, 'utf-8');
  vm.runInThisContext(code, { filename: filepath });
}

// Pre-load core modules in dependency order.
// Later tests may load additional modules as needed.
//
// NOTE: We only load modules that (a) don't require a real DOM and
// (b) don't require React or the Matrix SDK to be fully initialized.

// 1. Constants (pure data, no side effects)
loadModule('constants.js');

// 2. Crypto + EO engine (uses Web Crypto API which Node 22 provides)
loadModule('crypto.js');

// 3. E2EE module (needs matrixcs and Olm mocks — set above)
loadModule('e2ee.js');

// 4. Auth (needs indexedDB stub — load BEFORE service.js since service delegates to KhoraAuth)
globalThis.indexedDB = {
  open: () => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: null,
  }),
};
loadModule('auth.js');

// Set default test credentials on the real KhoraAuth (which uses private backing fields)
KhoraAuth._userId = '@test:test.local';
KhoraAuth._token = 'test_token_abc';
KhoraAuth._baseUrl = 'https://matrix.test.local';

// 5. Service (transport layer — delegates to KhoraAuth getters)
loadModule('service.js');

// 6. Config (resource validation functions, form definitions)
loadModule('config.js');

// Provide a global svc instance for emitOp and other code that expects it
globalThis.svc = new KhoraService();
