export const MAX_RECORDING_DURATION_SECONDS = 1800;

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg'
];

export function pickRecordingMimeType(isTypeSupported) {
  if (typeof isTypeSupported !== 'function') return '';
  for (const mime of MIME_CANDIDATES) {
    try {
      if (isTypeSupported(mime)) return mime;
    } catch (err) {
      continue;
    }
  }
  return '';
}

export function extensionForMime(mime) {
  const value = (mime || '').toLowerCase();
  if (value.includes('ogg')) return 'ogg';
  if (value.includes('mp4') || value.includes('m4a')) return 'm4a';
  return 'webm';
}

export function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
