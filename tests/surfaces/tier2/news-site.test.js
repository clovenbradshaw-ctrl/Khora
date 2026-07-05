import { describe, it, expect, afterEach } from 'vitest';
import { InMemoryLog } from '../../../src/kernel/log.js';
import { createNewsSiteSurface } from '../../../src/surfaces/tier2/news-site.js';
import { setEnabled } from '../../../src/surfaces/tier2/flags.js';

const provenance = { agent: 'user:editor', mode_of_givenness: 'direct-report', context: 'news-ui' };

function makeStubController(bindingName) {
  const calls = [];
  return {
    calls,
    homeTerrain: 'Stub',
    async read(query = {}) {
      return { posts: [{ postId: query.postId ?? null, body: 'stub content' }] };
    },
    bindings: {
      [bindingName]: async (payload, callProvenance) => {
        calls.push({ payload, provenance: callProvenance });
        if (!callProvenance) {
          return { ok: false, reason: 'invalid', errors: ['stub: missing provenance'] };
        }
        return { ok: true, reason: 'appended', entry: { payload } };
      },
    },
    fallback() {
      return { posts: [], stale: true };
    },
  };
}

function makeControllers() {
  return {
    feedController: makeStubController('post'),
    formController: makeStubController('submit'),
  };
}

describe('createNewsSiteSurface', () => {
  afterEach(() => setEnabled('news-site', false));

  it('refuses every write binding while the news-site flag is off, without touching the delegates or the log', async () => {
    const log = new InMemoryLog();
    const { feedController, formController } = makeControllers();
    const news = createNewsSiteSurface({ log, feedController, formController });

    const results = await Promise.all([
      news.bindings.publish({ pieceId: 'p1', body: 'story' }, provenance),
      news.bindings.correction({ pieceId: 'p1', correctedText: 'fixed' }, provenance),
      news.bindings.editorialJudgment({ pieceId: 'p1', judgment: 'stands' }, provenance),
      news.bindings.retractOrReframe({ pieceId: 'p1', reason: 'source recanted' }, provenance),
      news.bindings.submitTip({ body: 'tip' }, provenance),
    ]);

    for (const result of results) {
      expect(result).toEqual({ ok: false, reason: 'disabled', flag: 'news-site' });
    }
    expect(feedController.calls).toHaveLength(0);
    expect(formController.calls).toHaveLength(0);
    expect((await log.slice()).length).toBe(0);
  });

  it('wires publish to the feed controller and submitTip to the form controller, and no other', async () => {
    const log = new InMemoryLog();
    const { feedController, formController } = makeControllers();
    const news = createNewsSiteSurface({ log, feedController, formController });
    setEnabled('news-site', true);

    const publishResult = await news.bindings.publish({ pieceId: 'p1', body: 'story' }, provenance);
    expect(publishResult.ok).toBe(true);
    expect(feedController.calls).toHaveLength(1);
    expect(formController.calls).toHaveLength(0);

    const tipResult = await news.bindings.submitTip({ body: 'tip' }, provenance);
    expect(tipResult.ok).toBe(true);
    expect(formController.calls).toHaveLength(1);
    expect(feedController.calls).toHaveLength(1); // unchanged
  });

  it('appends correction, editorial judgment, and retraction directly to the private editing room', async () => {
    const log = new InMemoryLog();
    const { feedController, formController } = makeControllers();
    const news = createNewsSiteSurface({ log, feedController, formController });
    setEnabled('news-site', true);

    await news.bindings.correction({ pieceId: 'p1', correctedText: 'fixed' }, provenance);
    await news.bindings.editorialJudgment({ pieceId: 'p1', judgment: 'stands, with caveats' }, provenance);
    await news.bindings.retractOrReframe({ pieceId: 'p1', reason: 'source recanted' }, provenance);

    const entries = (await log.slice()).map(({ entry }) => entry);
    expect(entries.map((e) => e.emit.op)).toEqual(['DEF', 'EVA', 'REC']);
    expect(entries.every((e) => e.target === 'p1')).toBe(true);
  });

  it('still refuses an invalid binding even with the flag on', async () => {
    const log = new InMemoryLog();
    const { feedController, formController } = makeControllers();
    const news = createNewsSiteSurface({ log, feedController, formController });
    setEnabled('news-site', true);

    const correctionResult = await news.bindings.correction({ pieceId: 'p1' }, undefined);
    expect(correctionResult.ok).toBe(false);
    expect(correctionResult.reason).toBe('invalid');
    expect((await log.slice()).length).toBe(0);

    const publishResult = await news.bindings.publish({ pieceId: 'p1' }, undefined);
    expect(publishResult.ok).toBe(false);
    expect(publishResult.reason).toBe('invalid');
  });

  it('reads a single piece as the composition of the published feed entry and its private editorial history', async () => {
    const log = new InMemoryLog();
    const { feedController, formController } = makeControllers();
    const news = createNewsSiteSurface({ log, feedController, formController });
    setEnabled('news-site', true);

    await news.bindings.correction({ pieceId: 'p1', correctedText: 'fixed' }, provenance);

    const piece = await news.read({ pieceId: 'p1' });
    expect(piece.pieceId).toBe('p1');
    expect(piece.published).toEqual([{ postId: 'p1', body: 'stub content' }]);
    expect(piece.editorial).toHaveLength(1);
    expect(piece.editorial[0].emit.op).toBe('DEF');
  });
});
