/**
 * Subtitle Re-segmentation Algorithm (Creator Mode)
 * Re-chunks subtitles according to word count, line character limits, max lines,
 * and duration limits while preserving word-level timestamp structures.
 */
export function resegmentSubtitles(subtitles = [], options = {}) {
  const {
    maxWords = 4,
    maxCharsPerLine = 18,
    maxLines = 1,
    minDuration = 0.6,
    maxDuration = 2.4
  } = options;

  if (!subtitles || subtitles.length === 0) return [];

  // Step 1: Extract or estimate all word timing objects
  const allWords = [];
  subtitles.forEach((sub) => {
    if (sub.words && Array.isArray(sub.words) && sub.words.length > 0) {
      sub.words.forEach((w) => {
        const text = String(w.text || '').replace(/[|¦]/g, '').replace(/।/g, '.').trim();
        if (!text || /^[|¦♪♫]+$/.test(text)) return;
        allWords.push({
          text,
          start: parseFloat(w.start),
          end: parseFloat(w.end),
          emphasized: !!w.emphasized
        });
      });
    } else {
      const rawWords = sub.text.trim().split(/\s+/).filter(Boolean);
      if (rawWords.length === 0) return;

      const totalDuration = Math.max(0.1, sub.end - sub.start);
      const wordDuration = totalDuration / rawWords.length;

      rawWords.forEach((w, idx) => {
        const wStart = sub.start + idx * wordDuration;
        const wEnd = sub.start + (idx + 1) * wordDuration;
        allWords.push({
          text: w,
          start: parseFloat(wStart.toFixed(3)),
          end: parseFloat(wEnd.toFixed(3)),
          emphasized: false
        });
      });
    }
  });

  if (allWords.length === 0) return [];

  // Step 2: Group words into subtitle blocks
  const newSubtitles = [];
  let currentWords = [];
  let currentStart = allWords[0].start;

  const flushBlock = () => {
    if (currentWords.length === 0) return;

    const blockStart = parseFloat(currentStart.toFixed(3));
    let blockEnd = parseFloat(currentWords[currentWords.length - 1].end.toFixed(3));

    // Enforce min duration constraint
    if (blockEnd - blockStart < minDuration) {
      blockEnd = parseFloat((blockStart + minDuration).toFixed(3));
    }

    // Format text into lines respecting maxCharsPerLine
    const lines = [];
    let currentLine = [];
    let currentLineCharCount = 0;

    currentWords.forEach((wObj) => {
      const wordLen = wObj.text.length;
      const spaceNeed = currentLine.length > 0 ? 1 : 0;

      if (currentLineCharCount + wordLen + spaceNeed <= maxCharsPerLine) {
        currentLine.push(wObj.text);
        currentLineCharCount += wordLen + spaceNeed;
      } else {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(' '));
        }
        currentLine = [wObj.text];
        currentLineCharCount = wordLen;
      }
    });

    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }

    // Combine excess lines if > maxLines
    let finalLines = lines;
    if (lines.length > maxLines) {
      const headLines = lines.slice(0, maxLines - 1);
      const tailText = lines.slice(maxLines - 1).join(' ');
      finalLines = [...headLines, tailText];
    }

    newSubtitles.push({
      id: newSubtitles.length + 1,
      start: blockStart,
      end: blockEnd,
      text: finalLines.join('\n'),
      words: [...currentWords]
    });

    currentWords = [];
  };

  allWords.forEach((wObj) => {
    if (currentWords.length === 0) {
      currentWords.push(wObj);
      currentStart = wObj.start;
      return;
    }

    const testWords = [...currentWords, wObj];
    const testDuration = wObj.end - currentStart;

    let testLineCount = 1;
    let testLineChars = 0;
    testWords.forEach((tw) => {
      const wordLen = tw.text.length;
      const space = testLineChars > 0 ? 1 : 0;
      if (testLineChars + wordLen + space <= maxCharsPerLine) {
        testLineChars += wordLen + space;
      } else {
        testLineCount++;
        testLineChars = wordLen;
      }
    });

    if (
      testWords.length > maxWords ||
      testLineCount > maxLines ||
      testDuration > maxDuration
    ) {
      flushBlock();
      currentWords = [wObj];
      currentStart = wObj.start;
    } else {
      currentWords.push(wObj);
    }
  });

  flushBlock();

  return newSubtitles;
}
