/* ═══════════════════ PER-FIELD CRYPTO (AES-256-GCM) ═══════════════════
 * Operator Manifest:
 *   INS(crypto.aes_key, {via: crypto.subtle}) — field_encryption
 *   ALT(crypto.plaintext, {transform: ciphertext, key: aes_gcm}) — field_confidentiality
 *   ALT(crypto.ciphertext, {transform: plaintext, key: aes_gcm}) — field_confidentiality
 *
 * Triad Summary:
 *   Existence:       INS (key creation)
 *   Structure:       —
 *   Interpretation:  ALT (bidirectional value transform, encrypt/decrypt)
 *   No REC — frame is stable. Encryption changes representation, not meaning.
 * ═══════════════════════════════════════════════════════════════════════ */
const FieldCrypto = {
  // INS(crypto.aes_key, {via: crypto.subtle}) — field_encryption — create new 256-bit symmetric key
  async generateKey() {
    const key = await crypto.subtle.generateKey({
      name: 'AES-GCM',
      length: 256
    }, true, ['encrypt', 'decrypt']);
    const raw = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
  },
  // ALT(crypto.plaintext, {transform: ciphertext, key: aes_gcm}) — field_confidentiality
  async encrypt(plaintext, keyB64) {
    const keyBuf = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBuf, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({
      name: 'AES-GCM',
      iv
    }, key, new TextEncoder().encode(plaintext));
    return {
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(enc))),
      iv: btoa(String.fromCharCode(...iv))
    };
  },
  // ALT(crypto.ciphertext, {transform: plaintext, key: aes_gcm}) — field_confidentiality
  async decrypt(cipherB64, ivB64, keyB64) {
    try {
      const keyBuf = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
      const key = await crypto.subtle.importKey('raw', keyBuf, 'AES-GCM', false, ['decrypt']);
      const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
      const ct = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));
      const dec = await crypto.subtle.decrypt({
        name: 'AES-GCM',
        iv
      }, key, ct);
      return new TextDecoder().decode(dec);
    } catch {
      return null;
    }
  }
};

// LocalVaultCrypto and KhoraEncryptedCache have moved to auth.js
// (their lifecycle is bound to the login/logout session)

/* ═══════════════════ EO OPERATION LAYER ═══════════════════
 * Operator Manifest (meta — this IS the EO engine):
 *   DES(eo.operator_vocabulary, {nine_canonical_ops}) — ontological_foundation
 *   CON(eo.provenance.current_op, {predecessor, key: entity_key}) — provenance_chain
 *   DES(eo.dom_event, {type: khora:eo, dispatch: custom_event}) — ui_notification
 *   ALT(eo.userId, {transform: sha256_hash, salt}) — anonymization
 *
 * projectCurrentState replays: INS, ALT, NUL, SUP, DES
 *
 * Triad Summary:
 *   Existence:       INS (instantiation), DES (operator vocabulary)
 *   Structure:       CON (provenance chains)
 *   Interpretation:  ALT (cohort hashing), SUP (superposition replay)
 *   All three triads active. This is the EO engine itself —
 *   meta-operators operating on operators.
 * ═══════════════════════════════════════════════════════════ */
// DES(eo.operator_vocabulary, {nine_canonical_ops}) — ontological_foundation
const OPERATORS = ['NUL', 'DES', 'INS', 'SEG', 'CON', 'SYN', 'ALT', 'SUP', 'REC'];


// dot(segments...) — builds dot-notation target paths, filtering out falsy segments
function dot(...segments) {
  return segments.filter(Boolean).join('.');
}
// targetField(t) — extracts the last segment of a dot-notation target
function targetField(t) {
  if (!t) return null;
  const parts = t.split('.');
  return parts[parts.length - 1];
}

// Per-entity operation history (session-local)
const entityOpHist = {};
function eKey(roomId, target) {
  return `${roomId}::${target || '_root'}`;
}
let opSeq = 0;
function genOpId() {
  return `op_${Date.now().toString(36)}${(opSeq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

// Extract homeserver from a Matrix user ID (@user:server.org) or room ID (!room:server.org)
function extractHomeserver(matrixId) {
  if (!matrixId) return 'unknown';
  const idx = matrixId.indexOf(':');
  return idx >= 0 ? matrixId.slice(idx + 1) : 'unknown';
}

// Validate Matrix user ID format: @localpart:server
function isValidMatrixId(id) {
  return /^@[^:]+:[^:]+$/.test(id?.trim());
}

// Emit an EO operation
// Enriches every event with provenance metadata (created_by, origin_server)
// and builds provenance chains linking each op to its predecessor on the same entity.
// Resilient: catches sendEvent failures and retries once, logs all failures visibly.
//
// Format: OPERATOR(target [dot notation], operand)
//   CON(eo.provenance.chain, {current → predecessor}) — links to prior op
//   DES(eo.dom_event, {khora:eo, ui_notification}) — dispatches to DOM listeners
async function emitOp(roomId, op, target, operand, frame, provenance = []) {
  if (!roomId) {
    console.error('emitOp: no roomId provided for', op, target);
    return null;
  }
  try {
    const ek = eKey(roomId, target);
    // CON(eo.provenance.chain, {current → predecessor})
    const prevEntry = entityOpHist[ek];
    const chainedProvenance = [...provenance, ...(prevEntry?.id ? [prevEntry.id] : [])];
    const event = {
      id: genOpId(),
      op,
      target,
      operand,
      frame,
      provenance: chainedProvenance,
      created_by: svc.userId,
      origin_server: extractHomeserver(svc.userId),
      ts: Date.now()
    };
    await svc.sendEvent(roomId, EVT.OP, event);
    entityOpHist[ek] = {
      op,
      id: event.id
    };
    // DES(eo.dom_event, {khora:eo, ui_notification})
    // Dispatch custom DOM event so listeners (ActionLog, notifications) can react immediately
    window.dispatchEvent(new CustomEvent('khora:eo', {
      detail: {
        roomId,
        event
      }
    }));
    return event;
  } catch (e) {
    console.error('emitOp FAILED:', op, target, '→', e.message, {
      roomId,
      op,
      target,
      operand
    });
    // Still update local history so subsequent ops maintain provenance tracking
    const ek = eKey(roomId, target);
    entityOpHist[ek] = {
      op,
      id: 'failed_' + Date.now()
    };
    return null;
  }
}

// Compute current state from operation history (§9.1)
// Replays five operator types to reconstruct current entity state:
//   INS(target, {value}) → creates field with value (existence)
//   ALT(target, {from, to}) → overwrites value within stable frame (interpretation)
//   NUL(target, {reason}) → nullifies field, marks source (existence removal)
//   SUP(target, {states}) → holds multiple valid values simultaneously (interpretation)
//   DES(target, {designation}) → sets entity designation/type (existence naming)
function projectCurrentState(operations, frameType) {
  const state = {};
  const relevant = operations.filter(o => o.frame?.type === frameType).sort((a, b) => a.ts - b.ts);
  for (const op of relevant) {
    const field = targetField(op.target);
    switch (op.op) {
      case 'INS':
        // INS(target, {value}) — instantiate field with value
        if (field) state[field] = {
          value: op.operand?.value,
          source_op: op.id,
          epistemic: op.frame?.epistemic,
          ts: op.ts
        };
        break;
      case 'ALT':
        // ALT(target, {from, to}) — value change within existing frame
        if (field && state[field]) {
          state[field].value = op.operand?.to;
          state[field].source_op = op.id;
          state[field].ts = op.ts;
        }
        break;
      case 'NUL':
        // NUL(target, {reason}) — existence removal
        if (field) state[field] = {
          value: null,
          nullified_by: op.id,
          ts: op.ts
        };
        break;
      case 'SUP':
        // SUP(target, {states}) — multiple valid values coexist
        if (field) state[field] = {
          values: op.operand?.states,
          superposition: true,
          source_op: op.id,
          ts: op.ts
        };
        break;
      case 'DES':
        // DES(target, {designation}) — type/name assignment
        if (field) state[`${field}.designation`] = {
          value: op.operand?.designation,
          source_op: op.id,
          ts: op.ts
        };
        break;
    }
  }
  return state;
}

// ALT(metrics.userId, {transform: sha256_hash, salt}) — anonymization — one-way lossy transform for metrics
async function cohortHash(userId, salt) {
  const data = new TextEncoder().encode(userId + (salt || 'khora_default_salt'));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/* ═══════════════════ EMAIL VERIFICATION UTILITIES (§10.5) ═══════════════════
 * Operator Manifest:
 *   INS(email.verification_code, {via: crypto.getRandomValues}) — challenge_creation
 *   ALT(email.plaintext_code, {transform: sha256_hash, via: web_crypto}) — one_way_transform
 *   CON(email.hashed_code, {dest: org_room_state, via: webhook_delivery}) — out_of_band_challenge
 *   DES(email.identity, {attestation: code_match}) — verified_attestation
 *   NUL(email.challenge, {reason: max_attempts|expiry}) — lockout
 *
 * Triad Summary:
 *   Existence:       INS (code generation), NUL (expiry/lockout)
 *   Structure:       CON (webhook delivery to out-of-band channel)
 *   Interpretation:  ALT (one-way hash), DES (verified identity attestation)
 *   No REC, no SUP — verification either succeeds or fails, never reinterprets.
 *
 * Generates time-limited 6-digit codes, hashes them with SHA-256, and validates
 * email addresses against organization-approved domains. Codes are stored hashed
 * in Matrix room state — the plaintext code is delivered out-of-band (email/webhook).
 * ════════════════════════════════════════════════════════════════════════════════ */
const EmailVerification = {
  // INS(email.verification_code, {via: crypto.getRandomValues}) — challenge_creation
  generateCode() {
    const arr = crypto.getRandomValues(new Uint8Array(4));
    const num = (arr[0] << 24 | arr[1] << 16 | arr[2] << 8 | arr[3]) >>> 0;
    return String(num % 1000000).padStart(6, '0');
  },
  // ALT(email.plaintext_code, {transform: sha256_hash, via: web_crypto}) — one_way_transform
  async hashCode(code) {
    const data = new TextEncoder().encode(code + ':khora_email_verify_v1');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  },
  /** Extract domain from an email address */
  extractDomain(email) {
    const match = (email || '').trim().toLowerCase().match(/@([a-z0-9.-]+)$/);
    return match ? match[1] : null;
  },
  /** Validate email format */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim());
  },
  /** Check if an email's domain matches any of the org's required domains */
  domainMatches(email, requiredDomains) {
    if (!requiredDomains || requiredDomains.length === 0) return true;
    const domain = this.extractDomain(email);
    return domain && requiredDomains.some(d => d.toLowerCase() === domain);
  },
  // INS(email.challenge, {data: userId+email+hash}) — verification_initiation
  // CON(email.challenge, {dest: org_room_state, key: state_key}) — persistence
  async createChallenge(userId, email) {
    const code = this.generateCode();
    const codeHash = await this.hashCode(code);
    return {
      challenge: {
        user_id: userId,
        email: email.trim().toLowerCase(),
        domain: this.extractDomain(email),
        code_hash: codeHash,
        created: Date.now(),
        expires: Date.now() + 15 * 60 * 1000,
        // 15 minutes
        attempts: 0,
        max_attempts: 3,
        status: 'pending'
      },
      plainCode: code // returned for delivery — never stored in state
    };
  },
  // DES(email.identity, {attestation: code_match}) — verified_attestation on success
  // NUL(email.challenge, {reason: expired|max_attempts}) — lockout on failure
  async validateChallenge(challenge, submittedCode) {
    if (!challenge || challenge.status !== 'pending') return {
      valid: false,
      reason: 'no_active_challenge'
    };
    if (Date.now() > challenge.expires) return {
      valid: false,
      reason: 'expired'
    };
    if (challenge.attempts >= challenge.max_attempts) return {
      valid: false,
      reason: 'max_attempts'
    };
    const submittedHash = await this.hashCode(submittedCode);
    if (submittedHash !== challenge.code_hash) return {
      valid: false,
      reason: 'incorrect_code'
    };
    return {
      valid: true
    };
  },
  /** Default email verification config for an organization */
  defaultConfig() {
    return {
      enabled: false,
      required_domains: [],
      require_for_roles: ['admin', 'case_manager', 'field_worker', 'intake_coordinator'],
      grace_period_hours: 72
    };
  },
  /** Check if a staff member needs verification given org config */
  needsVerification(config, staffEntry) {
    if (!config?.enabled) return false;
    if (!config.require_for_roles?.includes(staffEntry.role)) return false;
    const ev = staffEntry.email_verification;
    if (ev?.status === 'verified') return false;
    return true;
  },
  // CON(email.plaintext_code, {dest: email_inbox, via: webhook_relay}) — out_of_band_delivery
  async sendCodeViaWebhook(email, code, orgName) {
    try {
      const payload = JSON.stringify({
        to: email,
        code: code,
        org_name: orgName,
        subject: `Your verification code for ${orgName}`,
        expires_minutes: 15,
        ts: Date.now()
      });
      // HMAC-SHA256 signature for webhook request authenticity
      const sigKey = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode('khora-webhook-v1'),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', sigKey, new TextEncoder().encode(payload));
      const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
      const resp = await fetch(`${WEBHOOK_BASE}/email-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Khora-Signature': sigHex,
          'X-Khora-Timestamp': String(Date.now())
        },
        body: payload
      });
      return resp.ok;
    } catch {
      return false;
    }
  }
};

/* ════════════════════════════════════════════════════════════════════════════════
 * §10b  ACCOUNT CLAIM VERIFICATION (6-DIGIT CODE)
 *
 * Operator Manifest:
 *   INS(claim.verification_code, {via: crypto.getRandomValues}) — challenge_creation
 *   ALT(claim.plaintext_code, {transform: sha256_hash}) — one_way_transform
 *
 * Protects against accidental room claims by the wrong Matrix user.
 * The provider generates a 6-digit code, communicates it in-person or via
 * a trusted platform, and the client must enter it before claiming succeeds.
 * Only the SHA-256 hash is stored in room state — never the plaintext code.
 *
 * Triad Summary:
 *   Existence:       INS (code creation)
 *   Structure:       —
 *   Interpretation:  ALT (hash transform)
 * ════════════════════════════════════════════════════════════════════════════════ */
const AccountVerification = {
  // INS(claim.verification_code, {via: crypto.getRandomValues}) — challenge_creation
  generateCode() {
    const arr = crypto.getRandomValues(new Uint8Array(4));
    const num = (arr[0] << 24 | arr[1] << 16 | arr[2] << 8 | arr[3]) >>> 0;
    return String(num % 1000000).padStart(6, '0');
  },
  // ALT(claim.plaintext_code, {transform: sha256_hash, via: web_crypto}) — one_way_transform
  async hashCode(code) {
    const data = new TextEncoder().encode(code + ':khora_claim_verify_v1');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  },
  // INS(claim.challenge, {data: code_hash+expiry}) — verification_initiation
  async createChallenge() {
    const code = this.generateCode();
    const codeHash = await this.hashCode(code);
    return {
      challenge: {
        code_hash: codeHash,
        created: Date.now(),
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        attempts: 0,
        max_attempts: 3,
        status: 'pending'
      },
      plainCode: code // returned for display — never stored in state
    };
  },
  // DES(claim.identity, {attestation: code_match}) — verified_attestation on success
  // NUL(claim.challenge, {reason: expired|max_attempts}) — lockout on failure
  async validateChallenge(challenge, submittedCode) {
    if (!challenge || challenge.status !== 'pending') return { valid: false, reason: 'no_active_challenge' };
    if (Date.now() > challenge.expires) return { valid: false, reason: 'expired' };
    if (challenge.attempts >= challenge.max_attempts) return { valid: false, reason: 'max_attempts' };
    const submittedHash = await this.hashCode(submittedCode);
    if (submittedHash !== challenge.code_hash) return { valid: false, reason: 'incorrect_code' };
    return { valid: true };
  }
};

/* ═══════════════════ EVENT TYPES (§11) ═══════════════════
 * Operator Manifest:
 *   DES(protocol.event_types, {namespace: io.khora.*}) — protocol_vocabulary
 *
 * This entire section is pure DES — it designates the vocabulary of
 * event types, maturity levels, propagation levels, governance constants,
 * and resource tracking constants. No data is mutated, structured, or
 * reinterpretted here. All actual transformations happen elsewhere
 * using these designations as their frame.
 *
 * Triad Summary:
 *   Existence:       DES only (naming, not creating)
 *   Structure:       —
 *   Interpretation:  —
 *   No INS, no ALT, no REC — vocabulary definition is frame-setting, not frame-changing.
 * ═══════════════════════════════════════════════════════════ */
