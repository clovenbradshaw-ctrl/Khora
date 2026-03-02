/**
 * EO (Epistemic Operations) — Operation engine
 * Source: app/crypto.js (lines 58-236)
 *
 * Tier 2: Data Integrity — correct provenance tracking and state projection.
 * Tests the nine canonical operators, path helpers, ID generation, and state replay.
 */
import { describe, it, expect } from 'vitest';

describe('EO Operators & Helpers', () => {
  it('OPERATORS array has exactly 9 canonical operators', () => {
    expect(OPERATORS).toEqual(['NUL', 'DES', 'INS', 'SEG', 'CON', 'SYN', 'ALT', 'SUP', 'REC']);
    expect(OPERATORS.length).toBe(9);
  });

  it('dot() builds dot-notation paths', () => {
    expect(dot('vault', 'fields', 'name')).toBe('vault.fields.name');
    expect(dot('bridge', 'refs')).toBe('bridge.refs');
    expect(dot('single')).toBe('single');
  });

  it('dot() filters out falsy segments', () => {
    expect(dot('vault', null, 'name')).toBe('vault.name');
    expect(dot('', 'fields', undefined, 'dob')).toBe('fields.dob');
    expect(dot(null, undefined, '')).toBe('');
  });

  it('targetField() extracts the last segment', () => {
    expect(targetField('vault.fields.name')).toBe('name');
    expect(targetField('bridge.refs')).toBe('refs');
    expect(targetField('single')).toBe('single');
  });

  it('targetField() returns null for null/undefined input', () => {
    expect(targetField(null)).toBeNull();
    expect(targetField(undefined)).toBeNull();
  });

  it('genOpId() produces unique IDs with op_ prefix', () => {
    const ids = Array.from({ length: 100 }, () => genOpId());
    for (const id of ids) {
      expect(id).toMatch(/^op_/);
    }
    const unique = new Set(ids);
    expect(unique.size).toBe(100);
  });

  it('eKey() produces composite key with :: separator', () => {
    expect(eKey('!room1:test', 'vault.fields.name')).toBe('!room1:test::vault.fields.name');
    expect(eKey('!room1:test', null)).toBe('!room1:test::_root');
    expect(eKey('!room1:test', undefined)).toBe('!room1:test::_root');
  });

  it('extractHomeserver() parses Matrix IDs correctly', () => {
    expect(extractHomeserver('@alice:matrix.org')).toBe('matrix.org');
    expect(extractHomeserver('!room:homeserver.local')).toBe('homeserver.local');
    expect(extractHomeserver(null)).toBe('unknown');
    expect(extractHomeserver('nocolon')).toBe('unknown');
  });

  it('isValidMatrixId() validates Matrix user ID format', () => {
    expect(isValidMatrixId('@alice:matrix.org')).toBe(true);
    expect(isValidMatrixId('@bob:test.local')).toBe(true);
    expect(isValidMatrixId('alice:matrix.org')).toBe(false); // missing @
    expect(isValidMatrixId('@alice')).toBe(false); // missing :server
    expect(isValidMatrixId(null)).toBe(false);
    expect(isValidMatrixId('')).toBe(false);
  });
});

describe('projectCurrentState', () => {
  const makeOp = (op, target, operand, ts, frame = { type: 'test' }) => ({
    id: genOpId(), op, target, operand, ts, frame,
  });

  it('INS creates a field with value', () => {
    const ops = [
      makeOp('INS', 'vault.fields.name', { value: 'Alice' }, 1000),
    ];
    const state = projectCurrentState(ops, 'test');
    expect(state.name).toBeDefined();
    expect(state.name.value).toBe('Alice');
  });

  it('ALT updates an existing field value', () => {
    const ops = [
      makeOp('INS', 'vault.fields.name', { value: 'Alice' }, 1000),
      makeOp('ALT', 'vault.fields.name', { from: 'Alice', to: 'Alicia' }, 2000),
    ];
    const state = projectCurrentState(ops, 'test');
    expect(state.name.value).toBe('Alicia');
  });

  it('ALT without prior INS does not create field', () => {
    const ops = [
      makeOp('ALT', 'vault.fields.name', { from: 'old', to: 'new' }, 1000),
    ];
    const state = projectCurrentState(ops, 'test');
    expect(state.name).toBeUndefined();
  });

  it('NUL nullifies a field', () => {
    const ops = [
      makeOp('INS', 'vault.fields.name', { value: 'Alice' }, 1000),
      makeOp('NUL', 'vault.fields.name', { reason: 'client_cleared' }, 2000),
    ];
    const state = projectCurrentState(ops, 'test');
    expect(state.name.value).toBeNull();
    expect(state.name.nullified_by).toBeDefined();
  });

  it('SUP creates superposition with multiple values', () => {
    const ops = [
      makeOp('SUP', 'vault.fields.status', { states: ['employed', 'student'] }, 1000),
    ];
    const state = projectCurrentState(ops, 'test');
    expect(state.status.superposition).toBe(true);
    expect(state.status.values).toEqual(['employed', 'student']);
  });

  it('DES sets designation on a field', () => {
    const ops = [
      makeOp('DES', 'vault.fields.account', { designation: 'primary' }, 1000),
    ];
    const state = projectCurrentState(ops, 'test');
    expect(state['account.designation']).toBeDefined();
    expect(state['account.designation'].value).toBe('primary');
  });

  it('operations are replayed in timestamp order', () => {
    const ops = [
      makeOp('ALT', 'vault.fields.name', { from: 'Bob', to: 'Charlie' }, 3000),
      makeOp('INS', 'vault.fields.name', { value: 'Alice' }, 1000),
      makeOp('ALT', 'vault.fields.name', { from: 'Alice', to: 'Bob' }, 2000),
    ];
    const state = projectCurrentState(ops, 'test');
    expect(state.name.value).toBe('Charlie');
  });

  it('only replays operations matching the given frame type', () => {
    const ops = [
      makeOp('INS', 'vault.fields.name', { value: 'Alice' }, 1000, { type: 'test' }),
      makeOp('INS', 'vault.fields.age', { value: '30' }, 2000, { type: 'other' }),
    ];
    const state = projectCurrentState(ops, 'test');
    expect(state.name).toBeDefined();
    expect(state.age).toBeUndefined();
  });
});

describe('cohortHash', () => {
  it('produces a base64 SHA-256 hash', async () => {
    const hash = await cohortHash('@alice:test.local', 'salt_1');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('same input produces same hash', async () => {
    const h1 = await cohortHash('@alice:test.local', 'salt_1');
    const h2 = await cohortHash('@alice:test.local', 'salt_1');
    expect(h1).toBe(h2);
  });

  it('different salt produces different hash', async () => {
    const h1 = await cohortHash('@alice:test.local', 'salt_1');
    const h2 = await cohortHash('@alice:test.local', 'salt_2');
    expect(h1).not.toBe(h2);
  });

  it('different users produce different hashes', async () => {
    const h1 = await cohortHash('@alice:test.local', 'salt');
    const h2 = await cohortHash('@bob:test.local', 'salt');
    expect(h1).not.toBe(h2);
  });
});

describe('EmailVerification', () => {
  it('generateCode() produces 6-digit string', () => {
    const code = EmailVerification.generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('isValidEmail() validates email format', () => {
    expect(EmailVerification.isValidEmail('alice@example.com')).toBe(true);
    expect(EmailVerification.isValidEmail('bad')).toBe(false);
    expect(EmailVerification.isValidEmail('')).toBe(false);
    expect(EmailVerification.isValidEmail(null)).toBe(false);
  });

  it('extractDomain() returns domain from email', () => {
    expect(EmailVerification.extractDomain('alice@example.com')).toBe('example.com');
    expect(EmailVerification.extractDomain('bad')).toBeNull();
  });

  it('domainMatches() checks org domains', () => {
    expect(EmailVerification.domainMatches('alice@example.com', ['example.com'])).toBe(true);
    expect(EmailVerification.domainMatches('alice@other.com', ['example.com'])).toBe(false);
    expect(EmailVerification.domainMatches('alice@any.com', [])).toBe(true); // empty = allow all
  });

  it('createChallenge→validateChallenge round-trip succeeds', async () => {
    const { challenge, plainCode } = await EmailVerification.createChallenge('@alice:test', 'alice@example.com');
    expect(challenge.status).toBe('pending');
    expect(challenge.expires).toBeGreaterThan(Date.now());

    const result = await EmailVerification.validateChallenge(challenge, plainCode);
    expect(result.valid).toBe(true);
  });

  it('validateChallenge rejects wrong code', async () => {
    const { challenge } = await EmailVerification.createChallenge('@alice:test', 'alice@example.com');
    const result = await EmailVerification.validateChallenge(challenge, '000000');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('incorrect_code');
  });

  it('validateChallenge rejects expired challenge', async () => {
    const { challenge, plainCode } = await EmailVerification.createChallenge('@alice:test', 'alice@example.com');
    challenge.expires = Date.now() - 1000; // force expiry
    const result = await EmailVerification.validateChallenge(challenge, plainCode);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('validateChallenge rejects after max attempts', async () => {
    const { challenge, plainCode } = await EmailVerification.createChallenge('@alice:test', 'alice@example.com');
    challenge.attempts = 3;
    const result = await EmailVerification.validateChallenge(challenge, plainCode);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('max_attempts');
  });
});

describe('AccountVerification', () => {
  it('createChallenge→validateChallenge round-trip succeeds', async () => {
    const { challenge, plainCode } = await AccountVerification.createChallenge();
    expect(challenge.status).toBe('pending');
    const result = await AccountVerification.validateChallenge(challenge, plainCode);
    expect(result.valid).toBe(true);
  });

  it('validateChallenge rejects wrong code', async () => {
    const { challenge } = await AccountVerification.createChallenge();
    const result = await AccountVerification.validateChallenge(challenge, '999999');
    expect(result.valid).toBe(false);
  });
});
