// app/authors/SceneCraftModal.tsx

// SceneCraft — scroll-driven immersive storytelling editor

// Full-viewport modal that parses scene XHTML into elements, lets authors
// attach audio/images/voice. Preview rendering is in SceneCraftPreview.

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SceneCraftConfig } from '@/services/manuscriptStorage';
import ImagePickerModal from './ImagePickerModal';
import AudioPickerModal from './AudioPickerModal';
import { ThemeConfig } from '../shared/theme';
import SceneCraftPreview from '@/components/SceneCraftPreview';
import type { SceneCraftElement } from '@/components/SceneCraftPreview';
import { parseSceneXhtml } from '@/components/HtmlRenderEngine';

// ============================================================
//  Types
// ============================================================

interface ImageInfo {
  filename: string;
  url: string;
}

interface AudioInfo {
  filename: string;
  size: number;
}

interface SceneCraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Scene data
  sectionId: string;
  sectionTitle: string;
  sectionXhtml: string;
  // Existing config to restore
  sceneCraftConfig: SceneCraftConfig | null;
  onConfigChange: (config: SceneCraftConfig) => void;
  // Asset libraries (reuse existing)
  images: ImageInfo[];
  audios: AudioInfo[];
  onImageUpload: (file: File) => Promise<void>;
  onImageDelete: (filename: string) => void;
  onAudioUpload: (file: File) => Promise<void>;
  onAudioDelete: (filename: string) => void;
  // For resolving asset filenames to blob URLs for playback
  getImageUrl: (filename: string) => string | null;
  getAudioUrl: (filename: string) => Promise<string | null>;
  // Theme
  theme: ThemeConfig;
  isDarkMode: boolean;
}

// ============================================================
//  Default config factory
// ============================================================

function createDefaultConfig(): SceneCraftConfig {
  return {
    wallpaperFilename: null,
    wallpaperOpacity: 0.25,
    wallpaperPosition: 'center',
    ambientFilename: null,
    ambientVolume: 0.5,
    ambientLoop: true,
    fadeIn: 2,
    fadeOut: 3,
    voiceMode: 'narration',
    narrationFilename: null,
    narrationVolume: 0.7,
    dialogueClips: {},
    dialogueVolume: 0.8,
    stickyClips: {},
    stickyVolume: 0.8,
    paraClips: {},
    paraVolume: 0.8,
  };
}

// ============================================================
//  CSS custom properties (scoped via style element)
// ============================================================

const SC_STYLES = `
  .sc-root {
    --sc-bg: #111114;
    --sc-bg2: #0c0c0f;
    --sc-bg3: #0a0a0d;
    --sc-bdr: rgba(255,255,255,0.06);
    --sc-t: #b8b0a4;
    --sc-td: #5a554e;
    --sc-tdd: #3a3630;
    --sc-tddd: #2a2620;
    --sc-acc: #ff7844;
    --sc-acc-d: rgba(255,120,68,0.12);
    --sc-prose: #c8c0b4;
    --sc-prose-d: #a09888;
  }
  .sc-root-light {
    --sc-bg: #f5f5f0;
    --sc-bg2: #eeeee8;
    --sc-bg3: #e8e8e2;
    --sc-bdr: rgba(0,0,0,0.1);
    --sc-t: #4a4540;
    --sc-td: #7a756e;
    --sc-tdd: #9a958e;
    --sc-tddd: #bab5ae;
    --sc-acc: #e05520;
    --sc-acc-d: rgba(224,85,32,0.12);
    --sc-prose: #3a3530;
    --sc-prose-d: #5a554e;
  }
`;

// ============================================================
//  Component
// ============================================================

export default function SceneCraftModal({
  isOpen,
  onClose,
  sectionId,
  sectionTitle,
  sectionXhtml,
  sceneCraftConfig,
  onConfigChange,
  images,
  audios,
  onImageUpload,
  onImageDelete,
  onAudioUpload,
  onAudioDelete,
  getImageUrl,
  getAudioUrl,
  theme,
  isDarkMode,
}: SceneCraftModalProps) {
  // ── State ─────────────────────────────────────────────────
  const [selectedIdx, setSelectedIdx] = useState(-1); // -1 = scene-level
  const [config, setConfig] = useState<SceneCraftConfig>(createDefaultConfig);
  const [showPreview, setShowPreview] = useState(false);

  // Asset picker state (reuse existing modals)
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [audioPickerTarget, setAudioPickerTarget] = useState<string>(''); // 'ambient' | 'narration' | 'dialogue-N'

  // ── Parse elements from XHTML ──────────────────────────────
  const elements = useMemo(() => parseSceneXhtml(sectionXhtml), [sectionXhtml]);

  // Resolve inline image src (e.g. "images/photo.jpg") to blob URL via getImageUrl
  const resolveImgSrc = (src: string | undefined): string | undefined => {
    if (!src) return src;
    const fn = src.replace(/^(\.\.\/)?images\//, '');
    return getImageUrl(fn) || src;
  };

  // ── Reset selection on open / section change (not on config round-trips) ──
  useEffect(() => {
    if (isOpen) {
      setSelectedIdx(-1);
      setShowPreview(false);
    }
  }, [isOpen, sectionId]);

  // ── Restore config from props + clean stale clips ─────────
  useEffect(() => {
    if (isOpen) {
      const restored = sceneCraftConfig
        ? { ...createDefaultConfig(), ...sceneCraftConfig }
        : createDefaultConfig();
      // Clean stale dialogueClips whose index no longer points to a dialogue element
      if (restored.dialogueClips && Object.keys(restored.dialogueClips).length > 0) {
        const cleaned = { ...restored.dialogueClips };
        let changed = false;
        for (const key of Object.keys(cleaned)) {
          const idx = Number(key);
          if (elements[idx]?.type !== 'dialogue') {
            delete cleaned[idx];
            changed = true;
          }
        }
        if (changed) {
          restored.dialogueClips = cleaned;
          onConfigChange(restored);
        }
      }
      // Clean stale stickyClips whose index no longer points to a sticky element
      if (restored.stickyClips && Object.keys(restored.stickyClips).length > 0) {
        const cleaned = { ...restored.stickyClips };
        let changed2 = false;
        for (const key of Object.keys(cleaned)) {
          const idx = Number(key);
          if (elements[idx]?.type !== 'sticky') {
            delete cleaned[idx];
            changed2 = true;
          }
        }
        if (changed2) {
          restored.stickyClips = cleaned;
          onConfigChange(restored);
        }
      }
      // Clean stale paraClips whose index no longer points to a para element
      if (restored.paraClips && Object.keys(restored.paraClips).length > 0) {
        const cleaned = { ...restored.paraClips };
        let changed3 = false;
        for (const key of Object.keys(cleaned)) {
          const idx = Number(key);
          if (elements[idx]?.type !== 'para') {
            delete cleaned[idx];
            changed3 = true;
          }
        }
        if (changed3) {
          restored.paraClips = cleaned;
          onConfigChange(restored);
        }
      }
      setConfig(restored);
    }
  }, [isOpen, sectionId, sceneCraftConfig, elements, onConfigChange]);

  // ── Config updater (updates state + notifies parent) ──────
  const updateConfig = useCallback((partial: Partial<SceneCraftConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      onConfigChange(next);
      return next;
    });
  }, [onConfigChange]);

  // ── Close handler (save config then close) ────────────────
  const handleClose = useCallback(() => {
    onConfigChange(config);
    onClose();
  }, [config, onConfigChange, onClose]);

  // ── Image picker handlers ─────────────────────────────────
  const handleWallpaperPick = useCallback(() => {
    setShowImagePicker(true);
  }, []);

  const handleImageSelected = useCallback((filename: string, _altText: string) => {
    updateConfig({ wallpaperFilename: filename });
    setShowImagePicker(false);
  }, [updateConfig]);

  // ── Audio picker handlers ─────────────────────────────────
  const openAudioPicker = useCallback((target: string) => {
    setAudioPickerTarget(target);
    setShowAudioPicker(true);
  }, []);

  const handleAudioSelected = useCallback((filename: string, _label: string, _mediaType: string) => {
    if (audioPickerTarget === 'ambient') {
      updateConfig({ ambientFilename: filename });
    } else if (audioPickerTarget === 'narration') {
      updateConfig({ narrationFilename: filename });
    } else if (audioPickerTarget.startsWith('dialogue-')) {
      const idx = parseInt(audioPickerTarget.replace('dialogue-', ''), 10);
      if (!isNaN(idx) && elements[idx]?.type === 'dialogue') {
        const newClips = { ...config.dialogueClips };
        newClips[idx] = { filename, volume: config.dialogueVolume };
        updateConfig({ dialogueClips: newClips });
      }
    } else if (audioPickerTarget.startsWith('sticky-')) {
      const idx = parseInt(audioPickerTarget.replace('sticky-', ''), 10);
      if (!isNaN(idx) && elements[idx]?.type === 'sticky') {
        const newClips = { ...config.stickyClips };
        newClips[idx] = { filename, volume: config.stickyVolume };
        updateConfig({ stickyClips: newClips });
      }
    } else if (audioPickerTarget.startsWith('para-')) {
      const idx = parseInt(audioPickerTarget.replace('para-', ''), 10);
      if (!isNaN(idx) && elements[idx]?.type === 'para') {
        const newClips = { ...config.paraClips };
        newClips[idx] = { filename, volume: config.paraVolume };
        updateConfig({ paraClips: newClips });
      }
    }
    setShowAudioPicker(false);
  }, [audioPickerTarget, config.dialogueClips, config.dialogueVolume, config.stickyClips, config.stickyVolume, config.paraClips, config.paraVolume, elements, updateConfig]);

  // ── Don't render if closed ────────────────────────────────
  if (!isOpen) return null;

  // ── Tag color classes ─────────────────────────────────────
  function tagStyle(type: string): React.CSSProperties {
    const styles: Record<string, React.CSSProperties> = {
      sticky: { background: 'rgba(100,180,120,0.15)', color: '#6ab47a' },
      figure: { background: 'rgba(100,150,200,0.15)', color: '#6a9ac8' },
      audio: { background: 'rgba(100,200,150,0.15)', color: '#6ac890' },
      dialogue: { background: 'rgba(200,150,80,0.15)', color: '#c8a050' },
      emphasis: { background: 'rgba(200,100,100,0.15)', color: '#c87060' },
      quote: { background: 'rgba(150,130,200,0.15)', color: '#a090c8' },
      internal: { background: 'rgba(120,180,200,0.15)', color: '#70b0c8' },
      break: { background: 'rgba(255,255,255,0.03)', color: 'var(--sc-tddd)' },
      para: { background: 'rgba(255,255,255,0.04)', color: 'var(--sc-tdd)' },
    };
    return styles[type] || styles.para!;
  }

  // ── Render: Structure Panel items ─────────────────────────
  function renderStructureItem(item: SceneCraftElement, i: number) {
    const isSel = selectedIdx === i;
    const hasClip = (config.voiceMode === 'dialogue' && item.type === 'dialogue' && !!config.dialogueClips[i])
      || (item.type === 'sticky' && !!config.stickyClips[i])
      || (item.type === 'para' && !!config.paraClips[i]);

    return (
      <div
        key={i}
        onClick={() => setSelectedIdx(i)}
        style={{
          padding: '7px 10px',
          borderRadius: '4px',
          marginBottom: '2px',
          cursor: 'pointer',
          borderLeft: isSel ? '3px solid var(--sc-acc)' : '3px solid transparent',
          background: isSel ? 'var(--sc-acc-d)' : 'transparent',
          transition: 'background 0.12s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <span style={{
            fontSize: '7px', letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '1px 5px', borderRadius: '2px', ...tagStyle(item.type),
          }}>
            {item.type}
          </span>
          {item.type === 'dialogue' && (
            <span style={{ fontSize: '9px', color: '#c8a050', letterSpacing: '0.04em', fontWeight: 600, textTransform: 'uppercase' }}>
              {item.direction ? `${item.speaker} (${item.direction})` : item.speaker}
            </span>
          )}
          <span style={{ fontSize: '8px', color: 'var(--sc-tddd)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
            #{i}
          </span>
        </div>

        {item.type === 'dialogue' && (
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: '11px', lineHeight: 1.5, color: 'var(--sc-prose-d)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.text}
          </div>
        )}
        {item.type === 'sticky' && (
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: '11px', lineHeight: 1.5, color: 'var(--sc-prose-d)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.text.split('\n')[0]}...
          </div>
        )}
        {item.type === 'figure' && (
          <div style={{ fontSize: '9px', color: 'var(--sc-td)', fontStyle: 'italic' }}>
            [{item.alt || item.text}]
            {item.width && (
              <>{' '}<span style={{ color: '#6a9ac8', fontStyle: 'normal' }}>
                w:{item.width}
              </span></>
            )}
          </div>
        )}
        {item.type === 'audio' && (
          <div style={{ fontSize: '9px', color: '#6ac890', fontStyle: 'italic' }}>
            {item.audioSrc?.replace(/^(\.\.\/)?audio\//, '') || 'audio'}
          </div>
        )}
        {item.type === 'break' && (
          <div style={{ textAlign: 'center', color: 'var(--sc-tdd)', fontSize: '11px' }}>{item.text}</div>
        )}
        {item.type === 'emphasis' && (
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: '11px', lineHeight: 1.5, color: 'var(--sc-prose-d)',
            fontStyle: 'italic', textAlign: 'center',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.text}
          </div>
        )}
        {item.type === 'quote' && (
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: '11px', lineHeight: 1.5, color: 'var(--sc-prose-d)',
            borderLeft: '2px solid rgba(255,255,255,0.15)', paddingLeft: '8px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.text}
          </div>
        )}
        {item.type === 'internal' && (
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: '11px', lineHeight: 1.5, color: 'var(--sc-prose-d)',
            fontStyle: 'italic', opacity: 0.7, paddingLeft: '16px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.text}
          </div>
        )}
        {item.type === 'para' && (
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: '11px', lineHeight: 1.5, color: 'var(--sc-prose-d)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.text}
          </div>
        )}

        {hasClip && (
          <div style={{ fontSize: '7px', color: 'rgba(100,200,150,0.7)', letterSpacing: '0.06em', marginTop: '2px' }}>
            ♫ {config.dialogueClips[i]?.filename || config.stickyClips[i]?.filename || config.paraClips[i]?.filename}
          </div>
        )}
      </div>
    );
  }

  // ── Render: File slot (for wallpaper/audio) ───────────────
  function renderFileSlot(
    label: string,
    hint: string,
    filename: string | null,
    onPick: () => void,
    onRemove: () => void,
  ) {
    const hasFile = !!filename;
    return (
      <div
        onClick={hasFile ? undefined : onPick}
        style={{
          padding: '8px 10px',
          borderRadius: '4px',
          border: hasFile ? '1px solid rgba(255,120,68,0.15)' : '1px dashed var(--sc-bdr)',
          background: hasFile ? 'rgba(255,120,68,0.03)' : 'rgba(255,255,255,0.015)',
          cursor: hasFile ? 'default' : 'pointer',
          marginBottom: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '9px', color: 'var(--sc-td)', width: '50px', flexShrink: 0 }}>{label}</div>
        {hasFile ? (
          <>
            <div style={{ fontSize: '9px', color: 'var(--sc-acc)', opacity: 0.7, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filename}
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button
                onClick={(e) => { e.stopPropagation(); onPick(); }}
                style={{ fontSize: '9px', color: 'var(--sc-td)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', padding: '2px 4px' }}
                title="Replace"
              >↻</button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                style={{ fontSize: '9px', color: 'var(--sc-td)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', padding: '2px 4px' }}
                title="Remove"
              >✕</button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: '9px', color: 'var(--sc-tddd)', fontStyle: 'italic', flex: 1, letterSpacing: '0.04em' }}>
            click to add {hint}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Config panel (scene-level) ────────────────────
  function renderSceneConfig() {
    return (
      <>
        {/* Wallpaper */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--sc-tdd)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            wallpaper<span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
          </div>
          {renderFileSlot('Image', '.jpg / .png', config.wallpaperFilename, handleWallpaperPick, () => updateConfig({ wallpaperFilename: null }))}
          {config.wallpaperFilename && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: '9px', color: 'var(--sc-td)', letterSpacing: '0.04em' }}>Opacity</span>
                <input type="range" min="0" max="100" value={Math.round(config.wallpaperOpacity * 100)}
                  onChange={e => updateConfig({ wallpaperOpacity: parseInt(e.target.value, 10) / 100 })}
                  style={{ width: '80px', height: '4px', accentColor: 'var(--sc-acc)' }}
                />
                <span style={{ fontSize: '9px', color: 'var(--sc-td)', width: '28px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(config.wallpaperOpacity * 100)}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: '9px', color: 'var(--sc-td)', letterSpacing: '0.04em' }}>Position</span>
                <select
                  value={config.wallpaperPosition}
                  onChange={e => updateConfig({ wallpaperPosition: e.target.value })}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sc-bdr)', color: '#7a7468', fontSize: '10px', fontFamily: 'inherit', padding: '3px 6px', borderRadius: '3px' }}
                >
                  {['top', 'center', 'bottom'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Ambient audio */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--sc-tdd)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ambient audio<span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
          </div>
          {renderFileSlot('Audio', '.mp3 / .ogg', config.ambientFilename, () => openAudioPicker('ambient'), () => updateConfig({ ambientFilename: null }))}
          {config.ambientFilename && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: '9px', color: 'var(--sc-td)', letterSpacing: '0.04em' }}>Volume</span>
                <input type="range" min="0" max="100" value={Math.round(config.ambientVolume * 100)}
                  onChange={e => updateConfig({ ambientVolume: parseInt(e.target.value, 10) / 100 })}
                  style={{ width: '80px', height: '4px', accentColor: 'var(--sc-acc)' }}
                />
                <span style={{ fontSize: '9px', color: 'var(--sc-td)', width: '28px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(config.ambientVolume * 100)}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: '9px', color: 'var(--sc-td)', letterSpacing: '0.04em' }}>Loop</span>
                <select
                  value={config.ambientLoop ? 'yes' : 'no'}
                  onChange={e => updateConfig({ ambientLoop: e.target.value === 'yes' })}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sc-bdr)', color: '#7a7468', fontSize: '10px', fontFamily: 'inherit', padding: '3px 6px', borderRadius: '3px' }}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Scene transition */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--sc-tdd)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            scene transition<span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ fontSize: '9px', color: 'var(--sc-td)', letterSpacing: '0.04em' }}>Fade in</span>
            <select value={config.fadeIn} onChange={e => updateConfig({ fadeIn: +e.target.value })}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sc-bdr)', color: '#7a7468', fontSize: '10px', fontFamily: 'inherit', padding: '3px 6px', borderRadius: '3px' }}>
              {[1, 2, 3, 5].map(v => <option key={v} value={v}>{v}s</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ fontSize: '9px', color: 'var(--sc-td)', letterSpacing: '0.04em' }}>Fade out</span>
            <select value={config.fadeOut} onChange={e => updateConfig({ fadeOut: +e.target.value })}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sc-bdr)', color: '#7a7468', fontSize: '10px', fontFamily: 'inherit', padding: '3px 6px', borderRadius: '3px' }}>
              {[1, 2, 3, 5].map(v => <option key={v} value={v}>{v}s</option>)}
            </select>
          </div>
          <div style={{ fontSize: '8px', color: 'var(--sc-tddd)', lineHeight: 1.5, fontStyle: 'italic', marginTop: '2px' }}>
            Controls how audio fades when scrolling into or out of this scene — works in both directions.
          </div>
        </div>

        {/* Voice */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--sc-tdd)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            voice<span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
          </div>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '10px' }}>
            {(['narration', 'dialogue'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => updateConfig({ voiceMode: mode })}
                style={{
                  flex: 1, padding: '6px 8px', fontSize: '9px', fontFamily: 'inherit', letterSpacing: '0.06em',
                  border: config.voiceMode === mode ? '1px solid rgba(255,120,68,0.2)' : '1px solid var(--sc-bdr)',
                  background: config.voiceMode === mode ? 'var(--sc-acc-d)' : 'rgba(255,255,255,0.02)',
                  color: config.voiceMode === mode ? 'var(--sc-acc)' : 'var(--sc-td)',
                  cursor: 'pointer', borderRadius: '3px', textAlign: 'center', textTransform: 'capitalize',
                }}
              >
                {mode === 'narration' ? 'Narration' : 'Per Dialogue'}
              </button>
            ))}
          </div>

          {config.voiceMode === 'narration' ? (
            <>
              <div style={{ fontSize: '8px', color: 'var(--sc-tddd)', lineHeight: 1.5, fontStyle: 'italic', marginBottom: '6px' }}>
                One voice track for the entire scene. Fades in/out at scene boundaries.
              </div>
              {renderFileSlot('Voice', '.mp3', config.narrationFilename, () => openAudioPicker('narration'), () => updateConfig({ narrationFilename: null }))}
              {config.narrationFilename && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontSize: '9px', color: 'var(--sc-td)', letterSpacing: '0.04em' }}>Volume</span>
                  <input type="range" min="0" max="100" value={Math.round(config.narrationVolume * 100)}
                    onChange={e => updateConfig({ narrationVolume: parseInt(e.target.value, 10) / 100 })}
                    style={{ width: '80px', height: '4px', accentColor: 'var(--sc-acc)' }}
                  />
                  <span style={{ fontSize: '9px', color: 'var(--sc-td)', width: '28px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(config.narrationVolume * 100)}%
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: '8px', color: 'var(--sc-tddd)', lineHeight: 1.5, fontStyle: 'italic', marginBottom: '6px' }}>
                Attach a voice clip to each dialogue block. Each clip fades in when scrolled to and fades out when scrolled past — in either direction.
              </div>
              {/* Dialogue voice list */}
              {renderDialogueList()}
            </>
          )}
        </div>
      </>
    );
  }

  // ── Render: Dialogue clip list ────────────────────────────
  function renderDialogueList() {
    const dialogues = elements.filter(e => e.type === 'dialogue');
    if (dialogues.length === 0) {
      return <div style={{ fontSize: '8px', color: 'var(--sc-tddd)', fontStyle: 'italic' }}>No dialogue blocks found in this scene.</div>;
    }

    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {dialogues.map(d => {
            const clip = config.dialogueClips[d.idx];
            const spk = d.direction ? `${d.speaker} (${d.direction})` : d.speaker;
            return (
              <div
                key={d.idx}
                onClick={clip ? undefined : () => openAudioPicker(`dialogue-${d.idx}`)}
                style={{
                  padding: '6px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px',
                  background: clip ? 'rgba(200,150,80,0.04)' : 'rgba(255,255,255,0.015)',
                  border: clip ? '1px solid rgba(200,150,80,0.2)' : '1px solid var(--sc-bdr)',
                  cursor: clip ? 'default' : 'pointer',
                }}
              >
                <div style={{
                  fontSize: '8px', color: '#c8a050', letterSpacing: '0.06em', textTransform: 'uppercase',
                  width: '100px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {spk}
                </div>
                {clip ? (
                  <>
                    <div style={{ fontSize: '8px', color: 'rgba(200,150,80,0.6)', flex: 1 }}>{clip.filename}</div>
                    <button
                      onClick={e => { e.stopPropagation(); openAudioPicker(`dialogue-${d.idx}`); }}
                      style={{ fontSize: '8px', color: 'var(--sc-td)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', padding: '2px 4px' }}
                      title="Replace"
                    >↻</button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const newClips = { ...config.dialogueClips };
                        delete newClips[d.idx];
                        updateConfig({ dialogueClips: newClips });
                      }}
                      style={{ fontSize: '8px', color: 'var(--sc-td)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', padding: '2px 4px' }}
                      title="Remove"
                    >✕</button>
                  </>
                ) : (
                  <div style={{ fontSize: '8px', color: 'var(--sc-tddd)', fontStyle: 'italic', flex: 1 }}>click to add .mp3</div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginTop: '8px' }}>
          <span style={{ fontSize: '9px', color: 'var(--sc-td)', letterSpacing: '0.04em' }}>Default volume</span>
          <input type="range" min="0" max="100" value={Math.round(config.dialogueVolume * 100)}
            onChange={e => updateConfig({ dialogueVolume: parseInt(e.target.value, 10) / 100 })}
            style={{ width: '80px', height: '4px', accentColor: 'var(--sc-acc)' }}
          />
          <span style={{ fontSize: '9px', color: 'var(--sc-td)', width: '28px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(config.dialogueVolume * 100)}%
          </span>
        </div>
      </>
    );
  }

  // ── Render: Config panel (element-level) ──────────────────
  function renderElementConfig(idx: number) {
    const item = elements[idx];
    if (!item) return null;

    return (
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--sc-tdd)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {item.type} #{idx}<span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
        </div>

        {item.type === 'dialogue' && (
          <>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '9px', color: '#c8a050', letterSpacing: '0.04em', fontWeight: 600, textTransform: 'uppercase' }}>
                {item.direction ? `${item.speaker} (${item.direction})` : item.speaker}
              </span>
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'var(--sc-prose-d)', lineHeight: 1.6, marginBottom: '12px' }}>
              {item.text}
            </div>
            {config.voiceMode === 'dialogue' ? (
              <>
                <div style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--sc-tdd)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  voice clip<span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                </div>
                {renderFileSlot('Voice', '.mp3', config.dialogueClips[idx]?.filename || null,
                  () => openAudioPicker(`dialogue-${idx}`),
                  () => {
                    const newClips = { ...config.dialogueClips };
                    delete newClips[idx];
                    updateConfig({ dialogueClips: newClips });
                  }
                )}
                {config.dialogueClips[idx] && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ fontSize: '9px', color: 'var(--sc-td)', letterSpacing: '0.04em' }}>Volume</span>
                    <input type="range" min="0" max="100"
                      value={Math.round((config.dialogueClips[idx]!.volume || config.dialogueVolume) * 100)}
                      onChange={e => {
                        const newClips = { ...config.dialogueClips };
                        newClips[idx] = { ...newClips[idx]!, volume: parseInt(e.target.value, 10) / 100 };
                        updateConfig({ dialogueClips: newClips });
                      }}
                      style={{ width: '80px', height: '4px', accentColor: 'var(--sc-acc)' }}
                    />
                    <span style={{ fontSize: '9px', color: 'var(--sc-td)', width: '28px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round((config.dialogueClips[idx]!.volume || config.dialogueVolume) * 100)}%
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '8px', color: 'var(--sc-tddd)', lineHeight: 1.5, fontStyle: 'italic' }}>
                Switch to &quot;Per Dialogue&quot; voice mode to attach clips to individual dialogue blocks.
              </div>
            )}
          </>
        )}

        {item.type === 'sticky' && (
          <>
            {item.imgSrc && (
              <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveImgSrc(item.imgSrc)} alt={item.caption || 'Sticky image'} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px', opacity: 0.9 }} />
              </div>
            )}
            <div style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--sc-tdd)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              audio clip<span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
            </div>
            {renderFileSlot('Audio', '.mp3', config.stickyClips[idx]?.filename || null,
              () => openAudioPicker(`sticky-${idx}`),
              () => {
                const newClips = { ...config.stickyClips };
                delete newClips[idx];
                updateConfig({ stickyClips: newClips });
              }
            )}
            {config.stickyClips[idx] && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: '8px' }}>
                <span style={{ fontSize: '9px', color: 'var(--sc-td)', letterSpacing: '0.04em' }}>Volume</span>
                <input type="range" min="0" max="100"
                  value={Math.round((config.stickyClips[idx]!.volume || config.stickyVolume) * 100)}
                  onChange={e => {
                    const newClips = { ...config.stickyClips };
                    newClips[idx] = { ...newClips[idx]!, volume: parseInt(e.target.value, 10) / 100 };
                    updateConfig({ stickyClips: newClips });
                  }}
                  style={{ width: '80px', height: '4px', accentColor: 'var(--sc-acc)' }}
                />
                <span style={{ fontSize: '9px', color: 'var(--sc-td)', width: '28px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round((config.stickyClips[idx]!.volume || config.stickyVolume) * 100)}%
                </span>
              </div>
            )}
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'var(--sc-prose-d)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '8px' }}>
              {item.text}
            </div>
            <div style={{ fontSize: '8px', color: 'var(--sc-tddd)', lineHeight: 1.5, fontStyle: 'italic' }}>
              Sticky text block — image pins while text scrolls alongside it.
            </div>
          </>
        )}

        {item.type === 'figure' && (
          <>
            {item.imgSrc && (
              <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveImgSrc(item.imgSrc)} alt={item.alt || item.text} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px', opacity: 0.9 }} />
              </div>
            )}
            <div style={{ fontSize: '8px', color: 'var(--sc-tddd)', lineHeight: 1.5, fontStyle: 'italic' }}>
              {item.alt || item.text} — inline image with caption.
            </div>
          </>
        )}

        {item.type === 'audio' && (
          <div style={{ fontSize: '8px', color: 'var(--sc-tddd)', lineHeight: 1.5, fontStyle: 'italic' }}>
            Inline audio: {item.audioSrc?.replace(/^(\.\.\/)?audio\//, '') || 'unknown'}
          </div>
        )}

        {item.type === 'emphasis' && (
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'var(--sc-prose-d)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '8px' }}>
            {item.text}
          </div>
        )}

        {item.type === 'quote' && (
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'var(--sc-prose-d)', lineHeight: 1.6, borderLeft: '2px solid rgba(255,255,255,0.15)', paddingLeft: '10px', marginBottom: '8px' }}>
            {item.text}
          </div>
        )}

        {item.type === 'internal' && (
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'var(--sc-prose-d)', lineHeight: 1.6, fontStyle: 'italic', opacity: 0.7, paddingLeft: '20px', marginBottom: '8px' }}>
            {item.text}
          </div>
        )}

        {item.type === 'break' && (
          <div style={{ fontSize: '8px', color: 'var(--sc-tddd)', lineHeight: 1.5, fontStyle: 'italic' }}>
            Scene break marker.
          </div>
        )}

        {item.type === 'para' && (
          <>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'var(--sc-prose-d)', lineHeight: 1.6, marginBottom: '12px' }}>
              {item.text}
            </div>
            <div style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--sc-tdd)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              audio clip<span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
            </div>
            {renderFileSlot('Audio', '.mp3', config.paraClips[idx]?.filename || null,
              () => openAudioPicker(`para-${idx}`),
              () => {
                const newClips = { ...config.paraClips };
                delete newClips[idx];
                updateConfig({ paraClips: newClips });
              }
            )}
            {config.paraClips[idx] && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: '8px' }}>
                <span style={{ fontSize: '9px', color: 'var(--sc-td)', letterSpacing: '0.04em' }}>Volume</span>
                <input type="range" min="0" max="100"
                  value={Math.round((config.paraClips[idx]!.volume || config.paraVolume) * 100)}
                  onChange={e => {
                    const newClips = { ...config.paraClips };
                    newClips[idx] = { ...newClips[idx]!, volume: parseInt(e.target.value, 10) / 100 };
                    updateConfig({ paraClips: newClips });
                  }}
                  style={{ width: '80px', height: '4px', accentColor: 'var(--sc-acc)' }}
                />
                <span style={{ fontSize: '9px', color: 'var(--sc-td)', width: '28px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round((config.paraClips[idx]!.volume || config.paraVolume) * 100)}%
                </span>
              </div>
            )}
            <div style={{ fontSize: '8px', color: 'var(--sc-tddd)', lineHeight: 1.5, fontStyle: 'italic' }}>
              Paragraph audio — fades in when scrolled to, fades out when scrolled past.
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Render: Timeline ──────────────────────────────────────
  function renderTimeline() {
    let dots = '';
    if (config.wallpaperFilename) dots += ' \u25CF';
    if (config.ambientFilename) dots += ' \u266B';
    if (config.narrationFilename || Object.keys(config.dialogueClips).length) dots += ' \u266A';

    return (
      <div style={{
        height: '60px', minHeight: '60px', borderTop: '1px solid var(--sc-bdr)',
        background: 'var(--sc-bg3)', padding: '6px 16px', display: 'flex', flexDirection: 'column', gap: '3px',
      }}>
        <div style={{ flex: 1, display: 'flex', gap: '1px', alignItems: 'stretch' }}>
          <div style={{
            width: '10%', borderRadius: '3px', padding: '3px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.015)', color: 'var(--sc-tddd)', fontStyle: 'italic', fontSize: '7px', letterSpacing: '0.08em',
          }}>silence</div>
          <div style={{
            width: '80%', borderRadius: '3px', padding: '3px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(120,100,200,0.1)', border: '1px solid rgba(120,100,200,0.2)', fontSize: '7px', letterSpacing: '0.08em', color: 'var(--sc-td)',
          }}>
            {sectionTitle}{dots}
          </div>
          <div style={{
            width: '10%', borderRadius: '3px', padding: '3px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.015)', color: 'var(--sc-tddd)', fontStyle: 'italic', fontSize: '7px', letterSpacing: '0.08em',
          }}>silence</div>
        </div>
        <div style={{ fontSize: '7px', color: 'var(--sc-tddd)', letterSpacing: '0.1em', textAlign: 'center' }}>
          playhead at 33% triggers audio fades, wallpaper transitions, and voice clips — bidirectionally
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SC_STYLES }} />

      {/* Main SceneCraft modal */}
      <div
        className={isDarkMode ? 'sc-root' : 'sc-root sc-root-light'}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column',
          fontFamily: "'SF Mono','Fira Code','JetBrains Mono',monospace",
          fontSize: '12px', background: 'var(--sc-bg)', color: 'var(--sc-t)',
          userSelect: 'none',
        }}
      >
        {/* Top bar */}
        <div style={{
          height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', borderBottom: '1px solid var(--sc-bdr)', background: 'var(--sc-bg2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '0.15em', color: 'var(--sc-td)' }}>Scenecraft</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setShowPreview(true)}
              style={{
                padding: '5px 12px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '0.08em',
                borderRadius: '4px', cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sc-bdr)', color: 'var(--sc-td)',
              }}
            >
              ▶ preview
            </button>
            <button
              onClick={handleClose}
              style={{
                padding: '5px 12px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '0.08em',
                borderRadius: '4px', cursor: 'pointer',
                background: 'rgba(255,120,68,0.08)', border: '1px solid rgba(255,120,68,0.15)', color: 'var(--sc-acc)', opacity: 0.7,
              }}
            >
              ✕ close
            </button>
          </div>
        </div>

        {/* Editor layout */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Structure panel (left) */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 12px 16px 16px',
            borderRight: '1px solid var(--sc-bdr)',
          }}>
            <div style={{
              fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'var(--sc-tdd)', marginBottom: '12px', paddingBottom: '8px',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              {sectionTitle}
            </div>

            {/* Scene-level item */}
            <div
              onClick={() => setSelectedIdx(-1)}
              style={{
                padding: '7px 10px', borderRadius: '4px', marginBottom: '2px', cursor: 'pointer',
                borderLeft: selectedIdx === -1 ? '3px solid var(--sc-acc)' : '3px solid transparent',
                background: selectedIdx === -1 ? 'var(--sc-acc-d)' : 'transparent',
                transition: 'background 0.12s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <span style={{
                  fontSize: '7px', letterSpacing: '0.1em', textTransform: 'uppercase',
                  padding: '1px 5px', borderRadius: '2px',
                  background: 'rgba(120,100,200,0.15)', color: '#8a7aba',
                }}>scene</span>
                <span style={{ fontSize: '9px', color: 'var(--sc-td)' }}>{sectionTitle}</span>
                <span style={{ fontSize: '8px', color: 'var(--sc-tddd)', marginLeft: 'auto' }}>wallpaper + ambient</span>
              </div>
              {(config.wallpaperFilename || config.ambientFilename) && (
                <div style={{ fontSize: '7px', color: 'rgba(100,200,150,0.7)', letterSpacing: '0.06em', marginTop: '2px' }}>
                  ♫ {[config.wallpaperFilename ? 'img' : '', config.ambientFilename ? 'audio' : ''].filter(Boolean).join(' + ')}
                </div>
              )}
            </div>

            {/* Content elements */}
            {elements.map((item, i) => renderStructureItem(item, i))}
          </div>

          {/* Config panel (right) */}
          <div style={{
            width: '290px', minWidth: '290px', overflowY: 'auto', padding: '16px', background: 'var(--sc-bg2)',
          }}>
            {selectedIdx === -1 ? renderSceneConfig() : renderElementConfig(selectedIdx)}
          </div>
        </div>

        {/* Timeline */}
        {renderTimeline()}
      </div>

      {/* Preview overlay */}
      <SceneCraftPreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        sectionTitle={sectionTitle}
        elements={elements}
        config={config}
        resolveImgSrc={resolveImgSrc}
        getAudioUrl={getAudioUrl}
        getImageUrl={getImageUrl}
        isDarkMode={isDarkMode}
      />

      {/* Reuse existing Image Picker */}
      <ImagePickerModal
        isOpen={showImagePicker}
        theme={theme}
        isDarkMode={isDarkMode}
        images={images}
        onSelect={handleImageSelected}
        onUpload={onImageUpload}
        onDelete={onImageDelete}
        onClose={() => setShowImagePicker(false)}
      />

      {/* Reuse existing Audio Picker */}
      <AudioPickerModal
        isOpen={showAudioPicker}
        theme={theme}
        isDarkMode={isDarkMode}
        audios={audios}
        onSelect={handleAudioSelected}
        onUpload={onAudioUpload}
        onDelete={onAudioDelete}
        onClose={() => setShowAudioPicker(false)}
      />

    </>
  );
}
