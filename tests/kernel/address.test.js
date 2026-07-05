import { describe, it, expect } from 'vitest';
import { makeAddress, isLegalAddress, faceOf, recover, FACE_NAMES } from '../../src/kernel/address.js';

describe('address', () => {
  it('makeAddress accepts every legal coordinate', () => {
    for (let mode = 0; mode <= 2; mode++) {
      for (let domain = 0; domain <= 2; domain++) {
        for (let object = 0; object <= 2; object++) {
          const addr = makeAddress(mode, domain, object);
          expect(addr).toEqual({ mode, domain, object });
          expect(isLegalAddress(addr)).toBe(true);
        }
      }
    }
  });

  it('makeAddress rejects out-of-range or non-integer values', () => {
    expect(() => makeAddress(3, 0, 0)).toThrow(RangeError);
    expect(() => makeAddress(-1, 0, 0)).toThrow(RangeError);
    expect(() => makeAddress(0.5, 0, 0)).toThrow(RangeError);
    expect(() => makeAddress(0, 0, undefined)).toThrow(RangeError);
  });

  it('isLegalAddress rejects malformed input without throwing', () => {
    expect(isLegalAddress(null)).toBe(false);
    expect(isLegalAddress({})).toBe(false);
    expect(isLegalAddress({ mode: 0, domain: 0, object: 9 })).toBe(false);
  });

  // Golden test: a legal address round-trips through faceOf and recover
  // with no loss, for every face and every address in the ground.
  it('round-trips every address through every face with no loss', () => {
    for (const face of FACE_NAMES) {
      for (let mode = 0; mode <= 2; mode++) {
        for (let domain = 0; domain <= 2; domain++) {
          for (let object = 0; object <= 2; object++) {
            const original = makeAddress(mode, domain, object);
            const coord = faceOf(original, face);
            const recovered = recover(coord, original[coord.droppedAxis]);
            expect(recovered).toEqual(original);
          }
        }
      }
    }
  });

  it('faceOf records which axis was parked, and does not leak its value', () => {
    const addr = makeAddress(1, 2, 0);
    const coord = faceOf(addr, 'act');
    expect(coord.droppedAxis).toBe('object');
    expect(coord).not.toHaveProperty('droppedValue');
    expect(coord.a).toBe(addr.mode);
    expect(coord.b).toBe(addr.domain);
  });

  it('faceOf rejects an illegal address or unknown face', () => {
    expect(() => faceOf({ mode: 0, domain: 0, object: 0 }, 'nonsense')).toThrow(RangeError);
    expect(() => faceOf({ mode: 9, domain: 0, object: 0 }, 'act')).toThrow(RangeError);
  });
});
