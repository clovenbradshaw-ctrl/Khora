/* ═══════════════════ MATRIX SERVICE ═══════════════════
 * Operator Manifest:
 *   INS(matrix.room, {e2ee, state}) — room_creation                   — createRoom
 *   INS(matrix.bridge_room, {power_levels}) — client_sovereign_creation — createClientRoom
 *   ALT(matrix.room_state, {state_event}) — protocol_mutation         — setState
 *   INS(matrix.timeline_event, {room}) — event_emission               — sendEvent
 *   DES(matrix.room_topology, {via: sync_state}) — room_classification — scanRooms
 *
 * Triad Summary:
 *   Existence:       INS (room creation, event emission)
 *   Structure:       CON (room membership, power levels)
 *   Interpretation:  ALT (state events), DES (room classification)
 *   No REC — KhoraService is a transport layer; it never reinterprets data.
 *
 * Auth operations (login, restoreSession, logout) live in auth.js (KhoraAuth).
 * KhoraService delegates identity and client access to KhoraAuth via getters.
 * ═══════════════════════════════════════════════════════════ */
class KhoraService {
  // ── Delegation to KhoraAuth (backward-compatible interface) ──
  // All 254+ svc.userId references across the codebase continue working.
  get client() { return KhoraAuth.client; }
  get userId() { return KhoraAuth.userId; }
  get _token() { return KhoraAuth.token; }
  get _baseUrl() { return KhoraAuth.baseUrl; }

  get hasCrypto() {
    return this.client && typeof this.client.isCryptoEnabled === 'function' && this.client.isCryptoEnabled();
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
      throw new Error('Cannot create room — Matrix SDK is not initialized. E2EE is required.');
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
          [this.userId]: 50,
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
      throw new Error('Cannot create room — Matrix SDK is not initialized. E2EE is required.');
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

  // Check if a room has encryption enabled — used to block unencrypted sends
  _isRoomEncrypted(roomId) {
    if (this.client) {
      const room = this.client.getRoom(roomId);
      return room ? room.hasEncryptionStateEvent() : true; // default to encrypted (safe assumption)
    }
    return true; // Assume encrypted when we can't check (safe default)
  }

  // INS(matrix.timeline_event, {room}) — event_emission — never falls back to unencrypted
  async sendEvent(roomId, type, content) {
    if (this.client) {
      // Guard: refuse to send if room is encrypted but crypto is not available
      if (!this.hasCrypto && this._isRoomEncrypted(roomId)) {
        throw new Error('Cannot send to encrypted room — E2EE is not initialized. Please reload the app.');
      }
      try {
        await this._withRetry(() => this.client.sendEvent(roomId, type, content));
      } catch (e) {
        // On crypto errors: retry once via the SDK (which handles encryption).
        // NEVER fall back to the REST API — that bypasses Megolm and sends plaintext.
        const msg = (e?.message || '').toLowerCase();
        const isCryptoError = msg.includes('encrypt') || msg.includes('olm') || msg.includes('megolm') || msg.includes('crypto') || msg.includes('unknown devices') || msg.includes('no olm');
        if (isCryptoError) {
          console.warn('sendEvent: encryption error, retrying via SDK:', e.message);
          await new Promise(r => setTimeout(r, 1500));
          await this._withRetry(() => this.client.sendEvent(roomId, type, content));
        } else {
          throw e;
        }
      }
    } else {
      throw new Error('Cannot send event — Matrix SDK is not initialized. E2EE is required.');
    }
  }
  async sendMessage(roomId, body, extra = {}, replyTo = null) {
    const content = {
      msgtype: 'm.text',
      body,
      ...extra,
      timestamp: Date.now()
    };
    if (replyTo && replyTo.id) {
      const quoteLine = (replyTo.body || '').split('\n')[0];
      content.body = `> <${replyTo.sender}> ${quoteLine}\n\n${body}`;
      content.format = 'org.matrix.custom.html';
      const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      content.formatted_body = `<mx-reply><blockquote><a href="https://matrix.to/#/${replyTo.sender}">${replyTo.sender}</a><br/>${esc(replyTo.body)}</blockquote></mx-reply>${esc(body)}`;
      content['m.relates_to'] = { 'm.in_reply_to': { event_id: replyTo.id } };
    }
    if (this.client) {
      // Guard: refuse to send if room is encrypted but crypto is not available
      if (!this.hasCrypto && this._isRoomEncrypted(roomId)) {
        throw new Error('Cannot send message to encrypted room — E2EE is not initialized. Please reload the app.');
      }
      try {
        await this._withRetry(() => this.client.sendMessage(roomId, content));
      } catch (e) {
        // On crypto errors: retry once via the SDK (preserves encryption).
        const msg = (e?.message || '').toLowerCase();
        const isCryptoError = msg.includes('encrypt') || msg.includes('olm') || msg.includes('megolm') || msg.includes('crypto') || msg.includes('unknown devices') || msg.includes('no olm');
        if (isCryptoError) {
          console.warn('sendMessage: encryption error, retrying via SDK:', e.message);
          await new Promise(r => setTimeout(r, 1500));
          await this._withRetry(() => this.client.sendMessage(roomId, content));
        } else {
          throw e;
        }
      }
    } else {
      throw new Error('Cannot send message — Matrix SDK is not initialized. E2EE is required.');
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
