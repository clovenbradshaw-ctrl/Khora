import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { exportSingleFile } from '../../src/export/single-file.js';
import { makeValidAppSpec } from '../generator/fixtures.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../src');

function readSrc(relPath) {
  return readFileSync(path.join(srcRoot, relPath), 'utf8');
}

// address.js has no internal imports, so it's realistically inlinable as-is;
// the barrel (index.js) re-exports via relative paths that won't resolve
// once everything is flattened into one <script>, so it's not what a real
// exporter would inline here.
const kernelSource = readSrc('kernel/address.js');
const surfaceSources = {
  Table: readSrc('surfaces/table.js'),
  Form: readSrc('surfaces/form.js'),
};

describe('exportSingleFile', () => {
  it('rejects an invalid mode', () => {
    expect(() => exportSingleFile(makeValidAppSpec(), 'weird')).toThrow(RangeError);
  });

  it('refuses an invalid AppSpec instead of exporting garbage', () => {
    const result = exportSingleFile({ rules_rev: 'stale' }, 'live', { kernelSource, surfaceSources });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('requires kernelSource', () => {
    expect(() => exportSingleFile(makeValidAppSpec(), 'live', { surfaceSources })).toThrow(TypeError);
  });

  it('requires source for every surface type the spec names', () => {
    expect(() => exportSingleFile(makeValidAppSpec(), 'live', { kernelSource, surfaceSources: { Table: surfaceSources.Table } })).toThrow(
      /Form/,
    );
  });

  it('live mode inlines the kernel and surfaces and needs no snapshot data', () => {
    const result = exportSingleFile(makeValidAppSpec(), 'live', { kernelSource, surfaceSources });
    expect(result.ok).toBe(true);
    expect(result.surfaceTypes).toEqual(['Table', 'Form']);
    expect(result.html).toContain('projection endpoint');
    expect(result.html).toContain('__EO_LIVE_ROOM__');
    expect(result.html).toContain('faceOf'); // proof the real kernel source landed inline
    expect(result.html).not.toContain('<script src='); // nothing loads externally at open time
  });

  it('snapshot mode requires provenance and stamps it in the file', () => {
    const spec = makeValidAppSpec();
    expect(() => exportSingleFile(spec, 'snapshot', { kernelSource, surfaceSources })).toThrow(TypeError);

    const result = exportSingleFile(spec, 'snapshot', {
      kernelSource,
      surfaceSources,
      meantGraph: { nodes: [{ id: 'a' }] },
      dagHead: '$event123',
      projectionTime: '2026-07-05T00:00:00Z',
    });
    expect(result.ok).toBe(true);
    expect(result.html).toContain('dagHead: $event123');
    expect(result.html).toContain('rules_rev: 2026-07-05.a');
    expect(result.html).toContain('__EO_SNAPSHOT__');
    expect(result.html).toContain('"id":"a"');
  });
});
