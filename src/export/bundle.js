// exportBundle (Part 6): the same holon with its parts visible — a zip tree
// (index.html, kernel/, surfaces/, spec/appspec.json, projection/ in
// snapshot mode, vendor/, media/, manifest.json), maintainable, editable,
// and deployable to any static host. Built with JSZip so, like
// exportSingleFile, this needs no server.

import JSZip from 'jszip';
import { validateAppSpec } from '../generator/appspec.js';

function bootstrapHtml(appSpec, mode, dagHead, projectionTime) {
  const provenance =
    mode === 'live'
      ? `<!-- connects to ${appSpec.site.space_or_room} through the projection endpoint -->`
      : `<!-- snapshot frozen at ${projectionTime}, DAG head ${dagHead} -->`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>EO Substrate: ${appSpec.site.space_or_room}</title>
</head>
<body>
${provenance}
<div id="root"></div>
<script type="importmap">{"imports": {"eo-kernel/": "./kernel/", "eo-surfaces/": "./surfaces/"}}</script>
<script type="module">
  import * as kernel from './kernel/index.js';
  import * as surfaces from './surfaces/index.js';
  const appSpec = await (await fetch('./spec/appspec.json')).json();
  // mounts each surface named in appSpec.surfaces against the projection
  // (live mode) or ./projection/meant-graph.json (snapshot mode)
</script>
</body>
</html>
`;
}

export async function exportBundle(appSpec, mode, options = {}) {
  if (mode !== 'live' && mode !== 'snapshot') {
    throw new RangeError('mode must be "live" or "snapshot"');
  }

  const { valid, errors, residue } = validateAppSpec(appSpec);
  if (!valid) {
    return { ok: false, errors, residue };
  }

  const {
    kernelFiles,
    surfaceFiles,
    meantGraph,
    dagHead,
    projectionTime,
    mediaFiles = {},
    outputType = 'nodebuffer',
  } = options;

  if (!kernelFiles || typeof kernelFiles !== 'object' || Object.keys(kernelFiles).length === 0) {
    throw new TypeError('exportBundle requires kernelFiles: { "relative/path.js": content }');
  }
  if (!surfaceFiles || typeof surfaceFiles !== 'object' || Object.keys(surfaceFiles).length === 0) {
    throw new TypeError('exportBundle requires surfaceFiles: { "relative/path.js": content }');
  }
  if (mode === 'snapshot' && (!meantGraph || !dagHead || !projectionTime)) {
    throw new TypeError('snapshot mode requires meantGraph, dagHead, and projectionTime');
  }

  const surfaceTypes = [...new Set(appSpec.surfaces.map((s) => s.type))];

  const zip = new JSZip();
  for (const [path, content] of Object.entries(kernelFiles)) {
    zip.file(`kernel/${path}`, content);
  }
  for (const [path, content] of Object.entries(surfaceFiles)) {
    zip.file(`surfaces/${path}`, content);
  }
  zip.file('spec/appspec.json', JSON.stringify(appSpec, null, 2));
  if (mode === 'snapshot') {
    zip.file('projection/meant-graph.json', JSON.stringify(meantGraph, null, 2));
  }
  for (const [cid, content] of Object.entries(mediaFiles)) {
    zip.file(`media/${cid}`, content);
  }

  const manifest = {
    rules_rev: appSpec.rules_rev,
    mode,
    room: appSpec.site.space_or_room,
    surfaces: surfaceTypes,
    ...(mode === 'snapshot' ? { dagHead, projectionTime } : {}),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('index.html', bootstrapHtml(appSpec, mode, dagHead, projectionTime));
  zip.file('vendor/.gitkeep', '');

  const blob = await zip.generateAsync({ type: outputType });
  return { ok: true, blob, manifest };
}
