// The nine operators, keyed by code and by their Act-face coordinate
// (Mode x Domain). Semantics are quoted/paraphrased from the corpus
// exemplars in docs/eo-substrate-complete-design.md Part 1, "The nine
// operators" — not derived here.
//
// Display glyphs/Greek labels are placeholders: the wiki carries three
// glyph systems still in flux (Part 1), so nothing in the kernel or
// validators may key behavior off of them — only `code` and the
// mode/domain coordinate are load-bearing.

export const OPERATORS = Object.freeze({
  NUL: Object.freeze({
    code: 'NUL',
    mode: 0,
    domain: 0,
    helix: 0,
    semantic: 'recognizes absence, the non-presence of something expected',
    display: Object.freeze({ glyph: '∅', greek: 'Nu' }),
  }),
  SIG: Object.freeze({
    code: 'SIG',
    mode: 1,
    domain: 0,
    helix: 1,
    semantic: 'registers a difference, something coming to notice',
    display: Object.freeze({ glyph: 'Δ', greek: 'Sigma' }),
  }),
  INS: Object.freeze({
    code: 'INS',
    mode: 2,
    domain: 0,
    helix: 2,
    semantic: 'creates an instance, a new concrete thing entering existence',
    display: Object.freeze({ glyph: '∴', greek: 'Iota' }),
  }),
  SEG: Object.freeze({
    code: 'SEG',
    mode: 0,
    domain: 1,
    helix: 3,
    semantic: 'draws a boundary, partitioning within a structure',
    display: Object.freeze({ glyph: '|', greek: 'Xi' }),
  }),
  CON: Object.freeze({
    code: 'CON',
    mode: 1,
    domain: 1,
    helix: 4,
    semantic: 'connects across a boundary, holding things in relation',
    display: Object.freeze({ glyph: '—', greek: 'Chi' }),
  }),
  SYN: Object.freeze({
    code: 'SYN',
    mode: 2,
    domain: 1,
    helix: 5,
    semantic: 'merges parts into a whole that exceeds them',
    display: Object.freeze({ glyph: '∪', greek: 'Psi' }),
  }),
  DEF: Object.freeze({
    code: 'DEF',
    mode: 0,
    domain: 2,
    helix: 6,
    semantic:
      'establishes what holds, a corrective counter-assertion that revises a value inside a frame without changing the frame',
    display: Object.freeze({ glyph: '≠', greek: 'Delta' }),
  }),
  EVA: Object.freeze({
    code: 'EVA',
    mode: 1,
    domain: 2,
    helix: 7,
    semantic:
      'renders judgment, the reported-speech register where a speaker holds two incompatible positions at once under evaluation',
    display: Object.freeze({ glyph: '⇌', greek: 'Epsilon' }),
  }),
  REC: Object.freeze({
    code: 'REC',
    mode: 2,
    domain: 2,
    helix: 8,
    semantic: 'changes the frame itself, re-categorizing rather than revising',
    display: Object.freeze({ glyph: '↻', greek: 'Rho' }),
  }),
});

export const OPERATOR_CODES = Object.freeze(Object.keys(OPERATORS));

const BY_ACT_COORD = new Map(
  Object.values(OPERATORS).map((op) => [`${op.mode},${op.domain}`, op]),
);

export function operatorAt(mode, domain) {
  const op = BY_ACT_COORD.get(`${mode},${domain}`);
  if (!op) {
    throw new RangeError(`no operator at Act coordinate mode=${mode}, domain=${domain}`);
  }
  return op;
}

export function isOperatorCode(code) {
  return Object.prototype.hasOwnProperty.call(OPERATORS, code);
}
