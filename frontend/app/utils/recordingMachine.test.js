import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECORDING_PHASE,
  initialRecordingState,
  recordingReducer,
  revokePreviewUrl,
  stopMediaTracks
} from './recordingMachine.js';

describe('recordingReducer', () => {
  it('moves through permission, record, pause, resume, complete', () => {
    let state = initialRecordingState;
    state = recordingReducer(state, { type: 'REQUEST_PERMISSION' });
    assert.equal(state.phase, RECORDING_PHASE.requesting_permission);
    state = recordingReducer(state, { type: 'READY' });
    state = recordingReducer(state, { type: 'START' });
    assert.equal(state.phase, RECORDING_PHASE.recording);
    state = recordingReducer(state, { type: 'PAUSE' });
    assert.equal(state.phase, RECORDING_PHASE.paused);
    state = recordingReducer(state, { type: 'RESUME' });
    assert.equal(state.phase, RECORDING_PHASE.recording);
    state = recordingReducer(state, { type: 'PROCESSING' });
    state = recordingReducer(state, { type: 'COMPLETED' });
    assert.equal(state.phase, RECORDING_PHASE.completed);
  });

  it('maps permission denied', () => {
    const state = recordingReducer(initialRecordingState, {
      type: 'ERROR',
      errorCode: 'MICROPHONE_PERMISSION_DENIED',
      error: 'denied'
    });
    assert.equal(state.phase, RECORDING_PHASE.error);
    assert.equal(state.errorCode, 'MICROPHONE_PERMISSION_DENIED');
  });

  it('reset returns idle', () => {
    const state = recordingReducer(
      { ...initialRecordingState, phase: RECORDING_PHASE.recording, elapsed: 12 },
      { type: 'RESET' }
    );
    assert.equal(state.phase, RECORDING_PHASE.idle);
    assert.equal(state.elapsed, 0);
  });
});

describe('cleanup', () => {
  it('stops all media tracks', () => {
    const stopped = [];
    const stream = {
      getTracks: () => [
        { stop: () => stopped.push('a') },
        { stop: () => stopped.push('b') }
      ]
    };
    assert.equal(stopMediaTracks(stream), 2);
    assert.deepEqual(stopped, ['a', 'b']);
  });

  it('revokes object URLs', () => {
    const original = globalThis.URL;
    let revoked = null;
    globalThis.URL = { revokeObjectURL: (u) => { revoked = u; } };
    try {
      assert.equal(revokePreviewUrl('blob:test'), true);
      assert.equal(revoked, 'blob:test');
    } finally {
      globalThis.URL = original;
    }
  });
});
