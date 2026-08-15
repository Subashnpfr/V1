'use client';

import React, { useState } from 'react';
import { Type, Layout, Palette, FileText, Flame, Sliders, Sparkles, Zap } from 'lucide-react';
import { CAPTION_LOOKS } from '../utils/captionLooks';

export default function StylingPanel({
  styleConfig,
  onChangeStyle,
  segmentConfig,
  onChangeSegment,
  animationConfig,
  onChangeAnimation,
  onApplyLook,
  onApplyResegmentation,
  onDownloadSrt,
  onDownloadVtt,
  onBurnSubtitles,
  burning
}) {
  const [activeTab, setActiveTab] = useState('looks');

  return (
    <div className="card studio-side" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        <button type="button" className={`tab-button ${activeTab === 'looks' ? 'active' : ''}`} onClick={() => setActiveTab('looks')}>
          <Sparkles size={14} /> Looks
        </button>
        <button type="button" className={`tab-button ${activeTab === 'animations' ? 'active' : ''}`} onClick={() => setActiveTab('animations')}>
          <Zap size={14} /> Motion
        </button>
        <button type="button" className={`tab-button ${activeTab === 'styling' ? 'active' : ''}`} onClick={() => setActiveTab('styling')}>
          <Sliders size={14} /> Type
        </button>
      </div>

      {activeTab === 'looks' && (
        <div className="look-grid">
          {CAPTION_LOOKS.map((look) => (
            <button
              key={look.id}
              type="button"
              className="look-card"
              onClick={() => onApplyLook && onApplyLook(look)}
            >
              <span
                className="look-sample"
                style={{
                  fontFamily: `"${look.style.fontFamily}", "Noto Sans Devanagari", sans-serif`,
                  fontWeight: look.style.fontWeight,
                  color: look.style.textColor,
                  background: look.style.bgOpacity > 0.05
                    ? look.style.bgColor
                    : 'transparent',
                  letterSpacing: look.style.letterSpacing ? `${look.style.letterSpacing}em` : 'normal',
                  textTransform: look.style.textTransform,
                  textShadow: look.style.outlineWidth
                    ? `0 1px 0 ${look.style.outlineColor}, 0 6px 16px rgba(0,0,0,0.45)`
                    : '0 8px 18px rgba(0,0,0,0.4)'
                }}
              >
                {look.sample}
              </span>
              <strong>{look.name}</strong>
              <em>{look.hint}</em>
            </button>
          ))}
        </div>
      )}

      {activeTab === 'animations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div className="section-title">
              <Zap size={15} style={{ color: 'var(--accent)' }} /> Animation
            </div>
            <label className="field-label">Preset effect</label>
            <select
              value={animationConfig.preset || 'none'}
              onChange={(e) => onChangeAnimation({ preset: e.target.value })}
            >
              <option value="none">None (static type)</option>
              <option value="typewriter">Typewriter (character)</option>
              <option value="typewriter-word">Typewriter (word)</option>
              <option value="popup">Pop-up</option>
              <option value="popup-word">Pop-up word</option>
              <option value="highlight-word">Highlight active word</option>
              <option value="karaoke">Karaoke fill</option>
              <option value="bounce">Bounce</option>
              <option value="slide-up">Slide up</option>
              <option value="fade-in">Fade in</option>
              <option value="scale-in">Scale in</option>
              <option value="pulse">Pulse</option>
            </select>
          </div>

          {(animationConfig.preset === 'typewriter' || animationConfig.preset === 'typewriter-word') && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div className="section-title">Typewriter</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="field-label">Speed</label>
                  <select
                    value={animationConfig.typewriterSpeed || 'medium'}
                    onChange={(e) => onChangeAnimation({ typewriterSpeed: e.target.value })}
                  >
                    <option value="slow">Slow</option>
                    <option value="medium">Medium</option>
                    <option value="fast">Fast</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Cursor</label>
                  <select
                    value={animationConfig.showCursor !== false ? 'on' : 'off'}
                    onChange={(e) => onChangeAnimation({ showCursor: e.target.value === 'on' })}
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {(animationConfig.preset === 'highlight-word' ||
            animationConfig.preset === 'karaoke' ||
            animationConfig.preset === 'bounce' ||
            animationConfig.preset === 'pulse') && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div className="section-title">Emphasis</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="field-label">Highlight</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="color"
                      value={animationConfig.highlightColor || '#F59E0B'}
                      onChange={(e) => onChangeAnimation({ highlightColor: e.target.value })}
                    />
                    <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      {animationConfig.highlightColor || '#F59E0B'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="field-label">Word pill</label>
                  <select
                    value={animationConfig.roundedBackground !== false ? 'on' : 'off'}
                    onChange={(e) => onChangeAnimation({ roundedBackground: e.target.value === 'on' })}
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'styling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div className="section-title">
              <Type size={15} style={{ color: 'var(--accent)' }} /> Typography
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="field-label">Font</label>
                <select
                  value={styleConfig.fontFamily}
                  onChange={(e) => onChangeStyle({ fontFamily: e.target.value })}
                >
                  <option value="Inter">Inter</option>
                  <option value="Poppins">Poppins</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Noto Sans Devanagari">Noto Sans Devanagari</option>
                  <option value="Mukta">Mukta</option>
                  <option value="Playfair Display">Playfair Display</option>
                  <option value="Teko">Teko</option>
                  <option value="Impact">Impact</option>
                  <option value="Georgia">Georgia</option>
                </select>
              </div>
              <div>
                <label className="field-label">Weight</label>
                <select
                  value={styleConfig.fontWeight}
                  onChange={(e) => onChangeStyle({ fontWeight: e.target.value })}
                >
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                  <option value="900">Black</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '0.25rem' }}>
                <span>Size</span>
                <strong style={{ color: 'var(--text-primary)' }}>{styleConfig.fontSize}px</strong>
              </div>
              <input
                type="range"
                min="14"
                max="48"
                value={styleConfig.fontSize}
                onChange={(e) => onChangeStyle({ fontSize: parseInt(e.target.value, 10) })}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <label className="field-label">Letter case</label>
              <select
                value={styleConfig.textTransform || 'none'}
                onChange={(e) => onChangeStyle({ textTransform: e.target.value })}
              >
                <option value="none">As written</option>
                <option value="uppercase">Uppercase</option>
                <option value="lowercase">Lowercase</option>
                <option value="capitalize">Title case</option>
              </select>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '0.25rem' }}>
                <span>Tracking</span>
                <strong style={{ color: 'var(--text-primary)' }}>{Number(styleConfig.letterSpacing || 0).toFixed(2)}</strong>
              </div>
              <input
                type="range"
                min="0"
                max="0.12"
                step="0.01"
                value={styleConfig.letterSpacing || 0}
                onChange={(e) => onChangeStyle({ letterSpacing: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div className="section-title">
              <Layout size={15} style={{ color: 'var(--accent)' }} /> Layout
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <label className="field-label">Max words</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  className="input-text"
                  value={segmentConfig.maxWords}
                  onChange={(e) => onChangeSegment({ maxWords: parseInt(e.target.value, 10) || 6 })}
                />
              </div>
              <div>
                <label className="field-label">Chars/line</label>
                <input
                  type="number"
                  min="10"
                  max="60"
                  className="input-text"
                  value={segmentConfig.maxCharsPerLine}
                  onChange={(e) => onChangeSegment({ maxCharsPerLine: parseInt(e.target.value, 10) || 32 })}
                />
              </div>
              <div>
                <label className="field-label">Lines</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  className="input-text"
                  value={segmentConfig.maxLines}
                  onChange={(e) => onChangeSegment({ maxLines: parseInt(e.target.value, 10) || 2 })}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="field-label">Position</label>
                <select
                  value={styleConfig.position}
                  onChange={(e) => onChangeStyle({ position: e.target.value })}
                >
                  <option value="bottom">Bottom</option>
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                </select>
              </div>
              <div>
                <label className="field-label">Margin ({styleConfig.marginV}px)</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={styleConfig.marginV}
                  onChange={(e) => onChangeStyle({ marginV: parseInt(e.target.value, 10) })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={onApplyResegmentation}
              style={{ width: '100%', marginTop: '0.85rem', justifyContent: 'center' }}
            >
              Re-segment lines
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div className="section-title">
              <Palette size={15} style={{ color: 'var(--accent)' }} /> Color
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label className="field-label">Text</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="color" value={styleConfig.textColor} onChange={(e) => onChangeStyle({ textColor: e.target.value })} />
                  <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{styleConfig.textColor}</span>
                </div>
              </div>
              <div>
                <label className="field-label">Box</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="color" value={styleConfig.bgColor} onChange={(e) => onChangeStyle({ bgColor: e.target.value })} />
                  <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{styleConfig.bgColor}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '0.25rem' }}>
              <span>Box opacity</span>
              <strong style={{ color: 'var(--text-primary)' }}>{Math.round(styleConfig.bgOpacity * 100)}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={styleConfig.bgOpacity}
              onChange={(e) => onChangeStyle({ bgOpacity: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn-secondary" onClick={onDownloadSrt} style={{ flex: 1, justifyContent: 'center' }}>
            <FileText size={15} /> SRT
          </button>
          <button type="button" className="btn-secondary" onClick={onDownloadVtt} style={{ flex: 1, justifyContent: 'center' }}>
            <FileText size={15} /> VTT
          </button>
        </div>
        <button type="button" className="btn-primary" onClick={onBurnSubtitles} disabled={burning} style={{ width: '100%', justifyContent: 'center' }}>
          <Flame size={16} /> {burning ? 'Rendering MP4…' : 'Burn captions to MP4'}
        </button>
      </div>
    </div>
  );
}
