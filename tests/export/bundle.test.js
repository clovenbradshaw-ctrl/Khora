import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import JSZip from 'jszip';
import { exportBundle } from '../../src/export/bundle.js';
import { makeValidAppSpec } from '../generator/fixtures.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../src');

function readSrc(relPath) {
  return readFileSync(path.join(srcRoot, relPath), 'utf8');
}

const kernelFiles = {
  'index.js': readSrc('kernel/index.js'),
  'address.js': readSrc('kernel/address.js'),
};
const surfaceFiles = {
  'table.js': readSrc('surfaces/table.js'),
  'form.js': readSrc('surfaces/form.js'),
};

describe('exportBundle', () => {
  it('rejects an invalid mode', async () => {
    await expect(exportBundle(makeValidAppSpec(), 'weird')).rejects.toThrow(RangeError);
  });

  it('refuses an invalid AppSpec instead of exporting garbage', async () => {
    const result = await exportBundle({ rules_rev: 'stale' }, 'live', { kernelFiles, surfaceFiles });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('requires kernelFiles and surfaceFiles', async () => {
    await expect(exportBundle(makeValidAppSpec(), 'live', { surfaceFiles })).rejects.toThrow(TypeError);
    await expect(exportBundle(makeValidAppSpec(), 'live', { kernelFiles })).rejects.toThrow(TypeError);
  });

  it('snapshot mode requires meantGraph, dagHead, and projectionTime', async () => {
    await expect(exportBundle(makeValidAppSpec(), 'snapshot', { kernelFiles, surfaceFiles })).rejects.toThrow(TypeError);
  });

  it('produces a zip tree with the documented layout for live mode', async () => {
    const result = await exportBundle(makeValidAppSpec(), 'live', { kernelFiles, surfaceFiles });
    expect(result.ok).toBe(true);

    const zip = await JSZip.loadAsync(result.blob);
    const names = Object.entries(zip.files)
      .filter(([, file]) => !file.dir)
      .map(([name]) => name)
      .sort();
    expect(names).toEqual(
      [
        'index.html',
        'kernel/address.js',
        'kernel/index.js',
        'manifest.json',
        'spec/appspec.json',
        'surfaces/form.js',
        'surfaces/table.js',
        'vendor/.gitkeep',
      ].sort(),
    );

    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    expect(manifest).toMatchObject({ rules_rev: '2026-07-05.a', mode: 'live', surfaces: ['Table', 'Form'] });
    expect(manifest.dagHead).toBeUndefined();

    const spec = JSON.parse(await zip.file('spec/appspec.json').async('string'));
    expect(spec.site.space_or_room).toBe('space:procurement');

    const kernelIndex = await zip.file('kernel/index.js').async('string');
    expect(kernelIndex).toBe(kernelFiles['index.js']);
  });

  it('produces a projection/ directory and stamped manifest for snapshot mode', async () => {
    const result = await exportBundle(makeValidAppSpec(), 'snapshot', {
      kernelFiles,
      surfaceFiles,
      meantGraph: { nodes: [{ id: 'a' }] },
      dagHead: '$event123',
      projectionTime: '2026-07-05T00:00:00Z',
    });
    expect(result.ok).toBe(true);

    const zip = await JSZip.loadAsync(result.blob);
    expect(Object.keys(zip.files)).toContain('projection/meant-graph.json');

    const projection = JSON.parse(await zip.file('projection/meant-graph.json').async('string'));
    expect(projection).toEqual({ nodes: [{ id: 'a' }] });

    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    expect(manifest).toMatchObject({ mode: 'snapshot', dagHead: '$event123', projectionTime: '2026-07-05T00:00:00Z' });

    const html = await zip.file('index.html').async('string');
    expect(html).toContain('DAG head $event123');
  });

  it('includes media files keyed by content id when supplied', async () => {
    const result = await exportBundle(makeValidAppSpec(), 'live', {
      kernelFiles,
      surfaceFiles,
      mediaFiles: { 'cid:abc123': 'fake-image-bytes' },
    });
    const zip = await JSZip.loadAsync(result.blob);
    expect(await zip.file('media/cid:abc123').async('string')).toBe('fake-image-bytes');
  });
});
