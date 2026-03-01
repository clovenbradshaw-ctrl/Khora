/* ═══════════════════ E2EE MODULE (Isolated Encryption Enforcement) ═══════════════════
 * Single source of truth for all end-to-end encryption enforcement in Khora.
 * Isolated from auth.js and service.js to be resilient to updates in either.
 *
 * Public interface (stable contract):
 *   KhoraE2EE.requireSDK()                    — throws if Matrix SDK not loaded
 *   KhoraE2EE.createCryptoStore()              — returns IndexedDBCryptoStore
 *   KhoraE2EE.initMandatoryCrypto(client)      — inits E2EE on client, throws on failure
 *   KhoraE2EE.requireEncryptedSend(client, roomId) — throws if room is E2EE but SDK unavailable
 *
 * This module must be loaded AFTER matrix-js-sdk and BEFORE auth.js/service.js.
 * ═══════════════════════════════════════════════════════════════════════════════ */

const KhoraE2EE = {
  CRYPTO_STORE_NAME: 'khora-matrix-crypto',
  MAX_INIT_RETRIES: 3,

  /**
   * Guard: throw if Matrix SDK is not loaded.
   * Call at the top of login() and restoreSession() to prevent
   * operating without E2EE capability.
   */
  requireSDK() {
    if (typeof matrixcs === 'undefined') {
      throw new Error('Matrix SDK is not loaded. Khora requires the Matrix SDK for end-to-end encryption.');
    }
  },

  /**
   * Create a persistent IndexedDB crypto store for Megolm session keys.
   * Persisting keys prevents "Unable to decrypt" for historical messages
   * across page reloads.
   */
  createCryptoStore() {
    this.requireSDK();
    return new matrixcs.IndexedDBCryptoStore(indexedDB, this.CRYPTO_STORE_NAME);
  },

  /**
   * Initialize E2EE crypto on a Matrix client — MANDATORY.
   * Retries up to MAX_INIT_RETRIES times. If all retries fail, throws.
   * Khora cannot operate without E2EE.
   *
   * @param {Object} client - Matrix SDK client instance
   * @throws {Error} if crypto cannot be initialized
   */
  async initMandatoryCrypto(client) {
    let initialized = false;
    for (let attempt = 0; attempt < this.MAX_INIT_RETRIES; attempt++) {
      try {
        if (typeof Olm !== 'undefined') await Olm.init();
        await client.initCrypto();
        client.setGlobalErrorOnUnknownDevices(false);
        initialized = true;
        break;
      } catch (e) {
        console.warn(`E2EE crypto init attempt ${attempt + 1}/${this.MAX_INIT_RETRIES}:`, e.message);
        if (attempt < this.MAX_INIT_RETRIES - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    if (!initialized || !client.isCryptoEnabled()) {
      try { client.stopClient(); } catch {}
      throw new Error('End-to-end encryption could not be initialized. Khora requires E2EE to protect your data. Please reload and try again.');
    }
  },

  /**
   * Guard for send operations: throw if SDK is unavailable.
   * Used in sendEvent/sendMessage fallback paths to prevent
   * plaintext sends to encrypted rooms.
   */
  requireEncryptedSend(operation) {
    throw new Error(`Cannot ${operation} — Matrix SDK is not initialized. E2EE is required.`);
  }
};
