/* ═══════════════════ BACKUP MODULE (Filen-backed encrypted cloud backup) ═══════════════════
 * Self-contained backup engine — all crypto, Filen API auth, file operations, and Pool Bridge
 * logic live here. No UI/DOM code; the React views in provider.js and client.js consume this.
 *
 * Public interface (stable contract):
 *   KhoraBackup.isConnected        — boolean, true when authenticated to Filen
 *   KhoraBackup.identity           — current Matrix ID used for backup, or null
 *   KhoraBackup.email              — current backup email, or null
 *   KhoraBackup.storage            — {used, max, available} in bytes
 *   KhoraBackup.canBridge          — boolean, true if paid account (can create public links)
 *   KhoraBackup.bridgeSettings     — {enabled, capacity_gb, enabled_at} or null
 *
 *   KhoraBackup.connectWithPassword(email, pw) → true | false (login with user password)
 *   KhoraBackup.registerWithPassword(email, pw) → 'needs_confirmation' | throws
 *   KhoraBackup.disconnect()               → void
 *   KhoraBackup.autoConnect()              → true | false (room data first, then legacy)
 *   KhoraBackup.saveCredsToRoom(email, pw) → true | false (encrypt + store in room state)
 *   KhoraBackup.loadCredsFromRoom()        → {email, password} | null
 *
 *   KhoraBackup.uploadFile(file, folder?)  → {uuid, fileKey, bucket, region, chunks}
 *   KhoraBackup.uploadJSON(data, filename, folder?)  → upload result
 *   KhoraBackup.uploadAndLink(file, folder?)         → public URL string
 *   KhoraBackup.uploadBufferAndLink(buffer, filename, folder?) → public URL string
 *   KhoraBackup.deleteFile(folder, filename)          → true | false
 *   KhoraBackup.listFolder(folderUUID?)               → {folders:[], files:[]}
 *   KhoraBackup.downloadFile(uuid)                    → {data: Uint8Array, name, mime}
 *   KhoraBackup.ensureFolder(name, parent?)           → folderUUID
 *   KhoraBackup.resendConfirmation()                  → void
 *
 *   KhoraBackup.enableBridge(capacityGB)   → void
 *   KhoraBackup.disableBridge()            → void
 *
 *   KhoraBackup.addListener(fn)            → void (called with {event, ...data})
 *   KhoraBackup.removeListener(fn)         → void
 *
 * Events emitted via listeners:
 *   {event:'connected', matrixId, email}
 *   {event:'disconnected'}
 *   {event:'upload_complete', filename, folder}
 *   {event:'backup_complete', type, filename}
 *   {event:'error', message}
 *   {event:'bridge_enabled', capacity_gb}
 *   {event:'bridge_disabled'}
 *
 * Operator Manifest:
 *   INS(backup.session, {filen_auth}) — backup_authentication
 *   INS(backup.file, {encrypted_upload}) — content_backup
 *   DES(backup.file, {trash}) — content_deletion
 *   NUL(backup.session, {disconnect}) — backup_teardown
 *   ALT(backup.bridge, {enable|disable}) — network_contribution
 *
 * Triad Summary:
 *   Existence:       INS (connect, upload), NUL (disconnect, delete)
 *   Structure:       —
 *   Interpretation:  ALT (encrypt/decrypt at rest, bridge toggle)
 * ═══════════════════════════════════════════════════════════════════════════════ */

const KhoraBackup = (() => {
  // ── Constants ──
  const GW = 'https://gateway.filen.io';
  const EGEST = ['https://egest.filen.io','https://egest.filen.net','https://egest.filen-1.net','https://egest.filen-2.net','https://egest.filen-3.net','https://egest.filen-4.net','https://egest.filen-5.net','https://egest.filen-6.net'];
  const INGEST = ['https://ingest.filen.io','https://ingest.filen.net','https://ingest.filen-1.net','https://ingest.filen-2.net','https://ingest.filen-3.net','https://ingest.filen-4.net','https://ingest.filen-5.net','https://ingest.filen-6.net'];
  const CHUNK = 1048576;
  const APP_SALT = 'khora-matrix-backup-bridge-v1';
  const te = new TextEncoder(), td = new TextDecoder();

  // ── Internal state ──
  let S = { apiKey: null, masterKeys: [], baseFolderUUID: null, email: null, matrixId: null, filenPassword: null, canCreateLinks: false, maxStorage: 0, usedStorage: 0 };
  const listeners = [];

  // ── Helpers ──
  const hex = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  const unhex = h => { const a = new Uint8Array(h.length / 2); for (let i = 0; i < h.length; i += 2) a[i / 2] = parseInt(h.substr(i, 2), 16); return a; };
  const b64e = b => { let s = ''; const a = new Uint8Array(b); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); };
  const b64d = s => { const b = atob(s); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  const rHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const fmtSize = b => { if (!b) return '0 B'; const u = ['B','KB','MB','GB','TB']; const i = Math.floor(Math.log(b) / Math.log(1024)); return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i]; };

  const emit = data => { for (const fn of listeners) { try { fn(data); } catch (e) { console.warn('KhoraBackup listener error:', e); } } };

  // ── Crypto ──
  async function pbkdf2Bits(pw, salt, iter, hash, bits) {
    const km = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: te.encode(salt), iterations: iter, hash }, km, bits);
  }
  async function sha512(s) { return hex(await crypto.subtle.digest('SHA-512', te.encode(s))); }
  async function deriveFilenPassword(matrixId) { return hex(await pbkdf2Bits(matrixId, APP_SALT, 100000, 'SHA-512', 256)); }
  async function deriveLoginAndMaster(raw, salt, ver) {
    if (ver !== 2) throw new Error('Auth v' + ver + ' unsupported');
    const dk = hex(await pbkdf2Bits(raw, salt, 200000, 'SHA-512', 512));
    return { masterKey: dk.substring(0, dk.length / 2), loginPassword: await sha512(dk.substring(dk.length / 2)) };
  }
  async function aesKey(key, use) {
    const km = await crypto.subtle.importKey('raw', te.encode(key), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: te.encode(key), iterations: 1, hash: 'SHA-512' }, km, 256);
    return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, use);
  }
  async function metaEnc(data, key) {
    const k = await aesKey(key, ['encrypt']); const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, k, te.encode(typeof data === 'string' ? data : JSON.stringify(data)));
    return '002' + td.decode(iv) + b64e(ct);
  }
  async function metaDec(meta, key) {
    try { if (!meta || meta.startsWith('U2FsdGVk') || meta.substring(0, 3) !== '002') return null;
    const iv = te.encode(meta.substring(3, 15)); const ct = b64d(meta.substring(15));
    const k = await aesKey(key, ['decrypt']);
    return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, k, ct)); } catch { return null; }
  }
  async function decMeta(meta) {
    for (let i = S.masterKeys.length - 1; i >= 0; i--) { const r = await metaDec(meta, S.masterKeys[i]); if (r) { try { return JSON.parse(r); } catch { return r; } } } return null;
  }
  async function aesKeyFromFileKey(fk, use) {
    const kb = te.encode(fk); const km = await crypto.subtle.importKey('raw', kb, 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: kb, iterations: 1, hash: 'SHA-512' }, km, 256);
    return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, use);
  }
  async function decryptChunk(buf, fileKey) {
    const a = new Uint8Array(buf);
    if (td.decode(a.slice(0, 3)) === '002') { const iv = a.slice(3, 15), ct = a.slice(15); const k = await aesKeyFromFileKey(fileKey, ['decrypt']); return crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, k, ct); }
    const iv = a.slice(0, 12), ct = a.slice(12); const raw = te.encode(fileKey); const kb = raw.length >= 32 ? raw.slice(0, 32) : raw;
    const k = await crypto.subtle.importKey('raw', kb, 'AES-GCM', false, ['decrypt']);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, k, ct);
  }
  async function encryptChunk(chunk, fileKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); const k = await aesKeyFromFileKey(fileKey, ['encrypt']);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, k, chunk);
    const out = new Uint8Array(3 + 12 + ct.byteLength); out.set(te.encode('002'), 0); out.set(iv, 3); out.set(new Uint8Array(ct), 15); return out;
  }

  // ── Filen API ──
  async function apiPost(path, body, auth = true) {
    const h = { 'Content-Type': 'application/json' }; if (auth && S.apiKey) h['Authorization'] = `Bearer ${S.apiKey}`;
    return (await fetch(`${GW}/v3${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).json();
  }
  async function apiGet(path) { const h = {}; if (S.apiKey) h['Authorization'] = `Bearer ${S.apiKey}`; return (await fetch(`${GW}/v3${path}`, { headers: h })).json(); }

  // ── Auth internals ──
  async function tryLogin(email, rawPassword) {
    try {
      const ai = await apiPost('/auth/info', { email }, false); if (!ai.status) return false;
      const { masterKey, loginPassword } = await deriveLoginAndMaster(rawPassword, ai.data.salt, ai.data.authVersion);
      const lr = await apiPost('/login', { email, password: loginPassword, twoFactorCode: 'XXXXXX', authVersion: ai.data.authVersion }, false);
      // Detect 2FA requirement — Filen returns status:false with a 2FA-related message
      if (!lr.status) {
        const msg = (lr.message || '').toLowerCase();
        if (msg.includes('two') || msg.includes('2fa') || msg.includes('factor') || msg.includes('otp')) {
          console.warn('Filen account requires 2FA — not yet supported by Khora backup integration');
        }
        return false;
      }
      S.apiKey = lr.data.apiKey; S.email = email; S.masterKeys = [masterKey];
      try { const emk = await metaEnc(masterKey, masterKey); const mkr = await apiPost('/user/masterKeys', { masterKeys: emk }); if (mkr.status && mkr.data?.keys) { const dk = await metaDec(mkr.data.keys, masterKey); if (dk) S.masterKeys = dk.split('|').filter(Boolean); } } catch {}
      const bf = await apiGet('/user/baseFolder'); if (!bf.status) throw new Error('Base folder failed'); S.baseFolderUUID = bf.data.uuid;
      try { const acc = await apiGet('/user/account'); if (acc.status) { S.usedStorage = acc.data.storageUsed || 0; S.maxStorage = acc.data.maxStorage || 0; S.canCreateLinks = S.maxStorage > 11 * 1024 * 1024 * 1024; } } catch {}
      return true;
    } catch { return false; }
  }
  async function tryRegister(email, rawPassword) {
    try {
      const salt = rHex(64); const { masterKey, loginPassword } = await deriveLoginAndMaster(rawPassword, salt, 2);
      const r = await apiPost('/register', { email, password: loginPassword, salt, authVersion: 2 }, false);
      if (r.status) return 'registered';
      const msg = (r.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) return 'exists_unconfirmed';
      return r.message || 'Registration failed';
    } catch (e) { return e.message; }
  }

  // ── Credential persistence ──
  // Security: use sessionStorage for backup creds (email/matrixId pairing) — clears on tab close
  function saveCreds(m, e) { try { sessionStorage.setItem('khora_backup_creds', JSON.stringify({ matrixId: m, email: e, ts: Date.now() })); try { localStorage.removeItem('khora_backup_creds'); } catch {} } catch {} }
  function loadCreds() { try { return JSON.parse(sessionStorage.getItem('khora_backup_creds')) || JSON.parse(localStorage.getItem('khora_backup_creds')); } catch { return null; } }
  function clearCreds() { try { sessionStorage.removeItem('khora_backup_creds'); localStorage.removeItem('khora_backup_creds'); sessionStorage.removeItem('khora_backup_seen'); localStorage.removeItem('khora_backup_seen'); } catch {} }
  function hasSeenRecovery() { try { return (sessionStorage.getItem('khora_backup_seen') || localStorage.getItem('khora_backup_seen')) === '1'; } catch { return false; } }
  function markRecoverySeen() { try { sessionStorage.setItem('khora_backup_seen', '1'); } catch {} }

  // ── Room-based credential persistence (encrypted) ──
  // Encrypt the Filen password using a key derived from the Matrix ID before storing in room state
  async function encryptForRoom(plaintext, matrixId) {
    const keyData = await pbkdf2Bits(matrixId, 'khora-backup-room-creds-v1', 100000, 'SHA-256', 256);
    const key = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, te.encode(plaintext));
    return { ct: b64e(ct), iv: b64e(iv) };
  }
  async function decryptFromRoom(envelope, matrixId) {
    try {
      const keyData = await pbkdf2Bits(matrixId, 'khora-backup-room-creds-v1', 100000, 'SHA-256', 256);
      const key = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['decrypt']);
      const ct = b64d(envelope.ct), iv = b64d(envelope.iv);
      return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ct));
    } catch { return null; }
  }

  // Find the user's owned room (vault for client, roster for provider)
  async function findOwnedRoom() {
    try {
      const scanned = await svc.scanRooms([]);
      for (const [rid, state] of Object.entries(scanned || {})) {
        const id = state?.[EVT.IDENTITY];
        if (id?.owner === svc.userId && (id.account_type === 'client' || id.account_type === 'provider')) return rid;
      }
    } catch {}
    return null;
  }

  // ── Pool Bridge persistence ──
  function savePoolBridgeSettings(enabled, capacityGB) { try { localStorage.setItem('khora_backup_bridge', JSON.stringify({ enabled, capacity_gb: capacityGB, enabled_at: enabled ? new Date().toISOString() : null, ts: Date.now() })); } catch {} }
  function loadPoolBridgeSettings() { try { return JSON.parse(localStorage.getItem('khora_backup_bridge')); } catch { return null; } }

  // ── File operations ──
  async function ensureFolderInternal(name, parent) {
    parent = parent || S.baseFolderUUID; const nh = await sha512(name.toLowerCase());
    const exists = await apiPost('/dir/exists', { parent, nameHashed: nh });
    if (exists.status && exists.data?.exists && exists.data?.uuid) return exists.data.uuid;
    const uuid = crypto.randomUUID(); const lk = S.masterKeys[S.masterKeys.length - 1];
    const en = await metaEnc({ name }, lk); await apiPost('/dir/create', { uuid, name: en, nameHashed: nh, parent }); return uuid;
  }

  async function uploadFileInternal(file, parentUUID) {
    const uuid = crypto.randomUUID(), fileKey = rHex(32), uploadKey = rHex(32);
    const total = Math.max(1, Math.ceil(file.size / CHUNK));
    let bucket = null, region = null;
    for (let i = 0; i < total; i++) {
      const raw = new Uint8Array(await file.slice(i * CHUNK, Math.min((i + 1) * CHUNK, file.size)).arrayBuffer());
      const enc = await encryptChunk(raw, fileKey);
      const hashHex = hex(await crypto.subtle.digest('SHA-512', enc));
      const host = pick(INGEST);
      const r = await (await fetch(`${host}/v3/upload?uuid=${uuid}&index=${i}&uploadKey=${uploadKey}&parent=${parentUUID}&hash=${hashHex}`, { method: 'POST', headers: { 'Authorization': `Bearer ${S.apiKey}` }, body: enc })).json();
      if (!r.status) throw new Error(r.message || `Chunk ${i} failed`);
      if (i === 0) { bucket = r.data.bucket; region = r.data.region; }
    }
    const lk = S.masterKeys[S.masterKeys.length - 1];
    const meta = JSON.stringify({ name: file.name, size: file.size, mime: file.type || 'application/octet-stream', key: fileKey, lastModified: file.lastModified || Date.now() });
    const em = await metaEnc(meta, lk), nh = await sha512(file.name.toLowerCase());
    const dr = await apiPost('/upload/done', { uuid, name: em, nameHashed: nh, size: String(file.size), chunks: total, mime: em, rm: rHex(32), metadata: em, version: 2, uploadKey });
    if (!dr.status) throw new Error(dr.message || 'Finalize failed');
    return { uuid, fileKey, bucket, region, chunks: total };
  }

  async function downloadFileInternal(uuid, files) {
    const f = files.find(x => x.uuid === uuid); if (!f) throw new Error('File not found');
    const parts = [];
    for (let i = 0; i < f.chunks; i++) {
      const host = pick(EGEST);
      const r = await fetch(`${host}/${f.region}/${f.bucket}/${f.uuid}/${i}`, { headers: { 'Authorization': `Bearer ${S.apiKey}` } });
      if (!r.ok) throw new Error(`Chunk ${i}: HTTP ${r.status}`);
      parts.push(new Uint8Array(await decryptChunk(await r.arrayBuffer(), f.key)));
    }
    const total = parts.reduce((s, p) => s + p.length, 0); const out = new Uint8Array(total); let off = 0;
    for (const p of parts) { out.set(p, off); off += p.length; }
    return { data: out, name: f.name, mime: f.mime };
  }

  // ── Auto-backup tracking ──
  let backupTimers = {};

  function scheduleAutoBackup(key, fn, delayMs) {
    if (backupTimers[key]) clearTimeout(backupTimers[key]);
    backupTimers[key] = setTimeout(async () => {
      try { await fn(); } catch (e) { console.warn('KhoraBackup auto-backup failed:', key, e.message); emit({ event: 'error', message: `Auto-backup failed: ${key}` }); }
    }, delayMs);
  }

  // ═══ PUBLIC API ═══
  const api = {
    // ── State getters ──
    get isConnected() { return !!S.apiKey; },
    get identity() { return S.matrixId || loadCreds()?.matrixId || null; },
    get email() { return S.email || loadCreds()?.email || null; },
    get storage() { return { used: S.usedStorage, max: S.maxStorage, available: Math.max(0, S.maxStorage - S.usedStorage) }; },
    get canBridge() { return !!S.canCreateLinks; },
    get bridgeSettings() { return loadPoolBridgeSettings(); },
    get hasSeenRecovery() { return hasSeenRecovery(); },
    get savedCreds() { return loadCreds(); },

    fmtSize,

    // ── Connection ──
    // Login with user-provided password
    async connectWithPassword(email, password) {
      const matrixId = svc.userId;
      const ok = await tryLogin(email, password);
      if (ok) {
        S.matrixId = matrixId;
        saveCreds(matrixId, email);
        // Save encrypted password to room data for cross-device auto-login
        try { await api.saveCredsToRoom(email, password); } catch (e) { console.warn('Could not save backup creds to room:', e.message); }
        // Security: clear password from memory — no longer needed after auth + room save
        S.filenPassword = null;
        emit({ event: 'connected', matrixId, email });
        return true;
      }
      return false;
    },

    // Register a new Filen account with user-provided password
    async registerWithPassword(email, password) {
      const matrixId = svc.userId;
      const reg = await tryRegister(email, password);
      if (reg === 'registered' || reg === 'exists_unconfirmed') {
        // Save creds locally so retryAfterConfirmation can use them
        saveCreds(matrixId, email);
        // Temporarily store password for use after confirmation
        S._pendingPassword = password;
        return 'needs_confirmation';
      }
      throw new Error(reg);
    },

    async retryAfterConfirmation() {
      const creds = loadCreds(); if (!creds) throw new Error('No saved credentials');
      const password = S._pendingPassword;
      if (!password) throw new Error('No pending password');
      const ok = await tryLogin(creds.email, password);
      if (ok) {
        S.matrixId = creds.matrixId; S._pendingPassword = null;
        try { await api.saveCredsToRoom(creds.email, password); } catch (e) { console.warn('Could not save backup creds to room:', e.message); }
        S.filenPassword = null; // Security: clear from memory after room save
        emit({ event: 'connected', matrixId: creds.matrixId, email: creds.email });
        return true;
      }
      return false;
    },

    async resendConfirmation() {
      const creds = loadCreds(); if (!creds) throw new Error('No email saved');
      const r = await apiPost('/confirmationSend', { email: creds.email }, false);
      return !!r.status;
    },

    // Save encrypted Filen creds to the user's owned room for cross-device auto-login
    async saveCredsToRoom(email, password) {
      const roomId = await findOwnedRoom();
      if (!roomId) return false;
      const matrixId = svc.userId;
      const encrypted = await encryptForRoom(password, matrixId);
      await svc.setState(roomId, EVT.BACKUP_CREDS, { email, encrypted, v: 1 });
      return true;
    },

    // Load Filen creds from room data
    async loadCredsFromRoom() {
      try {
        const scanned = await svc.scanRooms([EVT.BACKUP_CREDS]);
        for (const [, state] of Object.entries(scanned || {})) {
          const creds = state?.[EVT.BACKUP_CREDS];
          if (creds?.email && creds?.encrypted?.ct && creds?.v === 1) {
            const password = await decryptFromRoom(creds.encrypted, svc.userId);
            if (password) return { email: creds.email, password };
          }
        }
      } catch {}
      return null;
    },

    // Auto-connect: try room data first, then fall back to localStorage legacy creds
    async autoConnect() {
      // Try room-based credentials first (cross-device)
      try {
        const roomCreds = await api.loadCredsFromRoom();
        if (roomCreds) {
          const ok = await tryLogin(roomCreds.email, roomCreds.password);
          if (ok) {
            S.matrixId = svc.userId; S.filenPassword = null;
            saveCreds(svc.userId, roomCreds.email);
            emit({ event: 'connected', matrixId: svc.userId, email: roomCreds.email });
            return true;
          }
        }
      } catch {}
      // Fallback: localStorage creds with derived password (legacy)
      const creds = loadCreds(); if (!creds || !creds.matrixId || !creds.email) return false;
      try {
        const fp = await deriveFilenPassword(creds.matrixId);
        const ok = await tryLogin(creds.email, fp);
        if (ok) { S.matrixId = creds.matrixId; S.filenPassword = null; emit({ event: 'connected', matrixId: creds.matrixId, email: creds.email }); return true; }
      } catch {}
      return false;
    },

    disconnect() {
      S = { apiKey: null, masterKeys: [], baseFolderUUID: null, email: null, matrixId: null, filenPassword: null, canCreateLinks: false, maxStorage: 0, usedStorage: 0 };
      clearCreds();
      for (const k of Object.keys(backupTimers)) { clearTimeout(backupTimers[k]); delete backupTimers[k]; }
      emit({ event: 'disconnected' });
    },

    markRecoverySeen,

    // ── File operations ──
    async ensureFolder(name, parent) {
      if (!S.apiKey) throw new Error('Not connected');
      return ensureFolderInternal(name, parent);
    },

    async uploadFile(file, folder) {
      if (!S.apiKey) throw new Error('Not connected');
      const parentUUID = folder ? await ensureFolderInternal(folder) : S.baseFolderUUID;
      const result = await uploadFileInternal(file, parentUUID);
      emit({ event: 'upload_complete', filename: file.name, folder: folder || null });
      return result;
    },

    async uploadJSON(data, filename, folder) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const file = new File([blob], filename || `backup-${Date.now()}.json`, { type: 'application/json' });
      return api.uploadFile(file, folder);
    },

    async uploadAndLink(file, folder) {
      if (!S.apiKey) throw new Error('Not connected');
      const parentUUID = folder ? await ensureFolderInternal(folder) : S.baseFolderUUID;
      const info = await uploadFileInternal(file, parentUUID);
      const linkUUID = crypto.randomUUID();
      const r = await apiPost('/file/link/edit', { uuid: linkUUID, fileUUID: info.uuid, type: 'enable', expiration: 'never', password: 'empty', passwordHashed: await sha512('empty'), salt: rHex(32), downloadBtn: true });
      if (!r.status) throw new Error(r.message || 'Link failed');
      return `https://filen.io/f/${linkUUID}#${info.fileKey}`;
    },

    async uploadBufferAndLink(buffer, filename, folder) {
      const file = new File([buffer], filename, { type: 'application/octet-stream', lastModified: Date.now() });
      return api.uploadAndLink(file, folder);
    },

    async deleteFile(folder, filename) {
      if (!S.apiKey) throw new Error('Not connected');
      const folderUUID = folder ? await ensureFolderInternal(folder) : S.baseFolderUUID;
      const r = await apiPost('/dir/content', { uuid: folderUUID });
      if (!r.status) throw new Error(r.message || 'Folder not found');
      for (const u of (r.data.uploads || [])) { const m = await decMeta(u.metadata); if (m && m.name === filename) { const tr = await apiPost('/file/trash', { uuid: u.uuid }); if (!tr.status) throw new Error(tr.message || 'Trash failed'); return true; } }
      return false;
    },

    async listFolder(folderUUID) {
      if (!S.apiKey) throw new Error('Not connected');
      const uuid = folderUUID || S.baseFolderUUID;
      const r = await apiPost('/dir/content', { uuid });
      if (!r.status) throw new Error(r.message || 'Load failed');
      const folders = [], files = [];
      for (const f of (r.data.folders || [])) { if (f.uuid === uuid) continue; const n = await decMeta(f.name); folders.push({ uuid: f.uuid, name: (typeof n === 'object' ? n.name : n) || '[Encrypted]', ts: f.timestamp }); }
      for (const u of (r.data.uploads || [])) { const m = await decMeta(u.metadata); files.push({ uuid: u.uuid, name: m?.name || '[Encrypted]', size: m?.size || u.size || 0, mime: m?.mime || '', key: m?.key || '', chunks: u.chunks, bucket: u.bucket, region: u.region, version: u.version || 2, ts: u.timestamp }); }
      return { folders, files };
    },

    async downloadFile(uuid) {
      if (!S.apiKey) throw new Error('Not connected');
      const listing = await api.listFolder();
      return downloadFileInternal(uuid, listing.files);
    },

    // ── Auto-backup helpers ──
    scheduleVaultBackup(vaultData, delayMs) {
      if (!S.apiKey) return;
      scheduleAutoBackup('vault', async () => {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        await api.uploadJSON(vaultData, `vault-${ts}.json`, 'Vault Backups');
        emit({ event: 'backup_complete', type: 'vault', filename: `vault-${ts}.json` });
      }, delayMs || 30000);
    },

    // ── Pool Bridge ──
    enableBridge(capacityGB) {
      if (!S.canCreateLinks) throw new Error('Account does not support public links');
      const cap = Math.max(1, Math.min(100, capacityGB || 5));
      savePoolBridgeSettings(true, cap);
      emit({ event: 'bridge_enabled', capacity_gb: cap });
      window.dispatchEvent(new CustomEvent('khora-bridge-ready', { detail: { capacity_gb: cap, maxStorage: S.maxStorage, usedStorage: S.usedStorage } }));
    },

    disableBridge() {
      savePoolBridgeSettings(false, 0);
      emit({ event: 'bridge_disabled' });
      window.dispatchEvent(new CustomEvent('khora-bridge-stopped'));
    },

    // ── Event system ──
    addListener(fn) { if (typeof fn === 'function' && !listeners.includes(fn)) listeners.push(fn); },
    removeListener(fn) { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }
  };

  return api;
})();
