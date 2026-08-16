import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applySeek } from './seekMedia.js';

describe('applySeek', () => {
  it('sets currentTime on a media-like object', () => {
    const media = { currentTime: 0 };
    assert.equal(applySeek(media, 12.5), true);
    assert.equal(media.currentTime, 12.5);
  });

  it('rejects null media', () => {
    assert.equal(applySeek(null, 1), false);
  });
});
