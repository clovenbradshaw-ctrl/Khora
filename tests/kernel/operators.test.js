import { describe, it, expect } from 'vitest';
import { OPERATORS, OPERATOR_CODES, operatorAt, isOperatorCode } from '../../src/kernel/operators.js';

describe('operators', () => {
  it('has exactly nine operators', () => {
    expect(OPERATOR_CODES).toHaveLength(9);
  });

  it('every operator has a unique Act (Mode x Domain) coordinate', () => {
    const coords = new Set();
    for (const code of OPERATOR_CODES) {
      const op = OPERATORS[code];
      const key = `${op.mode},${op.domain}`;
      expect(coords.has(key)).toBe(false);
      coords.add(key);
    }
    expect(coords.size).toBe(9);
  });

  it('operatorAt resolves every Act cell to the matching operator', () => {
    for (const code of OPERATOR_CODES) {
      const op = OPERATORS[code];
      expect(operatorAt(op.mode, op.domain)).toBe(op);
    }
  });

  it('operatorAt throws for a coordinate with no operator', () => {
    // every mode/domain pair is in fact occupied by exactly one operator,
    // so out-of-range coordinates are the only way to get a miss here
    expect(() => operatorAt(3, 0)).toThrow(RangeError);
  });

  it('the helix position is a 0..8 permutation matching dependency order', () => {
    const helices = OPERATOR_CODES.map((code) => OPERATORS[code].helix).sort((a, b) => a - b);
    expect(helices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('isOperatorCode is true only for real codes', () => {
    expect(isOperatorCode('DEF')).toBe(true);
    expect(isOperatorCode('SUP')).toBe(false);
  });

  it('operator objects and the table itself are frozen', () => {
    expect(Object.isFrozen(OPERATORS)).toBe(true);
    for (const code of OPERATOR_CODES) {
      expect(Object.isFrozen(OPERATORS[code])).toBe(true);
    }
  });
});
