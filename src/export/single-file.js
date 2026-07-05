// exportSingleFile (Part 6): one standalone .html carrying the kernel, the
// selected surfaces, the AppSpec, and a bootstrap, importmap resolved to
// inlined dependencies so nothing loads from a network at open time. Live
// mode connects through the projection endpoint; snapshot mode bakes a
// materialized read model in, read-only, with its provenance stamped in a
// header comment so a frozen apprehension is still a situated observation
// (Part 1: "The runtime consequences").
//
// Source strings (kernelSource, surfaceSources) are injected rather than
// read from disk here, so this module stays framework-free and runs
// unmodified in a browser — a Node-side caller (or a test) reads the real
// files and passes their contents in.
//
// Caveat this module does not solve: the kernel is six files with relative
// imports between them (validate.js imports address.js and operators.js,
// etc.). Flattening all of them into one inlined <script> needs their
// cross-imports rewritten or stripped first — plain concatenation breaks.
// Callers must pass already-flattened source (or, for now, a single
// self-contained file like address.js) rather than the multi-file kernel
// as-is. Solving that generally is a small bundling step this build has not
// done; see docs/eo-substrate-complete-design.md Part 6 and the README.

import { validateAppSpec } from '../generator/appspec.js';

export function exportSingleFile(appSpec, mode, options = {}) {
  if (mode !== 'live' && mode !== 'snapshot') {
    throw new RangeError('mode must be "live" or "snapshot"');
  }

  const { valid, errors, residue } = validateAppSpec(appSpec);
  if (!valid) {
    return { ok: false, errors, residue };
  }

  const { kernelSource, surfaceSources, meantGraph, dagHead, projectionTime } = options;

  if (typeof kernelSource !== 'string' || !kernelSource) {
    throw new TypeError('exportSingleFile requires kernelSource (the kernel bundle to inline)');
  }

  const surfaceTypes = [...new Set(appSpec.surfaces.map((s) => s.type))];
  const missing = surfaceTypes.filter((type) => !surfaceSources || typeof surfaceSources[type] !== 'string');
  if (missing.length > 0) {
    throw new TypeError(`exportSingleFile is missing source for surface types: ${missing.join(', ')}`);
  }

  let provenanceHeader;
  let embeddedData;

  if (mode === 'snapshot') {
    if (!meantGraph || !dagHead || !projectionTime) {
      throw new TypeError('snapshot mode requires meantGraph, dagHead, and projectionTime');
    }
    provenanceHeader = [
      '<!--',
      '  EO Substrate snapshot export',
      `  room: ${appSpec.site.space_or_room}`,
      `  dagHead: ${dagHead}`,
      `  rules_rev: ${appSpec.rules_rev}`,
      `  projectionTime: ${projectionTime}`,
      '-->',
    ].join('\n');
    embeddedData = `window.__EO_SNAPSHOT__ = Object.freeze(${JSON.stringify(meantGraph)});`;
  } else {
    provenanceHeader = `<!-- EO Substrate live export — connects to ${appSpec.site.space_or_room} through the projection endpoint -->`;
    embeddedData = `window.__EO_LIVE_ROOM__ = ${JSON.stringify(appSpec.site.space_or_room)};`;
  }

  const inlinedSurfaces = surfaceTypes
    .map((type) => `// --- surface: ${type} ---\n${surfaceSources[type]}`)
    .join('\n\n');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>EO Substrate export: ${appSpec.site.space_or_room}</title>
${provenanceHeader}
</head>
<body>
<div id="root"></div>
<script type="module">
// --- kernel ---
${kernelSource}

${inlinedSurfaces}

const APP_SPEC = Object.freeze(${JSON.stringify(appSpec)});
${embeddedData}
// bootstrap: mounts the surfaces named in APP_SPEC.surfaces against
// ${mode === 'live' ? 'a live Matrix client, connected through the projection endpoint' : 'window.__EO_SNAPSHOT__, read-only'}
</script>
</body>
</html>
`;

  return { ok: true, html, mode, surfaceTypes };
}
