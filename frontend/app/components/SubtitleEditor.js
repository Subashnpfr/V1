'use client';

import React, { useEffect } from 'react';
import { Plus, Trash2, Split, GitMerge, Zap } from 'lucide-react';

export default function SubtitleEditor({
  subtitles = [],
  onChange,
  activeSubtitleId,
  onTogglePlay
}) {
  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (onTogglePlay) onTogglePlay();
      } else if (e.code === 'Delete' && activeSubtitleId) {
        e.preventDefault();
        handleDelete(activeSubtitleId);
      } else if (e.code === 'Enter' && activeSubtitleId) {
        e.preventDefault();
        const activeIdx = subtitles.findIndex(s => s.id === activeSubtitleId);
        if (activeIdx !== -1) {
          handleSplit(activeIdx);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [subtitles, activeSubtitleId]);

  const handleTextChange = (id, newText) => {
    const updated = subtitles.map(s => {
      if (s.id === id) {
        const words = newText.trim().split(/\s+/).map((w, idx) => {
          const existingWord = s.words && s.words[idx];
          return {
            text: w,
            start: existingWord ? existingWord.start : s.start,
            end: existingWord ? existingWord.end : s.end,
            emphasized: existingWord ? existingWord.emphasized : false
          };
        });
        return { ...s, text: newText, words };
      }
      return s;
    });
    onChange(updated);
  };

  const handleToggleWordEmphasis = (subId, wordIndex) => {
    const updated = subtitles.map(s => {
      if (s.id === subId) {
        const words = (s.words || []).map((w, idx) => {
          if (idx === wordIndex) {
            return { ...w, emphasized: !w.emphasized };
          }
          return w;
        });
        return { ...s, words };
      }
      return s;
    });
    onChange(updated);
  };

  const handleStartChange = (id, newStart) => {
    const startVal = parseFloat(newStart) || 0;
    const updated = subtitles.map(s => (s.id === id ? { ...s, start: startVal } : s));
    onChange(updated);
  };

  const handleEndChange = (id, newEnd) => {
    const endVal = parseFloat(newEnd) || 0;
    const updated = subtitles.map(s => (s.id === id ? { ...s, end: endVal } : s));
    onChange(updated);
  };

  const handleDelete = (id) => {
    const updated = subtitles.filter(s => s.id !== id);
    const reindexed = updated.map((s, idx) => ({ ...s, id: idx + 1 }));
    onChange(reindexed);
  };

  const handleAddAfter = (index) => {
    const current = subtitles[index];
    const newStart = current ? current.end + 0.1 : 0;
    const newEnd = newStart + 2.0;

    const newSub = {
      id: Date.now(),
      start: parseFloat(newStart.toFixed(3)),
      end: parseFloat(newEnd.toFixed(3)),
      text: 'New subtitle segment',
      words: [{ text: 'New', start: newStart, end: newEnd }]
    };

    const nextSubs = [...subtitles];
    nextSubs.splice(index + 1, 0, newSub);

    const reindexed = nextSubs.map((s, idx) => ({ ...s, id: idx + 1 }));
    onChange(reindexed);
  };

  const handleSplit = (index) => {
    const current = subtitles[index];
    if (!current) return;

    const midTime = parseFloat(((current.start + current.end) / 2).toFixed(3));
    const words = current.text.split(' ');
    const halfLen = Math.ceil(words.length / 2);

    const text1 = words.slice(0, halfLen).join(' ');
    const text2 = words.slice(halfLen).join(' ') || '...';

    const sub1 = { ...current, end: midTime, text: text1 };
    const sub2 = {
      id: Date.now(),
      start: midTime,
      end: current.end,
      text: text2
    };

    const nextSubs = [...subtitles];
    nextSubs.splice(index, 1, sub1, sub2);

    const reindexed = nextSubs.map((s, idx) => ({ ...s, id: idx + 1 }));
    onChange(reindexed);
  };

  const handleMergeNext = (index) => {
    if (index >= subtitles.length - 1) return;

    const current = subtitles[index];
    const nextSub = subtitles[index + 1];

    const merged = {
      ...current,
      end: nextSub.end,
      text: `${current.text} ${nextSub.text}`.trim()
    };

    const nextSubs = [...subtitles];
    nextSubs.splice(index, 2, merged);

    const reindexed = nextSubs.map((s, idx) => ({ ...s, id: idx + 1 }));
    onChange(reindexed);
  };

  return (
    <div style={{ marginTop: '0.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Subtitle Segments ({subtitles.length})
        </h3>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => handleAddAfter(subtitles.length - 1)}
          style={{ fontSize: '12px', padding: '0.4rem 0.75rem' }}
        >
          <Plus size={14} /> Add Line
        </button>
      </div>

      <div className="editor-table-container">
        <table className="editor-table">
          <thead>
            <tr>
              <th style={{ width: '45px' }}>#</th>
              <th style={{ width: '100px' }}>Start (s)</th>
              <th style={{ width: '100px' }}>End (s)</th>
              <th>Subtitle Text & Punch Words</th>
              <th style={{ width: '130px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subtitles.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  No subtitles available. Click "Add Line" to create one.
                </td>
              </tr>
            ) : (
              subtitles.map((sub, idx) => {
                const isActive = sub.id === activeSubtitleId;
                const words = sub.words || [];

                return (
                  <tr key={sub.id || idx} className={isActive ? 'active-row' : ''}>
                    <td style={{ fontWeight: '600', color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {sub.id}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        className="input-text"
                        value={sub.start}
                        onChange={(e) => handleStartChange(sub.id, e.target.value)}
                        style={{ padding: '0.3rem 0.5rem', fontSize: '12px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        className="input-text"
                        value={sub.end}
                        onChange={(e) => handleEndChange(sub.id, e.target.value)}
                        style={{ padding: '0.3rem 0.5rem', fontSize: '12px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="input-text"
                        value={sub.text}
                        onChange={(e) => handleTextChange(sub.id, e.target.value)}
                        style={{ padding: '0.3rem 0.5rem', fontSize: '13px', marginBottom: '0.35rem' }}
                      />

                      {/* Interactive Punch Word Chips */}
                      {words.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Zap size={11} style={{ color: 'var(--accent)' }} /> Emphasis:
                          </span>
                          {words.map((w, wIdx) => (
                            <span
                              key={wIdx}
                              className={`word-chip ${w.emphasized ? 'emphasized' : ''}`}
                              onClick={() => handleToggleWordEmphasis(sub.id, wIdx)}
                              title="Click to toggle punch word emphasis"
                            >
                              {w.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                        <button
                          type="button"
                          title="Split Subtitle (Enter)"
                          className="btn-secondary"
                          onClick={() => handleSplit(idx)}
                          style={{ padding: '0.35rem', borderRadius: '6px' }}
                        >
                          <Split size={13} />
                        </button>
                        {idx < subtitles.length - 1 && (
                          <button
                            type="button"
                            title="Merge with Next"
                            className="btn-secondary"
                            onClick={() => handleMergeNext(idx)}
                            style={{ padding: '0.35rem', borderRadius: '6px' }}
                          >
                            <GitMerge size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Delete Subtitle (Delete)"
                          className="btn-danger"
                          onClick={() => handleDelete(sub.id)}
                          style={{ padding: '0.35rem', borderRadius: '6px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
