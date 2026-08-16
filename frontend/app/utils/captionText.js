const DEVANAGARI = /[\u0900-\u097F]/g;
const LATIN = /[A-Za-z]/g;
const JUNK = /^(?:[|¦]+|♪+|♫+|…+|\.{2,}|[-–—]+|\/+|\\+|\[(?:music|applause|laughter|inaudible)\]|\((?:music|applause)\))$/i;

export function isJunkToken(token) {
  const t = String(token || '').trim();
  if (!t) return true;
  return JUNK.test(t);
}

export function sanitizeCaptionText(text) {
  if (!text || typeof text !== 'string') return '';

  let out = text.replace(/\u00a0/g, ' ').replace(/[|¦]/g, ' ');
  out = out.replace(/[♪♫]+/g, ' ');
  out = out.replace(/\[(?:music|applause|laughter|inaudible)\]/gi, ' ');
  out = out.replace(/\((?:music|applause)\)/gi, ' ');

  out = out.split(/\s+/).filter((tok) => !isJunkToken(tok)).join(' ');

  const letters = (out.match(DEVANAGARI) || []).length + (out.match(LATIN) || []).length;
  const dev = (out.match(DEVANAGARI) || []).length;
  const isDev = letters > 0 && dev / letters >= 0.3;

  if (!isDev) {
    out = out.replace(/।/g, '.');
    out = out.replace(/\.{2,}/g, '.');
    out = out.replace(/\s+([.,!?;:])/g, '$1');
    out = out.replace(/^[.,;:]+|[.,;:]+$/g, '');
  }

  return out.replace(/\s+/g, ' ').trim();
}

export function sanitizeSubtitleList(subtitles = []) {
  return (subtitles || [])
    .map((sub) => {
      const words = (sub.words || [])
        .map((w) => ({ ...w, text: sanitizeCaptionText(w.text || '') }))
        .filter((w) => w.text && !isJunkToken(w.text));
      const text = sanitizeCaptionText(sub.text || '') || words.map((w) => w.text).join(' ');
      return { ...sub, text, words };
    })
    .filter((sub) => sub.text);
}
