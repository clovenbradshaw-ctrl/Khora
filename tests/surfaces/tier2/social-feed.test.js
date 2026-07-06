import { describe, it, expect, afterEach } from 'vitest';
import { InMemoryLog } from '../../../src/kernel/log.js';
import { createSocialFeedSurface } from '../../../src/surfaces/tier2/social-feed.js';
import { setEnabled } from '../../../src/surfaces/tier2/flags.js';

const provenance = { agent: 'user:alice', mode_of_givenness: 'direct-report', context: 'feed-ui' };

describe('createSocialFeedSurface', () => {
  afterEach(() => setEnabled('social-feed', false));

  it('refuses every write binding while the flag is off, and appends nothing', async () => {
    const log = new InMemoryLog();
    const feed = createSocialFeedSurface({ log });

    const results = await Promise.all([
      feed.bindings.post({ body: 'hello' }, provenance),
      feed.bindings.follow({ room: 'room:user:bob' }, provenance),
      feed.bindings.react({ postId: 'p1', reaction: 'like' }, provenance),
      feed.bindings.reply({ threadRoot: 'p1', body: 'nice' }, provenance),
    ]);

    for (const result of results) {
      expect(result).toEqual({ ok: false, reason: 'disabled', flag: 'social-feed' });
    }
    expect((await log.slice()).length).toBe(0);
  });

  it('appends a valid post into the acting user\'s own room once enabled', async () => {
    const log = new InMemoryLog();
    const feed = createSocialFeedSurface({ log });
    setEnabled('social-feed', true);

    const result = await feed.bindings.post({ body: 'hello' }, provenance);

    expect(result.ok).toBe(true);
    expect(result.entry.target).toBe('room:user:alice');
    const { posts } = await feed.read({ rooms: ['room:user:alice'] });
    expect(posts).toHaveLength(1);
  });

  it('still refuses a binding missing its provenance envelope, even with the flag on', async () => {
    const log = new InMemoryLog();
    const feed = createSocialFeedSurface({ log });
    setEnabled('social-feed', true);

    const result = await feed.bindings.post({ body: 'hello' }, undefined);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid');
    expect((await log.slice()).length).toBe(0);
  });
});
