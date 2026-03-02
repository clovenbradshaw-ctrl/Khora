/**
 * LocalVaultCrypto — HKDF-derived AES-256-GCM at-rest encryption
 * Source: app/auth.js (lines 37-94)
 *
 * Tier 1: Security — protects all cached data in IndexedDB.
 * Tests key derivation, encrypt/decrypt round-trip, and teardown.
 */
import { describe, it, expect, beforeEach } from 'vitest';

describe('LocalVaultCrypto', () => {
  beforeEach(() => {
    LocalVaultCrypto.clear();
  });

  it('ready is false before deriveKey()', () => {
    expect(LocalVaultCrypto.ready).toBe(false);
  });

  it('deriveKey() produces a key and sets ready to true', async () => {
    const key = await LocalVaultCrypto.deriveKey('@alice:test.local', 'token_abc123', 'DEVICE_1');
    expect(key).toBeTruthy();
    expect(LocalVaultCrypto.ready).toBe(true);
  });

  it('encrypt→decrypt round-trip preserves JSON data', async () => {
    await LocalVaultCrypto.deriveKey('@alice:test.local', 'token_abc123', 'DEVICE_1');

    const data = {
      fields: { first_name: 'Alice', dob: '1990-01-15' },
      observations: [{ id: 'obs1', value: 'stable housing' }],
      metrics_consent: true,
    };

    const encrypted = await LocalVaultCrypto.encrypt(data);
    expect(encrypted.__enc).toBe(1);
    expect(typeof encrypted.ct).toBe('string');
    expect(typeof encrypted.iv).toBe('string');

    const decrypted = await LocalVaultCrypto.decrypt(encrypted);
    expect(decrypted).toEqual(data);
  });

  it('encrypt() throws when not initialized', async () => {
    await expect(LocalVaultCrypto.encrypt({ test: 1 }))
      .rejects.toThrow('not initialized');
  });

  it('decrypt() throws when not initialized', async () => {
    await expect(LocalVaultCrypto.decrypt({ __enc: 1, ct: 'abc', iv: 'def' }))
      .rejects.toThrow('not initialized');
  });

  it('decrypt() of non-envelope returns data as-is', async () => {
    await LocalVaultCrypto.deriveKey('@alice:test.local', 'token_abc', 'DEV');
    const plain = { hello: 'world', no_encryption: true };
    const result = await LocalVaultCrypto.decrypt(plain);
    expect(result).toEqual(plain);
  });

  it('clear() destroys the key and sets ready to false', async () => {
    await LocalVaultCrypto.deriveKey('@alice:test.local', 'token_abc', 'DEV');
    expect(LocalVaultCrypto.ready).toBe(true);
    LocalVaultCrypto.clear();
    expect(LocalVaultCrypto.ready).toBe(false);
  });

  it('different users derive different keys (different encrypted output)', async () => {
    const data = { test: 'same data' };

    await LocalVaultCrypto.deriveKey('@alice:test.local', 'token_a', 'DEV_A');
    const encAlice = await LocalVaultCrypto.encrypt(data);

    LocalVaultCrypto.clear();

    await LocalVaultCrypto.deriveKey('@bob:test.local', 'token_b', 'DEV_B');
    const encBob = await LocalVaultCrypto.encrypt(data);

    // Different users → different ciphertext (even if data is the same)
    expect(encAlice.ct).not.toBe(encBob.ct);
  });

  it('data encrypted by one user cannot be decrypted by another', async () => {
    const data = { secret: 'alice_only' };

    await LocalVaultCrypto.deriveKey('@alice:test.local', 'token_a', 'DEV_A');
    const encrypted = await LocalVaultCrypto.encrypt(data);

    LocalVaultCrypto.clear();

    await LocalVaultCrypto.deriveKey('@bob:test.local', 'token_b', 'DEV_B');
    const result = await LocalVaultCrypto.decrypt(encrypted);
    expect(result).toBeNull(); // decrypt catches the error and returns null
  });
});
