import React from 'react';
import { createRoot } from 'react-dom/client';
import SubtitleOverlay from '../components/SubtitleOverlay';
import { renderNodeToPngDataUrl } from './renderSubtitleToPng';

export async function generateSubtitlePngFrames({
  subtitles = [],
  styleConfig = {},
  animationConfig = {},
  videoWidth = 1920,
  videoHeight = 1080,
  onProgress
}) {
  if (!subtitles || subtitles.length === 0) return [];

  if (typeof window !== 'undefined' && document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Offscreen container for high-fidelity DOM snapshotting
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0px';
  container.style.top = '0px';
  container.style.width = `${videoWidth}px`;
  container.style.height = `${videoHeight}px`;
  container.style.backgroundColor = 'transparent';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.opacity = '1';
  container.style.visibility = 'visible';
  document.body.appendChild(container);

  const root = createRoot(container);
  const rawFrames = [];

  const preset = animationConfig.preset || 'none';

  try {
    for (let i = 0; i < subtitles.length; i++) {
      const sub = subtitles[i];
      if (!sub.text || sub.text.trim() === '') continue;

      const subStart = sub.start;
      const subEnd = sub.end;
      const totalDur = subEnd - subStart;
      if (totalDur <= 0.05) continue;

      const timeSlices = [];

      // Determine time slice partitioning strategy
      const isContinuousAnim = [
        'karaoke', 'typewriter', 'typewriter-word', 'bounce',
        'fade-in', 'slide-up', 'scale-in', 'pulse', 'popup'
      ].includes(preset);

      if (isContinuousAnim) {
        // Continuous animation sampling (10 fps -> 0.10s step) for super fluid motion
        const step = 0.10;
        let curr = subStart;
        while (curr < subEnd) {
          const next = Math.min(subEnd, curr + step);
          timeSlices.push({
            start: curr,
            end: next,
            sampleTime: (curr + next) / 2
          });
          curr = next;
        }
      } else if (preset === 'highlight-word' || preset === 'popup-word') {
        // Partition subStart..subEnd continuously at word boundaries to keep subtitle visible 100% of duration
        const words = sub.words || [];
        const boundaries = new Set([subStart, subEnd]);
        for (const w of words) {
          if (w.start >= subStart && w.start <= subEnd) boundaries.add(w.start);
          if (w.end >= subStart && w.end <= subEnd) boundaries.add(w.end);
        }
        const sorted = Array.from(boundaries).sort((a, b) => a - b);
        for (let b = 0; b < sorted.length - 1; b++) {
          const t1 = sorted[b];
          const t2 = sorted[b + 1];
          if (t2 - t1 > 0.02) {
            timeSlices.push({
              start: t1,
              end: t2,
              sampleTime: (t1 + t2) / 2
            });
          }
        }
      } else {
        // Static preset ('none') — 1 frame for full duration
        timeSlices.push({
          start: subStart,
          end: subEnd,
          sampleTime: subStart + totalDur / 2
        });
      }

      // Render each time slice
      for (let tIdx = 0; tIdx < timeSlices.length; tIdx++) {
        const slice = timeSlices[tIdx];

        await new Promise((resolve) => {
          root.render(
            <div style={{ position: 'relative', width: `${videoWidth}px`, height: `${videoHeight}px`, background: 'transparent' }}>
              <SubtitleOverlay
                subtitle={sub}
                styleConfig={styleConfig}
                animationConfig={animationConfig}
                currentTime={slice.sampleTime}
                targetHeight={videoHeight}
              />
            </div>
          );
          setTimeout(resolve, 60);
        });

        let dataUrl = null;
        try {
          dataUrl = await renderNodeToPngDataUrl(container, videoWidth, videoHeight);
        } catch (captureErr) {
          console.error(`[DOM_PNG_CAPTURE] Frame capture error sub ${i}_${tIdx}:`, captureErr);
        }

        if (dataUrl) {
          rawFrames.push({
            sub_id: sub.id,
            index: `${i}_${tIdx}`,
            start: slice.start,
            end: slice.end,
            image_data: dataUrl
          });
        }
      }

      if (onProgress) {
        onProgress(Math.round(((i + 1) / subtitles.length) * 100));
      }
    }
  } finally {
    root.unmount();
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }

  // Merge contiguous identical frames to optimize timeline & payload
  const optimizedFrames = [];
  for (const frame of rawFrames) {
    if (optimizedFrames.length === 0) {
      optimizedFrames.push({ ...frame });
    } else {
      const prev = optimizedFrames[optimizedFrames.length - 1];
      if (prev.sub_id === frame.sub_id && prev.image_data === frame.image_data && Math.abs(prev.end - frame.start) < 0.01) {
        prev.end = frame.end;
      } else {
        optimizedFrames.push({ ...frame });
      }
    }
  }

  if (optimizedFrames.length === 0) {
    throw new Error('No subtitle frames were generated. Check that subtitles have text content.');
  }

  return optimizedFrames;
}
