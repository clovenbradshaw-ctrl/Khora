import { describe, it, expect } from 'vitest';
import { bornWeights, sample } from '../../src/kernel/read.js';

describe('bornWeights', () => {
  // Golden test: bornWeights sums to one.
  it('sums to one for arbitrary amplitudes', () => {
    const weights = bornWeights([1, 2, 3, -4]);
    const total = weights.reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('accepts fold objects with an amplitude field', () => {
    const weights = bornWeights([{ amplitude: 1 }, { amplitude: 1 }]);
    expect(weights).toEqual([0.5, 0.5]);
  });

  it('is proportional to amplitude squared, not amplitude', () => {
    const weights = bornWeights([1, 2]);
    expect(weights[0]).toBeCloseTo(1 / 5, 10);
    expect(weights[1]).toBeCloseTo(4 / 5, 10);
  });

  it('throws on an empty fold set', () => {
    expect(() => bornWeights([])).toThrow(TypeError);
  });

  it('throws when total amplitude is zero', () => {
    expect(() => bornWeights([0, 0])).toThrow(RangeError);
  });
});

describe('sample', () => {
  it('requires a numeric seed', () => {
    expect(() => sample([1, 2, 3])).toThrow(TypeError);
  });

  it('is deterministic for a given seed', () => {
    const folds = ['a', 'b', 'c'].map((f, i) => ({ amplitude: i + 1, fold: f }));
    const draw1 = sample(folds, 42);
    const draw2 = sample(folds, 42);
    expect(draw1.index).toBe(draw2.index);
    expect(draw1.fold).toEqual(draw2.fold);
  });

  it('always returns one of the supplied folds', () => {
    const folds = [10, 20, 30];
    for (let seed = 0; seed < 50; seed++) {
      const draw = sample(folds, seed);
      expect(folds).toContain(draw.fold);
    }
  });
});
