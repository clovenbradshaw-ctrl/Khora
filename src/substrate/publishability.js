// Layer 3: moderation is content, not a workflow (Part 3). A policy room
// holds glob rule events enforced by a Draupnir-style bot — the blacklist,
// versioned and revertible. The direction that matters more is the
// allowlist: an entry is not publishable until it carries its `grounding`
// annotation, the CON-link to an archived source. Publishability is a
// predicate over event state, checked here at render time rather than
// described in prose.

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function matchesAnyPolicyRule(entry, policyRules) {
  return policyRules.some((rule) => globToRegExp(rule.pattern).test(entry.target ?? ''));
}

export function isPublishable(entry, { redacted = false, policyRules = [] } = {}) {
  if (!entry || typeof entry !== 'object') return false;
  if (redacted) return false;
  if (matchesAnyPolicyRule(entry, policyRules)) return false;
  return Array.isArray(entry.grounding) && entry.grounding.length > 0;
}
