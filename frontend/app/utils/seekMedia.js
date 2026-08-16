export function applySeek(mediaEl, seconds) {
  if (!mediaEl || seconds == null || Number.isNaN(Number(seconds))) return false;
  const t = Math.max(0, Number(seconds));
  mediaEl.currentTime = t;
  return mediaEl.currentTime === t || Math.abs(mediaEl.currentTime - t) < 0.25;
}
