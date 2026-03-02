/**
 * FieldCrypto — AES-256-GCM per-field encryption
 * Source: app/crypto.js (lines 13-53)
 *
 * Tier 1: Security — must not ship broken.
 * Tests the encrypt→decrypt round-trip that protects every shared field.
 */
import { describe, it, expect } from 'vitest';

describe('FieldCrypto', () => {
  it('generateKey() produces a base64-encoded 256-bit key', async () => {
    const key = await FieldCrypto.generateKey();
    expect(typeof key).toBe('string');
    // 256 bits = 32 bytes → base64 = 44 chars
    const raw = Uint8Array.from(atob(key), c => c.charCodeAt(0));
    expect(raw.length).toBe(32);
  });

  it('generateKey() produces unique keys each call', async () => {
    const keys = await Promise.all(Array.from({ length: 10 }, () => FieldCrypto.generateKey()));
    const unique = new Set(keys);
    expect(unique.size).toBe(10);
  });

  it('encrypt→decrypt round-trip returns original plaintext', async () => {
    const key = await FieldCrypto.generateKey();
    const plaintext = 'Hello, Khora vault!';
    const { ciphertext, iv } = await FieldCrypto.encrypt(plaintext, key);

    expect(typeof ciphertext).toBe('string');
    expect(typeof iv).toBe('string');
    expect(ciphertext).not.toBe(plaintext);

    const result = await FieldCrypto.decrypt(ciphertext, iv, key);
    expect(result).toBe(plaintext);
  });

  it('decrypt with wrong key returns null (not an error)', async () => {
    const key1 = await FieldCrypto.generateKey();
    const key2 = await FieldCrypto.generateKey();
    const { ciphertext, iv } = await FieldCrypto.encrypt('secret', key1);

    const result = await FieldCrypto.decrypt(ciphertext, iv, key2);
    expect(result).toBeNull();
  });

  it('tampered ciphertext returns null', async () => {
    const key = await FieldCrypto.generateKey();
    const { ciphertext, iv } = await FieldCrypto.encrypt('secret data', key);

    // Flip a character in the ciphertext
    const tampered = ciphertext.slice(0, -2) + (ciphertext.endsWith('AA') ? 'BB' : 'AA');
    const result = await FieldCrypto.decrypt(tampered, iv, key);
    expect(result).toBeNull();
  });

  it('empty string encrypts/decrypts correctly', async () => {
    const key = await FieldCrypto.generateKey();
    const { ciphertext, iv } = await FieldCrypto.encrypt('', key);
    const result = await FieldCrypto.decrypt(ciphertext, iv, key);
    expect(result).toBe('');
  });

  it('unicode text encrypts/decrypts correctly', async () => {
    const key = await FieldCrypto.generateKey();
    const plaintext = '日本語テスト 🔐 données confidentielles ñ Ω';
    const { ciphertext, iv } = await FieldCrypto.encrypt(plaintext, key);
    const result = await FieldCrypto.decrypt(ciphertext, iv, key);
    expect(result).toBe(plaintext);
  });

  it('large payload (10KB) encrypts/decrypts correctly', async () => {
    const key = await FieldCrypto.generateKey();
    const plaintext = 'x'.repeat(10240);
    const { ciphertext, iv } = await FieldCrypto.encrypt(plaintext, key);
    const result = await FieldCrypto.decrypt(ciphertext, iv, key);
    expect(result).toBe(plaintext);
  });
});
