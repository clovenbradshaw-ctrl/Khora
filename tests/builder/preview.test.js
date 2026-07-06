import { describe, it, expect } from 'vitest';
import { isPreviewable, renderTablePreview, renderFormPreview, mountPreview } from '../../src/builder/preview.js';

describe('preview', () => {
  it('only claims a live preview for Table and Form', () => {
    expect(isPreviewable('Table')).toBe(true);
    expect(isPreviewable('Form')).toBe(true);
    expect(isPreviewable('Chart')).toBe(false);
    expect(isPreviewable('Board')).toBe(false);
  });

  it('refuses to run rather than silently no-op-ing without a DOM', async () => {
    await expect(renderTablePreview({}, {}, {})).rejects.toThrow(/requires a browser DOM/);
    await expect(renderFormPreview({}, {}, {})).rejects.toThrow(/requires a browser DOM/);
    await expect(mountPreview([], {}, {})).rejects.toThrow(/requires a browser DOM/);
  });
});
