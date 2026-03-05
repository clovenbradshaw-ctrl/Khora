/* ═══════════════════ BRIDGE KEY MANAGER ═══════════════════
 * Operator Manifest:
 *   INS(bridge.keys, {field_keys}) — key_storage — stores per-field encryption keys
 *   DES(bridge.keys, {field_keys}) — key_retrieval — reads per-field keys
 *   NUL(bridge.keys, {reason: revoked}) — key_destruction — clears all keys for a bridge
 *
 * Separates encryption keys from ciphertext in bridge refs.
 * Keys are stored in io.khora.bridge.keys (separate state event from io.khora.bridge.refs).
 * This creates a genuine two-factor security model:
 *   - Compromise the blob store → ciphertext but no keys
 *   - Compromise the room keys event → keys but no data
 *   - Need BOTH to reconstruct plaintext
 *
 * Backward compatible: detects legacy format (keys inline in refs) and handles transparently.
 *
 * Triad Summary:
 *   Existence:       INS (key storage), NUL (key destruction)
 *   Structure:       —
 *   Interpretation:  DES (key retrieval for decryption)
 * ═══════════════════════════════════════════════════════════ */

const BridgeKeyManager = {
  // INS(bridge.keys, {field_keys}) — key_storage — stores per-field encryption keys in a dedicated state event
  async storeKeys(bridgeRoomId, keyMap) {
    await svc.setState(bridgeRoomId, EVT.BRIDGE_KEYS, {
      keys: keyMap,
      updated: Date.now()
    });
  },

  // DES(bridge.keys, {field_keys}) — key_retrieval — reads per-field keys from dedicated state event
  async getKeys(bridgeRoomId) {
    const state = await svc.getState(bridgeRoomId, EVT.BRIDGE_KEYS);
    return state?.keys || {};
  },

  // NUL(bridge.keys, {reason: revoked}) — key_destruction — clears all keys for a bridge
  async revokeKeys(bridgeRoomId) {
    await svc.setState(bridgeRoomId, EVT.BRIDGE_KEYS, {
      keys: {},
      revoked: true,
      updated: Date.now()
    });
  },

  // Decrypt bridge refs using separated or legacy key format.
  // Legacy: keys inline in refs ({ciphertext, iv, key} per field)
  // New: keys in separate BRIDGE_KEYS event ({ciphertext, iv} per field, keys in BRIDGE_KEYS)
  // Returns { fieldKey: plaintext, ... }
  async decryptRefs(refs, bridgeRoomId) {
    const decrypted = {};
    if (!refs?.fields) return decrypted;

    const fieldEntries = Object.entries(refs.fields);
    if (fieldEntries.length === 0) return decrypted;

    // Detect format: if any field has an inline key, treat all as legacy
    const hasInlineKeys = fieldEntries.some(([, ref]) => ref.key != null);

    let separatedKeys = {};
    if (!hasInlineKeys) {
      separatedKeys = await this.getKeys(bridgeRoomId);
    }

    for (const [fk, ref] of fieldEntries) {
      try {
        const key = hasInlineKeys ? ref.key : separatedKeys[fk];
        if (key && ref.ciphertext && ref.iv) {
          const plain = await FieldCrypto.decrypt(ref.ciphertext, ref.iv, key);
          if (plain !== null) decrypted[fk] = plain;
        }
      } catch {/* skip undecryptable field */}
    }
    return decrypted;
  }
};
