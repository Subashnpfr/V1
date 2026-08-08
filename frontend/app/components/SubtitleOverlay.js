'use client';

import React from 'react';

export function wrapSubtitleText(text, maxChars = 36) {
  if (!text || text.length <= maxChars || text.includes('\n')) return text;
  const words = text.split(/\s+/);
  const lines = [];
  let currLine = [];
  let currLen = 0;

  for (const w of words) {
    if (currLen + w.length + (currLine.length > 0 ? 1 : 0) <= maxChars) {
      currLine.push(w);
      currLen += w.length + (currLine.length > 1 ? 1 : 0);
    } else {
      if (currLine.length > 0) lines.push(currLine.join(' '));
      currLine = [w];
      currLen = w.length;
    }
  }
  if (currLine.length > 0) lines.push(currLine.join(' '));
  return lines.join('\n');
}

export function hexToRgba(hex, alpha = 1.0) {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

export function getFontFamilyStack(fontFamily) {
  const chosenFont = fontFamily || 'Noto Sans Devanagari';
  return `"${chosenFont}", "Noto Sans Devanagari", "Mukta", "Hind", "Inter", sans-serif`;
}

export function computeStyleModel(styleConfig = {}, targetHeight = 540) {
  const baseFontSize = styleConfig.fontSize || 24;
  const fontScale = baseFontSize / 540.0;

  const fontPx = Math.max(12, Math.round(targetHeight * fontScale));
  const baseMarginV = styleConfig.marginV ?? 30;
  const bottomMarginPx = Math.round(targetHeight * (baseMarginV / 540.0));
  const marginLRPx = Math.round(targetHeight * (20.0 / 540.0));

  const rawOutline = styleConfig.outlineWidth ?? 1;
  const rawShadow = styleConfig.shadowBlur ?? 4;
  const outlineW = Math.max(0, Math.round((rawOutline / 540.0) * targetHeight));
  const shadowB = Math.max(0, Math.round((rawShadow / 540.0) * targetHeight));

  const paddingV = Math.max(4, Math.round(outlineW * 1.5 + fontPx * 0.12));
  const paddingH = Math.max(8, Math.round(outlineW * 2.0 + fontPx * 0.25));

  return {
    fontPx,
    bottomMarginPx,
    marginLRPx,
    outlineW,
    shadowB,
    paddingV,
    paddingH,
    fontScale
  };
}

export function getOutlineShadowCss(styleConfig = {}, outlineW = 1, shadowB = 4) {
  const outlineC = styleConfig.outlineColor || '#000000';
  const shadowC = styleConfig.shadowColor || 'rgba(0,0,0,0.7)';

  const shadows = [];
  if (outlineW > 0) {
    shadows.push(`0 -${outlineW}px 0 ${outlineC}`);
    shadows.push(`${outlineW}px -${outlineW}px 0 ${outlineC}`);
    shadows.push(`${outlineW}px 0 0 ${outlineC}`);
    shadows.push(`${outlineW}px ${outlineW}px 0 ${outlineC}`);
    shadows.push(`0 ${outlineW}px 0 ${outlineC}`);
    shadows.push(`-${outlineW}px ${outlineW}px 0 ${outlineC}`);
    shadows.push(`-${outlineW}px 0 0 ${outlineC}`);
    shadows.push(`-${outlineW}px -${outlineW}px 0 ${outlineC}`);
  }
  if (shadowB > 0) {
    shadows.push(`${Math.round(shadowB * 0.5)}px ${Math.round(shadowB * 0.7)}px ${shadowB}px ${shadowC}`);
  }

  return shadows.length > 0 ? shadows.join(', ') : 'none';
}

export default function SubtitleOverlay({
  subtitle,
  styleConfig = {},
  animationConfig = {},
  currentTime = 0,
  targetHeight = 540,
  showBoxBounds = false
}) {
  if (!subtitle || !subtitle.text) return null;

  const model = computeStyleModel(styleConfig, targetHeight);
  const preset = animationConfig.preset || 'none';
  const highlightColor = animationConfig.highlightColor || '#F59E0B';
  const enablePill = animationConfig.roundedBackground !== false;
  const typewriterSpeed = animationConfig.typewriterSpeed || 'medium';
  const cursorOn = animationConfig.showCursor !== false;

  const maxChars = styleConfig.maxCharsPerLine || 36;
  const wrappedText = wrapSubtitleText(subtitle.text, maxChars);
  const linesText = wrappedText.split('\n');

  let words = subtitle.words;
  const isWordsMatchingText = Array.isArray(words) && words.length > 0 && subtitle.text.includes(words[0]?.text || '');
  if (!words || !Array.isArray(words) || words.length === 0 || !isWordsMatchingText) {
    const rawWords = wrappedText.trim().split(/\s+/).filter(Boolean);
    const totalDur = Math.max(0.1, subtitle.end - subtitle.start);
    const wordDur = totalDur / Math.max(1, rawWords.length);
    words = rawWords.map((w, idx) => ({
      text: w,
      start: subtitle.start + idx * wordDur,
      end: subtitle.start + (idx + 1) * wordDur,
      emphasized: false
    }));
  }

  // Partition words by line break so \n is 100% strictly preserved during word animation
  const linesOfWords = [];
  let wPointer = 0;
  for (const lineStr of linesText) {
    const lineWordStrs = lineStr.trim().split(/\s+/).filter(Boolean);
    const lineWordObjs = [];
    for (let i = 0; i < lineWordStrs.length; i++) {
      if (wPointer < words.length) {
        lineWordObjs.push(words[wPointer]);
        wPointer++;
      } else {
        lineWordObjs.push({ text: lineWordStrs[i], start: subtitle.start, end: subtitle.end });
      }
    }
    linesOfWords.push({ text: lineStr, words: lineWordObjs });
  }

  const renderContent = () => {
    if (preset === 'none') {
      return <span>{wrappedText}</span>;
    }

    if (preset === 'typewriter') {
      const speedMultiplier = typewriterSpeed === 'fast' ? 40 : typewriterSpeed === 'slow' ? 15 : 25;
      const elapsedSec = Math.max(0, currentTime - subtitle.start);
      const charCount = Math.floor(elapsedSec * speedMultiplier);
      const visibleText = wrappedText.slice(0, Math.min(wrappedText.length, charCount));

      return (
        <span>
          {visibleText}
          {cursorOn && charCount < wrappedText.length && <span className="typewriter-cursor" />}
        </span>
      );
    }

    if (preset === 'typewriter-word') {
      return (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.25em', width: '100%' }}>
          {linesOfWords.map((lObj, lIdx) => {
            const visWords = lObj.words.filter(w => currentTime >= w.start).map(w => w.text);
            return <span key={lIdx}>{visWords.join(' ')}</span>;
          })}
        </span>
      );
    }

    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.25em', width: '100%' }}>
        {linesOfWords.map((lObj, lIdx) => (
          <span key={lIdx} style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.35em' }}>
            {lObj.words.map((wObj, idx) => {
              const isSpoken = currentTime >= wObj.start && currentTime <= wObj.end;
              const isPast = currentTime > wObj.end;
              const isEmphasized = wObj.emphasized;

              let wordStyle = {
                display: 'inline-block',
                borderRadius: enablePill ? '6px' : '0',
                padding: enablePill ? '0.1em 0.35em' : '0'
              };

              let wordClass = '';

              if (isEmphasized) {
                wordStyle.fontWeight = '900';
                wordStyle.color = highlightColor;
              }

              if (preset === 'highlight-word' && isSpoken) {
                wordStyle.color = '#111111';
                wordStyle.backgroundColor = highlightColor;
                wordStyle.fontWeight = '700';
              } else if (preset === 'karaoke') {
                if (isSpoken) {
                  wordStyle.color = highlightColor;
                  wordStyle.fontWeight = '800';
                } else if (isPast) {
                  wordStyle.color = highlightColor;
                }
              } else if (preset === 'bounce' && isSpoken) {
                wordClass = 'word-bounce';
                wordStyle.color = highlightColor;
              } else if (preset === 'popup-word' && isSpoken) {
                wordClass = 'word-popup';
              } else if (preset === 'slide-up' && isSpoken) {
                wordClass = 'word-slide-up';
              } else if (preset === 'fade-in' && isSpoken) {
                wordClass = 'word-fade-in';
              } else if (preset === 'scale-in' && isSpoken) {
                wordClass = 'word-scale-in';
              } else if (preset === 'pulse' && (isSpoken || isEmphasized)) {
                wordClass = 'word-pulse';
                wordStyle.color = highlightColor;
              }

              return (
                <span key={idx} className={wordClass} style={wordStyle}>
                  {wObj.text}
                </span>
              );
            })}
          </span>
        ))}
      </span>
    );
  };

  const pos = styleConfig.position || 'bottom';
  let positionStyle = { bottom: `${model.bottomMarginPx}px`, top: 'auto' };
  if (pos === 'top') {
    positionStyle = { top: `${model.bottomMarginPx}px`, bottom: 'auto' };
  } else if (pos === 'center') {
    positionStyle = { top: '50%', transform: 'translateY(-50%)', bottom: 'auto' };
  }

  const bgOpacity = styleConfig.bgOpacity ?? 0.6;

  return (
    <div style={{
      position: 'absolute',
      left: `${model.marginLRPx}px`,
      right: `${model.marginLRPx}px`,
      textAlign: 'center',
      boxSizing: 'border-box',
      border: showBoxBounds ? '1px dashed #F59E0B' : 'none',
      ...positionStyle
    }}>
      <span
        style={{
          fontFamily: getFontFamilyStack(styleConfig.fontFamily),
          fontSize: `${model.fontPx}px`,
          fontWeight: styleConfig.fontWeight || '600',
          color: styleConfig.textColor || '#FAFAFA',
          backgroundColor: bgOpacity > 0.05
            ? hexToRgba(styleConfig.bgColor || '#000000', bgOpacity)
            : 'transparent',
          padding: `${model.paddingV}px ${model.paddingH}px`,
          borderRadius: `${Math.max(4, Math.round(model.fontPx * 0.16))}px`,
          textShadow: getOutlineShadowCss(styleConfig, model.outlineW, model.shadowB),
          display: 'inline-block',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.25,
          maxWidth: '100%',
          wordBreak: 'break-word',
          boxSizing: 'border-box'
        }}
      >
        {renderContent()}
      </span>
    </div>
  );
}
