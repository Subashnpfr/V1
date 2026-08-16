export const RECORDING_PHASE = {
  idle: 'idle',
  requesting_permission: 'requesting_permission',
  ready: 'ready',
  recording: 'recording',
  paused: 'paused',
  processing_recording: 'processing_recording',
  completed: 'completed',
  error: 'error'
};

export const initialRecordingState = {
  phase: RECORDING_PHASE.idle,
  error: null,
  errorCode: null,
  elapsed: 0
};

export function recordingReducer(state, action) {
  switch (action.type) {
    case 'REQUEST_PERMISSION':
      return { ...state, phase: RECORDING_PHASE.requesting_permission, error: null, errorCode: null };
    case 'READY':
      return { ...state, phase: RECORDING_PHASE.ready, error: null, errorCode: null };
    case 'START':
      return { ...state, phase: RECORDING_PHASE.recording, elapsed: 0, error: null, errorCode: null };
    case 'TICK':
      return { ...state, elapsed: action.elapsed };
    case 'PAUSE':
      if (state.phase !== RECORDING_PHASE.recording) return state;
      return { ...state, phase: RECORDING_PHASE.paused };
    case 'RESUME':
      if (state.phase !== RECORDING_PHASE.paused) return state;
      return { ...state, phase: RECORDING_PHASE.recording };
    case 'PROCESSING':
      return { ...state, phase: RECORDING_PHASE.processing_recording };
    case 'COMPLETED':
      return { ...state, phase: RECORDING_PHASE.completed, error: null, errorCode: null };
    case 'ERROR':
      return {
        ...state,
        phase: RECORDING_PHASE.error,
        error: action.error || 'Recording failed',
        errorCode: action.errorCode || 'RECORDING_FAILED'
      };
    case 'RESET':
      return { ...initialRecordingState };
    default:
      return state;
  }
}

export function stopMediaTracks(stream) {
  if (!stream || typeof stream.getTracks !== 'function') return 0;
  const tracks = stream.getTracks();
  tracks.forEach((track) => {
    if (typeof track.stop === 'function') track.stop();
  });
  return tracks.length;
}

export function revokePreviewUrl(url) {
  if (!url || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return false;
  URL.revokeObjectURL(url);
  return true;
}
