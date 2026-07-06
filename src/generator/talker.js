// The talker is out of scope for this build (Part 7: "first with a
// hardcoded AppSpec, then wired to the talker"). This file only fixes the
// interface a future in-browser LLM integration must satisfy, so generate()
// has a stable contract to wire up to later. EO operators, cell names, and
// machinery vocabulary must never enter the talker's prompt (Part 5) — that
// discipline belongs to whatever implements proposeAppSpec, not to this stub.

export async function proposeAppSpec(_description) {
  throw new Error(
    'talker not implemented: this build stops at a hardcoded AppSpec (see src/generator/generate.js and its tests). ' +
      'Wiring an in-browser LLM here is future work, not this repo.',
  );
}
