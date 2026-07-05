// Measurement follows the Born rule: probability proportional to amplitude
// squared (Part 1, "The runtime consequences"). Read-time only — every draw
// is seeded and recorded, never silent.

export function bornWeights(folds) {
  if (!Array.isArray(folds) || folds.length === 0) {
    throw new TypeError('bornWeights requires a non-empty array of folds');
  }
  const amplitudes = folds.map((f) => (typeof f === 'number' ? f : f.amplitude));
  if (amplitudes.some((a) => typeof a !== 'number' || !Number.isFinite(a))) {
    throw new TypeError('every fold must have a finite numeric amplitude');
  }
  const squared = amplitudes.map((a) => a * a);
  const total = squared.reduce((sum, x) => sum + x, 0);
  if (total <= 0) {
    throw new RangeError('folds must have non-zero total amplitude');
  }
  return squared.map((x) => x / total);
}

// Deterministic PRNG (mulberry32) so a draw is reproducible from its logged
// seed — no-cloning/no-deleting on the log means a draw must be replayable,
// not just random.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sample(folds, seed) {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new TypeError('sample requires a numeric seed so the draw can be logged and replayed');
  }
  const weights = bornWeights(folds);
  const draw = mulberry32(seed)();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (draw < cumulative) {
      return Object.freeze({ fold: folds[i], index: i, seed, weights });
    }
  }
  const lastIndex = weights.length - 1;
  return Object.freeze({ fold: folds[lastIndex], index: lastIndex, seed, weights });
}
