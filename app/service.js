class KhoraService {
  constructor() {
    this.client = null;
    this._baseUrl = null;
    this._token = null;
    this._userId = null;
    this._timelineListenerAttached = false;
  }

  // Register real-time timeline event listener on the Matrix client.
  // Dispatches DOM CustomEvents so React components can react instantly
  // to new Khora events without polling.
  _setupTimelineListener() {
    if (!this.client || this._timelineListenerAttached) return;
    this._timelineListenerAttached = true;
    const khoraPrefix = NS + '.';
    this.client.on('Room.timeline', (event, room, toStartOfTimeline) => {
      if (toStartOfTimeline) return; // ignore historical pagination
      const type = event.getType();
      // Only fire for Khora-namespaced events (io.khora.*)
      if (!type.startsWith(khoraPrefix)) return;
      const detail = {
        eventId: event.getId(),
        roomId: room?.roomId,
        type,
        content: event.getContent(),
        sender: event.getSender(),
        ts: event.getTs(),
        isOwn: event.getSender() === this._userId
      };
      window.dispatchEvent(new CustomEvent('khora:timeline', {
        detail
      }));
    });
    // Also listen for state events to catch schema/org/roster changes
    this.client.on('RoomState.events', (event, roomState) => {
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
      window.dispatchEvent(new CustomEvent('khora:state', {
        detail
      }));
    });
  }
  async _withRetry(fn, maxAttempts = 5) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (e) {
        const msg = (e?.data?.error || e?.message || '').toLowerCase();
        const retryMs = e?.data?.retry_after_ms;
        if (msg.includes('too many') || msg.includes('rate') || msg.includes('limit') || retryMs) {
          const wait = Math.min(retryMs || 1000 * Math.pow(2, attempt), 16000);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw e;
      }
    }
    throw new Error('Rate limited — too many requests. Please try again.');
  }

  // INS(matrix.session, {credentials}) — authentication → INS(crypto.vault_key, {via: hkdf}) — at_rest_encryption → NUL(matrix.legacy_stores, {reason: purge}) — cleanup
  async login(homeserver, user, pass) {
    const baseUrl = homeserver.startsWith('http') ? homeserver : `https://${homeserver}`;
    this._baseUrl = baseUrl;
    if (typeof matrixcs !== 'undefined') {
      this.client = matrixcs.createClient({
        baseUrl
      });
      const res = await this.client.login('m.login.password', {
        user,
        password: pass
      });
      // Derive per-user at-rest encryption key (AES-256-GCM via HKDF from access token)
      // Only this user's session can decrypt local IndexedDB data
      await LocalVaultCrypto.deriveKey(res.user_id, res.access_token, res.device_id);
      // Purge any legacy unencrypted IndexedDB databases (preserves Matrix crypto store for E2EE)
      await this._purgeUnencryptedStores();
      this.client = matrixcs.createClient({
        baseUrl,
        accessToken: res.access_token,
        userId: res.user_id,
        deviceId: res.device_id
      });
      try {
        await this.client.initCrypto();
      } catch (e) {
        console.warn('Crypto:', e.message);
      }
      await this.client.startClient({
        initialSyncLimit: 30
      });
      await new Promise((resolve, reject) => {
        if (this.client.isInitialSyncComplete()) return resolve();
        const timeout = setTimeout(() => reject(new Error('Sync timed out — the server may be overloaded. Please try again.')), 60000);
        this.client.on('sync', (state, prev, data) => {
          if (state === 'PREPARED') {
            clearTimeout(timeout);
            resolve();
          } else if (state === 'ERROR') {
            clearTimeout(timeout);
            reject(new Error(data?.error?.message || 'Sync failed — please try again.'));
          }
        });
      });
      this._userId = res.user_id;
      this._token = res.access_token;
      // Attach real-time timeline event listener
      this._setupTimelineListener();
      // Persist session to localStorage so it survives page refresh, tab close, and browser restart
      try {
        localStorage.setItem('khora_session', JSON.stringify({
          homeserver: baseUrl,
          accessToken: res.access_token,
          userId: res.user_id,
          deviceId: res.device_id
        }));
      } catch {}
      // Cache encrypted session metadata in the encrypted vault
      try {
        await KhoraEncryptedCache.put('session', 'current', {
          userId: res.user_id,
          homeserver: baseUrl,
          deviceId: res.device_id,
          ts: Date.now()
        });
      } catch {}
      return {
        userId: res.user_id
      };
    } else {
      const baseUrlFallback = homeserver.startsWith('http') ? homeserver : `https://${homeserver}`;
      const resp = await this._api('POST', '/login', {
        type: 'm.login.password',
        user,
        password: pass
      }, true);
      this._token = resp.access_token;
      this._userId = resp.user_id;
      // Persist session to localStorage so it survives page refresh (non-SDK path)
      try {
        localStorage.setItem('khora_session', JSON.stringify({
          homeserver: baseUrlFallback,
          accessToken: resp.access_token,
          userId: resp.user_id,
          deviceId: resp.device_id || 'fallback'
        }));
      } catch {}
      return {
        userId: resp.user_id
      };
    }
  }

  // DES(matrix.session, {check: whoami}) — token_validation → INS(matrix.client, {valid_token}) — reconnection | NUL(matrix.session, {reason: expired}) — destruction
  async restoreSession() {
    const raw = localStorage.getItem('khora_session');
    if (!raw) return null;
    let saved;
    try {
      saved = JSON.parse(raw);
    } catch {
      localStorage.removeItem('khora_session');
      return null;
    }
    const {
      homeserver,
      accessToken,
      userId,
      deviceId
    } = saved;
    if (!homeserver || !accessToken || !userId || !deviceId) return null;

    // Step 1: Validate token with the homeserver (lightweight /whoami check)
    // Retry transient network failures with exponential backoff before giving up
    let tokenValid = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const resp = await fetch(`${homeserver}/_matrix/client/v3/account/whoami`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (resp.ok) {
          tokenValid = true;
          break;
        }
        if (resp.status === 401 || resp.status === 403) {
          // Token expired or revoked — clear saved session, require fresh login
          console.warn('Session token expired or revoked (HTTP ' + resp.status + ')');
          localStorage.removeItem('khora_session');
          return {
            expired: true
          };
        }
        // Server error (5xx) — treat as transient, retry
        if (resp.status >= 500) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        // Other client error — don't retry
        break;
      } catch (e) {
        // Network error (offline, DNS failure, etc.) — retry with backoff
        console.warn('Session restore network error (attempt ' + (attempt + 1) + '):', e.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        // All retries exhausted — keep the saved session intact for next app load
        // but return a network error so the UI can offer retry
        return {
          networkError: true,
          message: e.message
        };
      }
    }
    if (!tokenValid) {
      // Retries exhausted on server errors — preserve session for next load
      return {
        networkError: true,
        message: 'Server unavailable'
      };
    }

    // Step 2: Token is valid — initialize the Matrix client and sync
    try {
      this._baseUrl = homeserver;
      await LocalVaultCrypto.deriveKey(userId, accessToken, deviceId);
      if (typeof matrixcs !== 'undefined') {
        this.client = matrixcs.createClient({
          baseUrl: homeserver,
          accessToken,
          userId,
          deviceId
        });
        try {
          await this.client.initCrypto();
        } catch (e) {
          console.warn('Crypto:', e.message);
        }
        await this.client.startClient({
          initialSyncLimit: 30
        });
        await new Promise((resolve, reject) => {
          if (this.client.isInitialSyncComplete()) return resolve();
          const timeout = setTimeout(() => reject(new Error('Sync timed out')), 90000);
          this.client.on('sync', (state, prev, data) => {
            if (state === 'PREPARED') {
              clearTimeout(timeout);
              resolve();
            } else if (state === 'ERROR') {
              clearTimeout(timeout);
              reject(new Error(data?.error?.message || 'Sync failed'));
            }
          });
        });
      }
      this._userId = userId;
      this._token = accessToken;
      // Attach real-time timeline event listener
      this._setupTimelineListener();
      return {
        userId
      };
    } catch (e) {
      console.warn('Session restore sync failed:', e.message);
      // Sync failure after valid token — keep session, allow retry
      // Clean up partial client state but preserve localStorage
      if (this.client) {
        try {
          this.client.stopClient();
        } catch {}
      }
      this.client = null;
      this._token = null;
      this._userId = null;
      LocalVaultCrypto.clear();
      return {
        networkError: true,
        message: e.message
      };
    }
  }
  get userId() {
    return this._userId;
  }
  get hasCrypto() {
    return this.client && typeof this.client.isCryptoEnabled === 'function' && this.client.isCryptoEnabled();
  }
  async _api(method, path, body, noAuth) {
    const url = `${this._baseUrl}/_matrix/client/v3${path}`;
    const h = {
      'Content-Type': 'application/json'
    };
    if (!noAuth) h['Authorization'] = `Bearer ${this._token}`;
    const opts = {
      method,
      headers: h
    };
    if (body) opts.body = JSON.stringify(body);
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = await fetch(url, opts);
      if (r.status === 429) {
        const err = await r.json().catch(() => ({}));
        const wait = Math.min(err.retry_after_ms || 1000 * Math.pow(2, attempt), 16000);
        await new Promise(res => setTimeout(res, wait));
        continue;
      }
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `API ${r.status}`);
      }
      return r.json();
    }
    throw new Error('Rate limited — too many requests. Please try again.');
  }

  // INS(matrix.room, {e2ee, state}) — room_creation — Megolm encryption enabled by default
  async createRoom(name, topic, extraState = []) {
    const initial_state = [{
      type: 'm.room.encryption',
      state_key: '',
      content: {
        algorithm: 'm.megolm.v1.aes-sha2'
      }
    }, ...extraState];
    if (this.client) {
      const r = await this._withRetry(() => this.client.createRoom({
        name,
        topic,
        visibility: 'private',
        preset: 'private_chat',
        initial_state
      }));
      return r.room_id;
    } else {
      const r = await this._api('POST', '/createRoom', {
        name,
        topic,
        visibility: 'private',
        preset: 'private_chat',
        initial_state
      });
      return r.room_id;
    }
  }

  // INS(matrix.bridge_room, {power_levels}) — client_sovereign_creation — client PL 100, provider PL 50
  async createClientRoom(name, topic, extraState = [], clientMatrixId = null) {
    const initial_state = [{
      type: 'm.room.encryption',
      state_key: '',
      content: {
        algorithm: 'm.megolm.v1.aes-sha2'
      }
    }, ...extraState];
    const opts = {
      name,
      topic,
      visibility: 'private',
      preset: 'private_chat',
      initial_state
    };
    // If we know the client's Matrix ID, pre-set them as room admin (PL 100)
    // Provider gets PL 50 — client can kick provider but not vice versa.
    // We must explicitly set `events` to override the preset defaults (which require
    // PL 100 for m.room.encryption etc.) — otherwise initial_state events fail
    // because the provider only has PL 50.
    if (clientMatrixId) {
      opts.power_level_content_override = {
        users: {
          [this._userId]: 50,
          [clientMatrixId]: 100
        },
        events_default: 0,
        state_default: 50,
        events: {
          'm.room.power_levels': 100,
          'm.room.tombstone': 100,
          'm.room.server_acl': 100
        },
        kick: 50,
        ban: 50,
        invite: 50,
        redact: 50
      };
    }
    if (this.client) {
      const r = await this._withRetry(() => this.client.createRoom(opts));
      return r.room_id;
    } else {
      const r = await this._api('POST', '/createRoom', opts);
      return r.room_id;
    }
  }
  async setPowerLevel(roomId, userId, level) {
    if (this.client) {
      const room = this.client.getRoom(roomId);
      if (room) {
        const plEvent = room.currentState.getStateEvents('m.room.power_levels', '');
        const content = plEvent ? {
          ...plEvent.getContent()
        } : {};
        content.users = {
          ...(content.users || {}),
          [userId]: level
        };
        await this._withRetry(() => this.client.sendStateEvent(roomId, 'm.room.power_levels', content, ''));
      }
    } else {
      let current;
      try {
        current = await this._api('GET', `/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`);
      } catch {
        current = {};
      }
      current.users = {
        ...(current.users || {}),
        [userId]: level
      };
      await this._api('PUT', `/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`, current);
    }
  }
  async getState(roomId, type, sk = '') {
    if (this.client) {
      const room = this.client.getRoom(roomId);
      if (!room) return null;
      const ev = room.currentState.getStateEvents(type, sk);
      return ev ? ev.getContent() : null;
    }
    try {
      return await this._api('GET', `/rooms/${encodeURIComponent(roomId)}/state/${type}/${sk}`);
    } catch {
      return null;
    }
  }

  // ALT(matrix.room_state, {state_event}) — protocol_mutation — write state to Matrix room
  async setState(roomId, type, content, sk = '') {
    if (this.client) {
      await this._withRetry(() => this.client.sendStateEvent(roomId, type, content, sk));
    } else {
      await this._api('PUT', `/rooms/${encodeURIComponent(roomId)}/state/${type}/${sk}`, content);
    }
  }

  // INS(matrix.timeline_event, {room}) — event_emission — with crypto fallback for E2EE errors
  async sendEvent(roomId, type, content) {
    if (this.client) {
      try {
        await this._withRetry(() => this.client.sendEvent(roomId, type, content));
      } catch (e) {
        // Fallback to REST API if SDK sendEvent fails (e.g. crypto/encryption errors)
        const msg = (e?.message || '').toLowerCase();
        if (msg.includes('encrypt') || msg.includes('olm') || msg.includes('megolm') || msg.includes('crypto') || msg.includes('unknown devices') || msg.includes('no olm')) {
          console.warn('sendEvent crypto fallback for', type, ':', e.message);
          const txn = 'txn_' + Date.now() + Math.random().toString(36).slice(2);
          await this._api('PUT', `/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(type)}/${txn}`, content);
        } else {
          throw e;
        }
      }
    } else {
      const txn = 'txn_' + Date.now() + Math.random().toString(36).slice(2);
      await this._api('PUT', `/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(type)}/${txn}`, content);
    }
  }
  async sendMessage(roomId, body, extra = {}) {
    const content = {
      msgtype: 'm.text',
      body,
      ...extra,
      timestamp: Date.now()
    };
    if (this.client) {
      await this._withRetry(() => this.client.sendMessage(roomId, content));
    } else {
      const txn = 'txn_' + Date.now() + Math.random().toString(36).slice(2);
      await this._api('PUT', `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txn}`, content);
    }
  }
  async getMessages(roomId, limit = 40) {
    if (this.client) {
      const room = this.client.getRoom(roomId);
      if (!room) return [];
      // Paginate backwards to capture historical messages beyond the live sync window
      try {
        for (let i = 0; i < 3; i++) {
          const canPaginate = room.getLiveTimeline().getPaginationToken('b');
          if (!canPaginate) break;
          await this.client.scrollback(room, limit);
        }
      } catch (e) {/* pagination may fail — continue with available events */}
      const seenIds = new Set();
      const allMsgs = [];
      const timelineSets = room.getTimelineSets ? room.getTimelineSets() : [];
      if (timelineSets.length > 0) {
        for (const ts of timelineSets) {
          for (const tl of ts.getTimelines()) {
            for (const ev of tl.getEvents()) {
              if (ev.getType() === 'm.room.message' && !seenIds.has(ev.getId())) {
                seenIds.add(ev.getId());
                allMsgs.push({
                  id: ev.getId(),
                  sender: ev.getSender(),
                  content: ev.getContent(),
                  ts: ev.getTs()
                });
              }
            }
          }
        }
      } else {
        for (const ev of room.getLiveTimeline().getEvents()) {
          if (ev.getType() === 'm.room.message') {
            allMsgs.push({
              id: ev.getId(),
              sender: ev.getSender(),
              content: ev.getContent(),
              ts: ev.getTs()
            });
          }
        }
      }
      return allMsgs.sort((a, b) => a.ts - b.ts).slice(-limit).reverse();
    }
    const d = await this._api('GET', `/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=${limit}`);
    return (d.chunk || []).filter(e => e.type === 'm.room.message').map(e => ({
      id: e.event_id,
      sender: e.sender,
      content: e.content,
      ts: e.origin_server_ts
    }));
  }
  async invite(roomId, userId) {
    if (this.client) {
      await this.client.invite(roomId, userId);
    } else {
      await this._api('POST', `/rooms/${encodeURIComponent(roomId)}/invite`, {
        user_id: userId
      });
    }
  }
  async kick(roomId, userId, reason = 'Removed') {
    if (this.client) {
      await this.client.kick(roomId, userId, reason);
    } else {
      await this._api('POST', `/rooms/${encodeURIComponent(roomId)}/kick`, {
        user_id: userId,
        reason
      });
    }
  }
  async tombstone(roomId, newRoomId) {
    await this.setState(roomId, 'm.room.tombstone', {
      body: 'This room has been replaced',
      replacement_room: newRoomId
    });
  }
  async getJoinedRooms() {
    if (this.client) return this.client.getRooms().map(r => r.roomId);
    const d = await this._api('GET', '/joined_rooms');
    return d.joined_rooms || [];
  }
  async getRoomMembers(roomId) {
    if (this.client) {
      const room = this.client.getRoom(roomId);
      return room ? room.getJoinedMembers().map(m => ({
        userId: m.userId,
        name: m.name
      })) : [];
    }
    try {
      const d = await this._api('GET', `/rooms/${encodeURIComponent(roomId)}/joined_members`);
      return Object.keys(d.joined || {}).map(id => ({
        userId: id,
        name: d.joined[id]?.display_name || id
      }));
    } catch {
      return [];
    }
  }

  // DES(matrix.room_topology, {via: sync_state}) — room_classification — read-only scan, caches to encrypted IDB
  // Batch-fetch all Khora state across joined rooms in a single request.
  // When the SDK is available, reads local sync state (no HTTP calls).
  // When using the API fallback, uses /sync with a tight filter — one request
  // instead of 2*N individual getState calls that produce 404s for non-Khora rooms.
  // Returns: { [roomId]: { [eventType]: content } }
  // Results are cached in the encrypted local vault (KhoraEncryptedCache).
  async scanRooms(extraTypes = []) {
    const types = [EVT.IDENTITY, EVT.BRIDGE_META, EVT.BRIDGE_REFS, ...extraTypes];
    if (this.client) {
      const result = {};
      for (const room of this.client.getRooms()) {
        const state = {};
        for (const type of types) {
          const ev = room.currentState.getStateEvents(type, '');
          if (ev) state[type] = ev.getContent();
        }
        if (Object.keys(state).length > 0) result[room.roomId] = state;
      }
      // Persist room state to encrypted local cache
      try {
        await KhoraEncryptedCache.put('rooms', 'scan_result', {
          data: result,
          ts: Date.now()
        });
      } catch {}
      return result;
    }
    // Fallback: single /sync with filter — avoids per-room 404 spam
    const filter = JSON.stringify({
      room: {
        state: {
          types
        },
        timeline: {
          limit: 0
        },
        ephemeral: {
          types: []
        }
      },
      presence: {
        types: []
      },
      account_data: {
        types: []
      }
    });
    try {
      const data = await this._api('GET', `/sync?filter=${encodeURIComponent(filter)}&timeout=0`);
      const result = {};
      const joined = data?.rooms?.join || {};
      for (const [roomId, roomData] of Object.entries(joined)) {
        const events = roomData?.state?.events || [];
        const state = {};
        for (const ev of events) {
          if (ev.state_key === '') state[ev.type] = ev.content;
        }
        if (Object.keys(state).length > 0) result[roomId] = state;
      }
      return result;
    } catch (e) {
      console.warn('scanRooms sync fallback failed, falling back to per-room scan:', e.message);
      // Last resort: per-room scan (original behavior)
      const rooms = await this.getJoinedRooms();
      const result = {};
      for (const rid of rooms) {
        try {
          const allState = await this._api('GET', `/rooms/${encodeURIComponent(rid)}/state`);
          const state = {};
          for (const ev of allState) {
            if (ev.state_key === '' && types.includes(ev.type)) state[ev.type] = ev.content;
          }
          if (Object.keys(state).length > 0) result[rid] = state;
        } catch {/* skip rooms we can't read */}
      }
      return result;
    }
  }

  // NUL(matrix.legacy_idb, {targets: store_names}) — security_cleanup
  // Purge unencrypted IndexedDB databases created by the Matrix SDK sync layer
  // or legacy application caches. Preserves crypto stores (Olm/Megolm key material
  // needed for E2EE continuity) and our own encrypted vault.
  async _purgeUnencryptedStores() {
    if (typeof indexedDB?.databases === 'function') {
      try {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          // Keep our encrypted vault and any crypto key stores
          if (db.name && db.name !== KhoraEncryptedCache.DB_NAME && !db.name.includes('crypto')) {
            try {
              indexedDB.deleteDatabase(db.name);
            } catch {}
          }
        }
      } catch (e) {
        console.warn('IndexedDB purge:', e.message);
      }
    }
    // Explicitly target known unencrypted sync/state databases by name
    for (const name of ['amino', 'matrix-js-sdk:default', 'matrix-js-sdk:riot-web-sync', 'matrix-js-sdk:web-sync']) {
      try {
        indexedDB.deleteDatabase(name);
      } catch {}
    }
  }

  // NUL(matrix.session+keys+cache, {reason: logout}) — full_teardown — destroys all local state
  async logout() {
    if (this.client) {
      this.client.stopClient();
      try {
        await this.client.logout();
      } catch {}
    }
    this.client = null;
    this._token = null;
    this._userId = null;
    // NUL(crypto.vault_key, {reason: logout}) — key_destruction — local encrypted data becomes unreadable
    LocalVaultCrypto.clear();
    // Wipe encrypted local cache and close database connection
    try {
      await KhoraEncryptedCache.clear();
      KhoraEncryptedCache.close();
    } catch {}
    // Purge any remaining unencrypted databases
    try {
      await this._purgeUnencryptedStores();
    } catch {}
  }

  // Scan invited rooms — returns rooms the user has been invited to but hasn't joined.
  // Uses invite state from /sync (SDK) or invite section of sync response (API).
  async scanInvitedRooms(types = [EVT.IDENTITY]) {
    if (this.client) {
      const result = {};
      for (const room of this.client.getRooms()) {
        const membership = room.getMyMembership();
        if (membership !== 'invite') continue;
        const state = {};
        for (const type of types) {
          const ev = room.currentState.getStateEvents(type, '');
          if (ev) state[type] = ev.getContent();
        }
        if (Object.keys(state).length > 0) result[room.roomId] = state;
      }
      return result;
    }
    // API fallback: /sync includes invite section with stripped state
    const filter = JSON.stringify({
      room: {
        state: {
          types
        },
        timeline: {
          limit: 0
        },
        ephemeral: {
          types: []
        }
      },
      presence: {
        types: []
      },
      account_data: {
        types: []
      }
    });
    try {
      const data = await this._api('GET', `/sync?filter=${encodeURIComponent(filter)}&timeout=0`);
      const result = {};
      const invited = data?.rooms?.invite || {};
      for (const [roomId, roomData] of Object.entries(invited)) {
        const events = roomData?.invite_state?.events || [];
        const state = {};
        for (const ev of events) {
          if (ev.state_key === '' && types.includes(ev.type)) state[ev.type] = ev.content;
        }
        if (Object.keys(state).length > 0) result[roomId] = state;
      }
      return result;
    } catch {
      return {};
    }
  }
  async joinRoom(roomId) {
    if (this.client) {
      await this._withRetry(() => this.client.joinRoom(roomId));
    } else {
      await this._api('POST', `/join/${encodeURIComponent(roomId)}`, {});
    }
  }
}
const svc = new KhoraService();
const WEBHOOK_BASE = 'https://n8n.intelechia.com/webhook';

/* ═══════════════════ DOMAIN CONFIG (§C.0) ═══════════════════
 * Operator Manifest:
 *   DES — pure designation. Forms, interpretations, transforms, vault fields,
 *         roles, relationship types, terminology. All are vocabulary definitions.
 *
 * Triad Summary:
 *   Existence:       DES (naming forms, fields, authorities, roles)
 *   Structure:       —
 *   Interpretation:  —
 *   No mutations here. DOMAIN_CONFIG is the interpretive frame that other modules
 *   reference. All actual INS/ALT/CON/REC operations happen elsewhere using
 *   these designations. Changing DOMAIN_CONFIG changes the vocabulary itself —
 *   which is a meta-level REC, but not one performed by code at runtime.
 *
 * All domain-specific content is consolidated here. To adapt Tessera for a
 * different sector, replace the contents of DOMAIN_CONFIG — the application
 * logic, encryption model, bridge topology, and EO operator layer are all
 * domain-agnostic.
 * ═══════════════════════════════════════════════════════════════════════════ */
