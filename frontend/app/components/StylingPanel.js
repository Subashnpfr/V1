'use client';

import React, { useState } from 'react';
import { Type, Layout, Palette, FileText, Flame, Sliders, Sparkles, Zap } from 'lucide-react';

export default function StylingPanel({
  styleConfig,
  onChangeStyle,
  segmentConfig,
  onChangeSegment,
  animationConfig,
  onChangeAnimation,
  onApplyResegmentation,
  onDownloadSrt,
  onDownloadVtt,
  onBurnSubtitles,
  burning
}) {
  const [activeTab, setActiveTab] = useState('animations'); // 'styling' | 'animations'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Top Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>
        <button
          type="button"
          className={`tab-button ${activeTab === 'animations' ? 'active' : ''}`}
          onClick={() => setActiveTab('animations')}
        >
          <Sparkles size={15} /> Animations & Creator
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'styling' ? 'active' : ''}`}
          onClick={() => setActiveTab('styling')}
        >
          <Sliders size={15} /> Style & Layout
        </button>
      </div>

      {/* TAB 1: ANIMATIONS & CREATOR MODE */}
      {activeTab === 'animations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div className="section-title">
              <Zap size={15} style={{ color: '#4F8CFF' }} /> Animation Mode
            </div>
            <label style={{ fontSize: '12px', display: 'block', marginBottom: '0.35rem' }}>Preset Effect</label>
            <select
              value={animationConfig.preset || 'none'}
              onChange={(e) => onChangeAnimation({ preset: e.target.value })}
            >
              <option value="none">None (Standard)</option>
              <option value="typewriter">Typewriter (Character)</option>
              <option value="typewriter-word">Typewriter (Word by Word)</option>
              <option value="popup">Pop-up (Full Subtitle)</option>
              <option value="popup-word">Pop-up (Word by Word)</option>
              <option value="highlight-word">Highlight Current Word</option>
              <option value="karaoke">Highlight Karaoke (Fill)</option>
              <option value="bounce">Bounce Active Word</option>
              <option value="slide-up">Slide Up</option>
              <option value="fade-in">Fade In</option>
              <option value="scale-in">Scale In</option>
              <option value="pulse">Pulse Emphasis</option>
            </select>
          </div>

          {/* Typewriter Settings */}
          {(animationConfig.preset === 'typewriter' || animationConfig.preset === 'typewriter-word') && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div className="section-title">Typewriter Settings</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: '0.35rem' }}>Speed</label>
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
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: '0.35rem' }}>Blinking Cursor</label>
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

          {/* Highlight & Karaoke Settings */}
          {(animationConfig.preset === 'highlight-word' ||
            animationConfig.preset === 'karaoke' ||
            animationConfig.preset === 'bounce' ||
            animationConfig.preset === 'pulse') && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div className="section-title">Highlight & Fill Settings</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: '0.35rem' }}>Highlight Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="color"
                      value={animationConfig.highlightColor || '#4F8CFF'}
                      onChange={(e) => onChangeAnimation({ highlightColor: e.target.value })}
                    />
                    <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      {animationConfig.highlightColor || '#4F8CFF'}
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: '0.35rem' }}>Pill Background</label>
                  <select
                    value={animationConfig.roundedBackground !== false ? 'on' : 'off'}
                    onChange={(e) => onChangeAnimation({ roundedBackground: e.target.value === 'on' })}
                  >
                    <option value="on">On (Pill Box)</option>
                    <option value="off">Off (Text Only)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STYLE & LAYOUT */}
      {activeTab === 'styling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Section 1: Typography */}
          <div>
            <div className="section-title">
              <Type size={15} style={{ color: '#4F8CFF' }} /> Typography
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '0.35rem' }}>Font Family</label>
                <select
                  value={styleConfig.fontFamily}
                  onChange={(e) => onChangeStyle({ fontFamily: e.target.value })}
                >
                  <option value="Inter">Inter (Sans)</option>
                  <option value="Arial">Arial</option>
                  <option value="Impact">Impact (Bold)</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Georgia">Georgia (Serif)</option>
                  <option value="Trebuchet MS">Trebuchet MS</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '0.35rem' }}>Font Weight</label>
                <select
                  value={styleConfig.fontWeight}
                  onChange={(e) => onChangeStyle({ fontWeight: e.target.value })}
                >
                  <option value="400">Regular (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">SemiBold (600)</option>
                  <option value="700">Bold (700)</option>
                  <option value="900">Black (900)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '0.25rem' }}>
                <span>Font Size</span>
                <strong style={{ color: 'var(--text-primary)' }}>{styleConfig.fontSize}px</strong>
              </div>
              <input
                type="range"
                min="14"
                max="48"
                value={styleConfig.fontSize}
                onChange={(e) => onChangeStyle({ fontSize: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Section 2: Layout & Segmentation */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div className="section-title">
              <Layout size={15} style={{ color: '#4F8CFF' }} /> Word & Line Layout
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '11px', display: 'block', marginBottom: '0.25rem' }}>Max Words</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  className="input-text"
                  value={segmentConfig.maxWords}
                  onChange={(e) => onChangeSegment({ maxWords: parseInt(e.target.value) || 6 })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', display: 'block', marginBottom: '0.25rem' }}>Max Chars/Line</label>
                <input
                  type="number"
                  min="10"
                  max="60"
                  className="input-text"
                  value={segmentConfig.maxCharsPerLine}
                  onChange={(e) => onChangeSegment({ maxCharsPerLine: parseInt(e.target.value) || 32 })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', display: 'block', marginBottom: '0.25rem' }}>Max Lines</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  className="input-text"
                  value={segmentConfig.maxLines}
                  onChange={(e) => onChangeSegment({ maxLines: parseInt(e.target.value) || 2 })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '0.35rem' }}>Position</label>
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
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '0.35rem' }}>Margin ({styleConfig.marginV}px)</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={styleConfig.marginV}
                  onChange={(e) => onChangeStyle({ marginV: parseInt(e.target.value) })}
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
              Auto Re-segment Subtitles
            </button>
          </div>

          {/* Section 3: Appearance */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div className="section-title">
              <Palette size={15} style={{ color: '#4F8CFF' }} /> Appearance
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '0.35rem' }}>Text Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="color"
                    value={styleConfig.textColor}
                    onChange={(e) => onChangeStyle({ textColor: e.target.value })}
                  />
                  <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{styleConfig.textColor}</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '0.35rem' }}>Background Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="color"
                    value={styleConfig.bgColor}
                    onChange={(e) => onChangeStyle({ bgColor: e.target.value })}
                  />
                  <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{styleConfig.bgColor}</span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '0.25rem' }}>
                <span>Bg Opacity</span>
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
        </div>
      )}

      {/* Export Section */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onDownloadSrt}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <FileText size={15} /> SRT
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onDownloadVtt}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <FileText size={15} /> VTT
          </button>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={onBurnSubtitles}
          disabled={burning}
          style={{ width: '100%', justifyContent: 'center', background: '#4F8CFF' }}
        >
          <Flame size={16} /> {burning ? 'Rendering MP4...' : 'Burn Animated Subtitles into MP4'}
        </button>
      </div>
    </div>
  );
}
