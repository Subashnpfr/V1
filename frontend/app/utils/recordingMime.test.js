import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_RECORDING_DURATION_SECONDS,
  extensionForMime,
  formatTimer,
  pickRecordingMimeType
} from './recordingMime.js';

describe('pickRecordingMimeType', () => {
  it('prefers webm opus when supported', () => {
    const mime = pickRecordingMimeType((t) => t === 'audio/webm;codecs=opus');
    assert.equal(mime, 'audio/webm;codecs=opus');
  });

  it('falls back to mp4', () => {
    const mime = pickRecordingMimeType((t) => t === 'audio/mp4');
    assert.equal(mime, 'audio/mp4');
  });

  it('returns empty when nothing is supported', () => {
    assert.equal(pickRecordingMimeType(() => false), '');
  });
});

describe('extensionForMime', () => {
  it('maps ogg and mp4', () => {
    assert.equal(extensionForMime('audio/ogg;codecs=opus'), 'ogg');
    assert.equal(extensionForMime('audio/mp4'), 'm4a');
    assert.equal(extensionForMime('audio/webm'), 'webm');
  });
});

describe('limits', () => {
  it('exposes a finite maximum', () => {
    assert.equal(MAX_RECORDING_DURATION_SECONDS, 1800);
    assert.equal(formatTimer(34), '00:34');
  });
});
