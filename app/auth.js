/* ═══════════════════ AUTH MODULE (Compartmentalized Login Architecture) ═══════════════════
 * Self-contained authentication module. All login, session restore, logout, and
 * auth-related crypto (vault key derivation, encrypted session cache) live here.
 *
 * Public interface (stable contract — resilient to repo updates):
 *   KhoraAuth.userId            — current authenticated user's Matrix ID
 *   KhoraAuth.token             — current access token
 *   KhoraAuth.baseUrl           — current homeserver URL
 *   KhoraAuth.client            — initialized Matrix SDK client (or null)
 *   KhoraAuth.isAuthenticated   — boolean
 *   KhoraAuth.login(homeserver, user, pass)  → {userId}
 *   KhoraAuth.restoreSession()               → null | {userId} | {expired} | {networkError}
 *   KhoraAuth.logout()                       → void
 *
 * LocalVaultCrypto and KhoraEncryptedCache are also defined here since their
 * lifecycle is bound to the auth session (derive on login, destroy on logout).
 * They remain global for use by other modules (scanRooms caching, etc.).
 *
 * Operator Manifest:
 *   INS(matrix.session, {credentials}) — authentication
 *   INS(crypto.vault_key, {via: hkdf}) — at_rest_encryption
 *   DES(matrix.session, {check: whoami}) — token_validation
 *   NUL(matrix.session+keys+cache, {reason: logout}) — full_teardown
 *
 * Triad Summary:
 *   Existence:       INS (session creation, key derivation), NUL (logout teardown)
 *   Structure:       —
 *   Interpretation:  ALT (encrypt/decrypt at rest)
 * ═══════════════════════════════════════════════════════════════════════════════ */

/* ─── LOCAL VAULT CRYPTO (IndexedDB at-rest encryption) ───
 * Derives a per-user AES-256-GCM key from the Matrix session using HKDF.
 * All local IndexedDB data is encrypted with this key so that only the
 * authenticated user who synced the data can read it at rest. The key is
 * held in memory only — destroyed on logout or tab close.
 */
const LocalVaultCrypto = {
  _key: null,
  _userId: null,
  // INS(crypto.vault_key, {via: hkdf, inputs: token+userId+deviceId}) — at_rest_encryption
  async deriveKey(userId, accessToken, deviceId) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(accessToken), 'HKDF', false, ['deriveKey']);
    this._key = await crypto.subtle.deriveKey({
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode(`${userId}|${deviceId}`),
      info: enc.encode('khora-local-vault-v1')
    }, keyMaterial, {
      name: 'AES-GCM',
      length: 256
    }, false, ['encrypt', 'decrypt']);
    this._userId = userId;
    return this._key;
  },
  get ready() {
    return !!this._key;
  },
  // ALT(crypto.data, {transform: encrypted_envelope, key: vault_key}) — local_persistence
  async encrypt(data) {
    if (!this._key) throw new Error('LocalVaultCrypto not initialized');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({
      name: 'AES-GCM',
      iv
    }, this._key, new TextEncoder().encode(JSON.stringify(data)));
    return {
      __enc: 1,
      ct: btoa(String.fromCharCode(...new Uint8Array(ct))),
      iv: btoa(String.fromCharCode(...iv))
    };
  },
  // ALT(crypto.encrypted_envelope, {transform: data, key: vault_key}) — local_retrieval
  async decrypt(envelope) {
    if (!this._key) throw new Error('LocalVaultCrypto not initialized');
    if (!envelope?.__enc) return envelope;
    try {
      const ct = Uint8Array.from(atob(envelope.ct), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(envelope.iv), c => c.charCodeAt(0));
      const dec = await crypto.subtle.decrypt({
        name: 'AES-GCM',
        iv
      }, this._key, ct);
      return JSON.parse(new TextDecoder().decode(dec));
    } catch {
      return null;
    }
  },
  // NUL(crypto.vault_key, {reason: logout}) — key_destruction — local data becomes unreadable
  clear() {
    this._key = null;
    this._userId = null;
  }
};

/* ─── ENCRYPTED LOCAL CACHE ───
 * All values written to IndexedDB go through LocalVaultCrypto.encrypt().
 * Keys (primary keys) remain plaintext for lookups; values are AES-256-GCM
 * ciphertext. An attacker inspecting IndexedDB sees only opaque blobs.
 */
const KhoraEncryptedCache = {
  DB_NAME: 'khora-encrypted-vault',
  DB_VERSION: 1,
  STORES: ['session', 'rooms', 'state'],
  _db: null,
  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        for (const s of this.STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
        }
      };
      req.onsuccess = e => {
        this._db = e.target.result;
        resolve(this._db);
      };
      req.onerror = () => reject(req.error);
    });
  },
  // INS(cache.encrypted_blob, {store: idb}) — local_persistence — encrypt-then-write
  async put(storeName, key, value) {
    if (!LocalVaultCrypto.ready) return;
    const db = await this.open();
    const encrypted = await LocalVaultCrypto.encrypt(value);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(encrypted, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  // ALT(cache.encrypted_blob, {transform: data, key: vault_key}) — cache_read — read-then-decrypt
  async get(storeName, key) {
    if (!LocalVaultCrypto.ready) return null;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = async () => {
        if (!req.result) return resolve(null);
        try {
          resolve(await LocalVaultCrypto.decrypt(req.result));
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  },
  // ALT(cache.encrypted_blob[], {transform: data[], key: vault_key}) — bulk_cache_read — cursor-based decrypt
  async getAll(storeName) {
    if (!LocalVaultCrypto.ready) return {};
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const results = {};
      const pending = [];
      const req = tx.objectStore(storeName).openCursor();
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          pending.push(LocalVaultCrypto.decrypt(cursor.value).then(v => {
            if (v !== null) results[cursor.key] = v;
          }).catch(() => {}));
          cursor.continue();
        } else {
          Promise.all(pending).then(() => resolve(results));
        }
      };
      req.onerror = () => reject(req.error);
    });
  },
  // NUL(cache.all_stores, {reason: wipe}) — cache_destruction — purge all encrypted data
  async clear() {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORES, 'readwrite');
        for (const s of this.STORES) tx.objectStore(s).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {}
  },
  close() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }
};

/* ─── KHORA AUTH ───
 * Compartmentalized authentication facade. Owns the full session lifecycle:
 * login → token storage → client init → crypto init → sync → session persist
 * restore → token validation → client re-init → sync
 * logout → client teardown → token clear → key destroy → cache wipe
 */
const KhoraAuth = {
  _client: null,
  _baseUrl: null,
  _token: null,
  _userId: null,
  _timelineListenerAttached: false,

  // ── Public interface (stable contract) ──
  get userId() { return this._userId; },
  get token() { return this._token; },
  get baseUrl() { return this._baseUrl; },
  get client() { return this._client; },
  get isAuthenticated() { return !!(this._token && this._userId); },

  // Register real-time timeline event listener on the Matrix client.
  // Dispatches DOM CustomEvents so React components can react instantly
  // to new Khora events without polling.
  _setupTimelineListener() {
    if (!this._client || this._timelineListenerAttached) return;
    this._timelineListenerAttached = true;
    const khoraPrefix = NS + '.';
    this._client.on('Room.timeline', (event, room, toStartOfTimeline) => {
      if (toStartOfTimeline) return;
      const type = event.getType();
      // Dispatch for Khora custom events AND standard messages so incoming
      // messages from Element / other clients trigger a real-time UI refresh.
      if (!type.startsWith(khoraPrefix) && type !== 'm.room.message') return;
      const detail = {
        eventId: event.getId(),
        roomId: room?.roomId,
        type,
        content: event.getContent(),
        sender: event.getSender(),
        ts: event.getTs(),
        isOwn: event.getSender() === this._userId
      };
      window.dispatchEvent(new CustomEvent('khora:timeline', { detail }));
    });
    // Listen for decrypted events — encrypted messages from Element arrive as
    // m.room.encrypted in Room.timeline (skipped above). Once the SDK decrypts
    // them, this handler fires so we can trigger the UI refresh.
    this._client.on('Event.decrypted', (event) => {
      const type = event.getType();
      if (type !== 'm.room.message' && !type.startsWith(khoraPrefix)) return;
      const roomId = event.getRoomId?.() || event.event?.room_id;
      if (!roomId) return;
      const detail = {
        eventId: event.getId(),
        roomId,
        type,
        content: event.getContent(),
        sender: event.getSender(),
        ts: event.getTs(),
        isOwn: event.getSender() === this._userId
      };
      window.dispatchEvent(new CustomEvent('khora:timeline', { detail }));
    });
    this._client.on('RoomState.events', (event, roomState) => {
      const type = event.getType();
      if (!type.startsWith(khoraPrefix)) return;
      const detail = {
        eventId: event.getId(),
        roomId: roomState?.roomId,
        type,
        content: event.getContent(),
        sender: event.getSender(),
        ts: event.getTs(),
        isState: true,
        isOwn: event.getSender() === this._userId
      };
      window.dispatchEvent(new CustomEvent('khora:state', { detail }));
    });
  },

  // NUL(matrix.legacy_idb, {targets: store_names}) — security_cleanup
  async _purgeUnencryptedStores() {
    if (typeof indexedDB?.databases === 'function') {
      try {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name && db.name !== KhoraEncryptedCache.DB_NAME && !db.name.includes('crypto')) {
            try { indexedDB.deleteDatabase(db.name); } catch {}
          }
        }
      } catch (e) {
        console.warn('IndexedDB purge:', e.message);
      }
    }
    for (const name of ['amino', 'matrix-js-sdk:default', 'matrix-js-sdk:riot-web-sync', 'matrix-js-sdk:web-sync']) {
      try { indexedDB.deleteDatabase(name); } catch {}
    }
  },

  // INS(matrix.session, {credentials}) — authentication
  async login(homeserver, user, pass) {
    const baseUrl = homeserver.startsWith('http') ? homeserver : `https://${homeserver}`;
    this._baseUrl = baseUrl;
    if (typeof matrixcs !== 'undefined') {
      this._client = matrixcs.createClient({ baseUrl });
      const res = await this._client.login('m.login.password', { user, password: pass });
      await LocalVaultCrypto.deriveKey(res.user_id, res.access_token, res.device_id);
      await this._purgeUnencryptedStores();
      this._client = matrixcs.createClient({
        baseUrl,
        accessToken: res.access_token,
        userId: res.user_id,
        deviceId: res.device_id
      });
      try {
        if (typeof Olm !== 'undefined') await Olm.init();
        await this._client.initCrypto();
        this._client.setGlobalErrorOnUnknownDevices(false);
      } catch (e) { console.warn('Crypto init:', e.message); }
      await this._client.startClient({ initialSyncLimit: 30 });
      await new Promise((resolve, reject) => {
        if (this._client.isInitialSyncComplete()) return resolve();
        const timeout = setTimeout(() => reject(new Error('Sync timed out — the server may be overloaded. Please try again.')), 60000);
        this._client.on('sync', (state, prev, data) => {
          if (state === 'PREPARED') { clearTimeout(timeout); resolve(); }
          else if (state === 'ERROR') { clearTimeout(timeout); reject(new Error(data?.error?.message || 'Sync failed — please try again.')); }
        });
      });
      this._userId = res.user_id;
      this._token = res.access_token;
      this._setupTimelineListener();
      try {
        localStorage.setItem('khora_session', JSON.stringify({
          homeserver: baseUrl,
          accessToken: res.access_token,
          userId: res.user_id,
          deviceId: res.device_id
        }));
      } catch {}
      try {
        await KhoraEncryptedCache.put('session', 'current', {
          userId: res.user_id,
          homeserver: baseUrl,
          deviceId: res.device_id,
          ts: Date.now()
        });
      } catch {}
      return { userId: res.user_id };
    } else {
      const resp = await this._api('POST', '/login', {
        type: 'm.login.password', user, password: pass
      }, true);
      this._token = resp.access_token;
      this._userId = resp.user_id;
      this._baseUrl = baseUrl;
      try {
        localStorage.setItem('khora_session', JSON.stringify({
          homeserver: baseUrl,
          accessToken: resp.access_token,
          userId: resp.user_id,
          deviceId: resp.device_id || 'fallback'
        }));
      } catch {}
      return { userId: resp.user_id };
    }
  },

  // DES(matrix.session, {check: whoami}) — token_validation
  async restoreSession() {
    const raw = localStorage.getItem('khora_session');
    if (!raw) return null;
    let saved;
    try { saved = JSON.parse(raw); } catch { localStorage.removeItem('khora_session'); return null; }
    const { homeserver, accessToken, userId, deviceId } = saved;
    if (!homeserver || !accessToken || !userId || !deviceId) return null;

    // Step 1: Validate token with the homeserver
    let tokenValid = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const resp = await fetch(`${homeserver}/_matrix/client/v3/account/whoami`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (resp.ok) { tokenValid = true; break; }
        if (resp.status === 401 || resp.status === 403) {
          console.warn('Session token expired or revoked (HTTP ' + resp.status + ')');
          localStorage.removeItem('khora_session');
          return { expired: true };
        }
        if (resp.status >= 500) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        break;
      } catch (e) {
        console.warn('Session restore network error (attempt ' + (attempt + 1) + '):', e.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        return { networkError: true, message: e.message };
      }
    }
    if (!tokenValid) {
      return { networkError: true, message: 'Server unavailable' };
    }

    // Step 2: Token is valid — initialize the Matrix client and sync
    try {
      this._baseUrl = homeserver;
      await LocalVaultCrypto.deriveKey(userId, accessToken, deviceId);
      if (typeof matrixcs !== 'undefined') {
        this._client = matrixcs.createClient({ baseUrl: homeserver, accessToken, userId, deviceId });
        try {
          if (typeof Olm !== 'undefined') await Olm.init();
          await this._client.initCrypto();
          this._client.setGlobalErrorOnUnknownDevices(false);
        } catch (e) { console.warn('Crypto init:', e.message); }
        await this._client.startClient({ initialSyncLimit: 30 });
        await new Promise((resolve, reject) => {
          if (this._client.isInitialSyncComplete()) return resolve();
          const timeout = setTimeout(() => reject(new Error('Sync timed out')), 90000);
          this._client.on('sync', (state, prev, data) => {
            if (state === 'PREPARED') { clearTimeout(timeout); resolve(); }
            else if (state === 'ERROR') { clearTimeout(timeout); reject(new Error(data?.error?.message || 'Sync failed')); }
          });
        });
      }
      this._userId = userId;
      this._token = accessToken;
      this._setupTimelineListener();
      return { userId };
    } catch (e) {
      console.warn('Session restore sync failed:', e.message);
      if (this._client) { try { this._client.stopClient(); } catch {} }
      this._client = null;
      this._token = null;
      this._userId = null;
      LocalVaultCrypto.clear();
      return { networkError: true, message: e.message };
    }
  },

  // NUL(matrix.session+keys+cache, {reason: logout}) — full_teardown
  async logout() {
    if (this._client) {
      this._client.stopClient();
      try { await this._client.logout(); } catch {}
    }
    this._client = null;
    this._token = null;
    this._userId = null;
    this._timelineListenerAttached = false;
    LocalVaultCrypto.clear();
    try { await KhoraEncryptedCache.clear(); KhoraEncryptedCache.close(); } catch {}
    try { await this._purgeUnencryptedStores(); } catch {}
  },

  // Internal REST API method (used by login fallback path when Matrix SDK unavailable)
  async _api(method, path, body, noAuth) {
    const url = `${this._baseUrl}/_matrix/client/v3${path}`;
    const h = { 'Content-Type': 'application/json' };
    if (!noAuth) h['Authorization'] = `Bearer ${this._token}`;
    const opts = { method, headers: h };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `API ${r.status}`);
    }
    return r.json();
  }
};
