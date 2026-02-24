// app/authors/SceneCraftModal.tsx
// SceneCraft — scroll-driven immersive storytelling editor
// Full-viewport modal that parses scene XHTML into elements, lets authors
// attach audio/images/voice, and provides a scroll-driven preview.

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SceneCraftConfig } from '@/services/manuscriptStorage';
import ImagePickerModal from './ImagePickerModal';
import AudioPickerModal from './AudioPickerModal';
import { ThemeConfig } from '../shared/theme';

// ============================================================
//  Types
// ============================================================

interface SceneCraftElement {
  type: 'sticky' | 'figure' | 'dialogue' | 'emphasis' | 'quote' | 'internal' | 'break' | 'para' | 'h1' | 'h2' | 'h3' | 'divider' | 'linebreak';
  text: string;
  speaker?: string;
  direction?: string;
  alt?: string;
  imgSrc?: string;
  caption?: string;
  idx: number;
}

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
//  HTML Parser: XHTML → SceneCraftElement[]
// ============================================================

function parseSceneXhtml(xhtml: string): SceneCraftElement[] {
  if (!xhtml || !xhtml.trim()) return [];

  const parser = new DOMParser();
  // Wrap in a root so DOMParser can handle fragments
  const doc = parser.parseFromString(`<div>${xhtml}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return [];

  const elements: SceneCraftElement[] = [];
  let idx = 0;

  function walkChildren(parent: Element) {
    for (let i = 0; i < parent.children.length; i++) {
      const node = parent.children[i];
      if (!node) continue;
      const tag = node.tagName.toLowerCase();
      const cls = node.className || '';

      // Sticky wrap
      if (tag === 'div' && cls.includes('sticky-wrap')) {
        const paragraphs: string[] = [];
        const textDiv = node.querySelector('.sticky-text');
        const pSource = textDiv || node;
        for (let j = 0; j < pSource.children.length; j++) {
          const child = pSource.children[j];
          if (!child) continue;
          if (child.tagName.toLowerCase() === 'p') {
            const text = (child.textContent || '').trim();
            if (text) paragraphs.push(text);
          }
        }
        const img = node.querySelector('img.sticky-img');
        const imgSrc = img?.getAttribute('src') || undefined;
        const captionEl = node.querySelector('.sticky-caption');
        const caption = captionEl?.textContent?.trim() || undefined;
        if (paragraphs.length > 0 || imgSrc) {
          elements.push({
            type: 'sticky',
            text: paragraphs.join('\n\n'),
            imgSrc,
            caption,
            idx: idx++,
          });
        }
        continue;
      }

      // Figure
      if (tag === 'figure') {
        const img = node.querySelector('img');
        const figcaption = node.querySelector('figcaption');
        elements.push({
          type: 'figure',
          text: figcaption?.textContent?.trim() || img?.getAttribute('alt') || 'Image',
          alt: img?.getAttribute('alt') || undefined,
          imgSrc: img?.getAttribute('src') || undefined,
          idx: idx++,
        });
        continue;
      }

      // Dialogue div
      if (tag === 'div' && cls.includes('dialogue')) {
        const speakerEl = node.querySelector('.speaker, span[class*="speaker"]');
        let speaker = 'unknown';
        let direction = '';
        if (speakerEl) {
          const speakerText = (speakerEl.textContent || '').trim();
          // Parse "VAPO (retrospective)" pattern
          const match = speakerText.match(/^([^(]+?)(?:\s*\(([^)]+)\))?:?\s*$/);
          if (match) {
            speaker = (match[1] || '').trim().toLowerCase();
            direction = (match[2] || '').trim();
          } else {
            speaker = speakerText.replace(/:$/, '').trim().toLowerCase();
          }
        }
        // Get dialogue text (everything except the speaker span)
        let dialogueText = '';
        for (let j = 0; j < node.childNodes.length; j++) {
          const child = node.childNodes[j];
          if (!child) continue;
          if (child.nodeType === Node.ELEMENT_NODE && (child as Element).className?.includes('speaker')) continue;
          dialogueText += child.textContent || '';
        }
        elements.push({
          type: 'dialogue',
          text: dialogueText.trim(),
          speaker,
          direction: direction || undefined,
          idx: idx++,
        });
        continue;
      }

      // Emphasis paragraph
      if (tag === 'p' && cls.includes('emphasis-line')) {
        const text = (node.textContent || '').trim();
        if (text) {
          elements.push({ type: 'emphasis', text, idx: idx++ });
        }
        continue;
      }

      // Internal thought paragraph
      if (tag === 'p' && cls.includes('internal')) {
        const text = (node.textContent || '').trim();
        if (text) {
          elements.push({ type: 'internal', text, idx: idx++ });
        }
        continue;
      }

      // Scene break
      if (tag === 'p' && cls.includes('scene-break')) {
        elements.push({ type: 'break', text: node.textContent?.trim() || '• • •', idx: idx++ });
        continue;
      }

      // Headings
      if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
        const text = (node.textContent || '').trim();
        if (text) {
          elements.push({ type: tag as 'h1' | 'h2' | 'h3', text, idx: idx++ });
        }
        continue;
      }

      // Divider (horizontal rule)
      if (tag === 'hr') {
        elements.push({ type: 'divider', text: '', idx: idx++ });
        continue;
      }

      // Blockquote (Quote block)
      if (tag === 'blockquote') {
        const text = (node.textContent || '').trim();
        if (text) {
          elements.push({ type: 'quote', text, idx: idx++ });
        }
        continue;
      }

      // Plain paragraph
      if (tag === 'p') {
        const text = (node.textContent || '').trim();
        if (text) {
          elements.push({ type: 'para', text, idx: idx++ });
        }
        continue;
      }

      // Line break
      if (tag === 'br') {
        elements.push({ type: 'linebreak', text: '', idx: idx++ });
        continue;
      }

      // Recurse into other div containers that aren't dialogue/sticky
      if (tag === 'div') {
        walkChildren(node);
        continue;
      }

      // Any other element with text content → para
      const text = (node.textContent || '').trim();
      if (text) {
        elements.push({ type: 'para', text, idx: idx++ });
      }
    }
  }

  walkChildren(root);
  return elements;
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
  const [enlargedImg, setEnlargedImg] = useState<string | null>(null);
  const [audioPickerTarget, setAudioPickerTarget] = useState<string>(''); // 'ambient' | 'narration' | 'dialogue-N'

  // ── Parse elements from XHTML ──────────────────────────────
  const elements = useMemo(() => parseSceneXhtml(sectionXhtml), [sectionXhtml]);

  // Resolve inline image src (e.g. "images/photo.jpg") to blob URL via getImageUrl
  const resolveImgSrc = (src: string | undefined): string | undefined => {
    if (!src) return src;
    const fn = src.replace(/^(\.\.\/)?images\//, '');
    return getImageUrl(fn) || src;
  };

  // ── Restore config from props on open / sectionId change ───
  useEffect(() => {
    if (isOpen) {
      if (sceneCraftConfig) {
        setConfig({ ...createDefaultConfig(), ...sceneCraftConfig });
      } else {
        setConfig(createDefaultConfig());
      }
      setSelectedIdx(-1);
      setShowPreview(false);
    }
  }, [isOpen, sectionId, sceneCraftConfig]);

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
      if (!isNaN(idx)) {
        const newClips = { ...config.dialogueClips };
        newClips[idx] = { filename, volume: config.dialogueVolume };
        updateConfig({ dialogueClips: newClips });
      }
    }
    setShowAudioPicker(false);
  }, [audioPickerTarget, config.dialogueClips, config.dialogueVolume, updateConfig]);

  // ── Preview refs (imperative audio) ───────────────────────
  const pvRAF = useRef<number | null>(null);
  const pvAmbient = useRef<FadeObj | null>(null);
  const pvAmbientOut = useRef<FadeObj | null>(null);
  const pvVoice = useRef<FadeObj | null>(null);
  const pvVoiceOut = useRef<FadeObj | null>(null);
  const pvActiveDialogue = useRef(-1);
  const dlgFadeObj = useRef<FadeObj | null>(null);
  const dlgFadeOut = useRef<FadeObj | null>(null);
  const pvScrollRef = useRef<HTMLDivElement>(null);
  const pvContentRef = useRef<HTMLDivElement>(null);

  // Resolved audio URL cache for preview
  const audioUrlCache = useRef<Map<string, string>>(new Map());

  // ── Fade engine (verbatim from demo) ──────────────────────
  type FadeObj = {
    el: HTMLAudioElement;
    fadeState: 'in' | 'out' | 'playing';
    startTime: number;
    duration: number;
    targetVol?: number;
    startVol?: number;
  };

  const DLG_FADE = 0.5;

  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

  function fadeIn(audioEl: HTMLAudioElement, vol: number, dur: number): FadeObj {
    audioEl.volume = 0;
    audioEl.play().catch(() => {});
    return { el: audioEl, fadeState: 'in', startTime: Date.now(), duration: dur * 1000, targetVol: vol };
  }

  function fadeOut(obj: FadeObj | null, dur: number): FadeObj | null {
    if (!obj || !obj.el) return null;
    return { el: obj.el, fadeState: 'out', startTime: Date.now(), duration: dur * 1000, startVol: obj.el.volume };
  }

  function tickFade(obj: FadeObj | null): FadeObj | null {
    if (!obj || !obj.el) return null;
    const t = obj.duration > 0 ? clamp((Date.now() - obj.startTime) / obj.duration, 0, 1) : 1;
    if (obj.fadeState === 'in') {
      obj.el.volume = t * (obj.targetVol || 1);
      if (t >= 1) obj.fadeState = 'playing';
    } else if (obj.fadeState === 'out') {
      obj.el.volume = (1 - t) * (obj.startVol || 1);
      if (t >= 1) { obj.el.pause(); return null; }
    }
    return obj;
  }

  function killAudio(obj: FadeObj | null): null {
    if (obj && obj.el) { obj.el.pause(); obj.el.src = ''; }
    return null;
  }

  // ── Preview open/close ────────────────────────────────────
  const openPreview = useCallback(async () => {
    // Pre-resolve audio URLs
    const cache = new Map<string, string>();
    const toResolve: string[] = [];
    if (config.ambientFilename) toResolve.push(config.ambientFilename);
    if (config.narrationFilename) toResolve.push(config.narrationFilename);
    Object.values(config.dialogueClips).forEach(clip => {
      if (clip.filename) toResolve.push(clip.filename);
    });

    for (const fn of toResolve) {
      if (!cache.has(fn)) {
        const url = await getAudioUrl(fn);
        if (url) cache.set(fn, url);
      }
    }
    audioUrlCache.current = cache;

    pvAmbient.current = null;
    pvAmbientOut.current = null;
    pvVoice.current = null;
    pvVoiceOut.current = null;
    pvActiveDialogue.current = -1;
    dlgFadeObj.current = null;
    dlgFadeOut.current = null;

    setShowPreview(true);
  }, [config, getAudioUrl]);

  const closePreview = useCallback(() => {
    if (pvRAF.current) cancelAnimationFrame(pvRAF.current);
    pvAmbient.current = killAudio(pvAmbient.current);
    pvAmbientOut.current = killAudio(pvAmbientOut.current);
    pvVoice.current = killAudio(pvVoice.current);
    pvVoiceOut.current = killAudio(pvVoiceOut.current);
    dlgFadeObj.current = killAudio(dlgFadeObj.current);
    dlgFadeOut.current = killAudio(dlgFadeOut.current);
    pvActiveDialogue.current = -1;
    // Revoke cached audio URLs
    audioUrlCache.current.forEach(url => URL.revokeObjectURL(url));
    audioUrlCache.current.clear();
    setShowPreview(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pvRAF.current) cancelAnimationFrame(pvRAF.current);
      pvAmbient.current = killAudio(pvAmbient.current);
      pvAmbientOut.current = killAudio(pvAmbientOut.current);
      pvVoice.current = killAudio(pvVoice.current);
      pvVoiceOut.current = killAudio(pvVoiceOut.current);
      dlgFadeObj.current = killAudio(dlgFadeObj.current);
      dlgFadeOut.current = killAudio(dlgFadeOut.current);
      audioUrlCache.current.forEach(url => URL.revokeObjectURL(url));
      audioUrlCache.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Preview animation loop ────────────────────────────────
  useEffect(() => {
    if (!showPreview) return;

    const scrollEl = pvScrollRef.current;
    const contentEl = pvContentRef.current;
    if (!scrollEl || !contentEl) return;

    // Wait for DOM to render
    const timer = setTimeout(() => {
      scrollEl.scrollTop = 0;
      const playheadY = window.innerHeight * 0.33;
      const blocks = contentEl.querySelectorAll('.sc-pv-block');
      const enterEl = document.getElementById('sc-pv-enter');
      const exitEl = document.getElementById('sc-pv-exit');
      const infoEl = document.getElementById('sc-pv-info');
      const fadeEl = document.getElementById('sc-pv-fade');
      const bgEl = document.getElementById('sc-pv-bg');
      const c = config;
      let inScene = false;

      function doEnter() {
        if (inScene) return;
        inScene = true;
        if (infoEl) infoEl.textContent = sectionTitle;

        // Wallpaper
        if (c.wallpaperFilename && bgEl) {
          const url = getImageUrl(c.wallpaperFilename);
          if (url) {
            bgEl.style.backgroundImage = `url('${url}')`;
            bgEl.style.backgroundPosition = c.wallpaperPosition;
            bgEl.style.opacity = String(c.wallpaperOpacity);
          }
        }

        // Ambient audio
        pvAmbientOut.current = killAudio(pvAmbientOut.current);
        if (c.ambientFilename) {
          const url = audioUrlCache.current.get(c.ambientFilename);
          if (url) {
            const a = new Audio(url);
            a.loop = !!c.ambientLoop;
            pvAmbient.current = fadeIn(a, c.ambientVolume, c.fadeIn);
          }
        }

        // Narration voice
        pvVoiceOut.current = killAudio(pvVoiceOut.current);
        if (c.voiceMode === 'narration' && c.narrationFilename) {
          const url = audioUrlCache.current.get(c.narrationFilename);
          if (url) {
            const a = new Audio(url);
            pvVoice.current = fadeIn(a, c.narrationVolume, c.fadeIn);
          }
        }
      }

      function doExit() {
        if (!inScene) return;
        inScene = false;
        if (infoEl) infoEl.textContent = '';
        if (bgEl) bgEl.style.opacity = '0';

        // Ambient fade out
        if (pvAmbient.current) { pvAmbientOut.current = fadeOut(pvAmbient.current, c.fadeOut); pvAmbient.current = null; }
        // Narration fade out
        if (pvVoice.current) { pvVoiceOut.current = fadeOut(pvVoice.current, c.fadeOut); pvVoice.current = null; }
        // Stop all dialogue
        dlgFadeObj.current = killAudio(dlgFadeObj.current);
        dlgFadeOut.current = killAudio(dlgFadeOut.current);
        pvActiveDialogue.current = -1;
      }

      function tick() {
        // Tick scene-level fades
        pvAmbientOut.current = tickFade(pvAmbientOut.current);
        pvVoiceOut.current = tickFade(pvVoiceOut.current);
        if (pvAmbient.current && pvAmbient.current.fadeState === 'in') tickFade(pvAmbient.current);
        if (pvVoice.current && pvVoice.current.fadeState === 'in') tickFade(pvVoice.current);

        // Tick dialogue fades
        dlgFadeObj.current = tickFade(dlgFadeObj.current);
        dlgFadeOut.current = tickFade(dlgFadeOut.current);

        // Fade indicator
        const isFading = pvAmbientOut.current || pvVoiceOut.current || dlgFadeObj.current || dlgFadeOut.current ||
          (pvAmbient.current && pvAmbient.current.fadeState === 'in') ||
          (pvVoice.current && pvVoice.current.fadeState === 'in');
        if (fadeEl) {
          fadeEl.textContent = isFading ? '\u2922 fading' : '';
          fadeEl.style.opacity = isFading ? '1' : '0';
        }

        // Block visibility
        blocks.forEach(b => {
          const rect = b.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          if (center < playheadY + 100) b.classList.add('sc-pv-vis'); else b.classList.remove('sc-pv-vis');
          if (center < playheadY - window.innerHeight * 0.3) b.classList.add('sc-pv-past'); else b.classList.remove('sc-pv-past');
        });

        // Scene zone detection
        const enterBottom = enterEl?.getBoundingClientRect().bottom ?? 0;
        const exitTop = exitEl?.getBoundingClientRect().top ?? window.innerHeight;
        if (enterBottom <= playheadY && exitTop > playheadY) {
          doEnter();
        } else {
          doExit();
        }

        // Per-dialogue voice
        if (inScene && c.voiceMode === 'dialogue') {
          let currentDialogueIdx = -1;
          blocks.forEach(b => {
            const r = b.getBoundingClientRect();
            const dataIdx = parseInt((b as HTMLElement).dataset.idx || '-1', 10);
            if (r.top < playheadY && r.bottom > playheadY && elements[dataIdx] && elements[dataIdx]!.type === 'dialogue') {
              currentDialogueIdx = dataIdx;
            }
          });

          if (currentDialogueIdx !== pvActiveDialogue.current) {
            // Fade out previous
            if (dlgFadeObj.current && dlgFadeObj.current.el) {
              dlgFadeOut.current = killAudio(dlgFadeOut.current);
              dlgFadeOut.current = fadeOut(dlgFadeObj.current, DLG_FADE);
              dlgFadeObj.current = null;
            }
            pvActiveDialogue.current = currentDialogueIdx;

            // Fade in new
            if (currentDialogueIdx >= 0) {
              const clip = c.dialogueClips[currentDialogueIdx];
              if (clip?.filename) {
                const url = audioUrlCache.current.get(clip.filename);
                if (url) {
                  const a = new Audio(url);
                  dlgFadeObj.current = fadeIn(a, clip.volume || c.dialogueVolume, DLG_FADE);
                }
              }
            }
          }
        }

        pvRAF.current = requestAnimationFrame(tick);
      }

      pvRAF.current = requestAnimationFrame(tick);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (pvRAF.current) cancelAnimationFrame(pvRAF.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview]);

  // ── Don't render if closed ────────────────────────────────
  if (!isOpen) return null;

  // ── Tag color classes ─────────────────────────────────────
  function tagStyle(type: string): React.CSSProperties {
    const styles: Record<string, React.CSSProperties> = {
      sticky: { background: 'rgba(100,180,120,0.15)', color: '#6ab47a' },
      figure: { background: 'rgba(100,150,200,0.15)', color: '#6a9ac8' },
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
    const hasClip = config.voiceMode === 'dialogue' && !!config.dialogueClips[i];

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
            ♫ {config.dialogueClips[i]?.filename}
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
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'var(--sc-prose-d)', lineHeight: 1.6, marginBottom: '8px' }}>
            {item.text}
          </div>
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

  // ── Render: Preview overlay ───────────────────────────────
  function renderPreview() {
    if (!showPreview) return null;

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10001, background: '#060608',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Preview topbar */}
        <div style={{
          height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)', zIndex: 10,
        }}>
          <span style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#5a554e' }}>PREVIEW</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span id="sc-pv-fade" style={{
              fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(255,120,68,0.6)', opacity: 0,
              transition: 'opacity 0.5s',
            }}></span>
            <button
              onClick={closePreview}
              style={{
                fontSize: '11px', color: 'var(--sc-acc)', opacity: 0.7, cursor: 'pointer',
                background: 'none', border: 'none', fontFamily: 'inherit', letterSpacing: '0.08em',
              }}
            >✕ close</button>
          </div>
        </div>

        {/* Playhead line at 33% */}
        <div style={{
          position: 'fixed', left: 0, right: 0, top: '33%', height: '1px',
          background: 'rgba(255,120,68,0.15)', zIndex: 10, pointerEvents: 'none',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,120,68,0.4)',
            position: 'absolute', left: '50%', top: '-3px', transform: 'translateX(-50%)',
          }} />
        </div>

        {/* Scene info */}
        <div id="sc-pv-info" style={{
          position: 'fixed', right: '16px', top: 'calc(33% - 14px)', fontSize: '9px',
          letterSpacing: '0.12em', color: 'rgba(255,120,68,0.35)', zIndex: 10, pointerEvents: 'none',
        }}></div>

        {/* Background wallpaper */}
        <div id="sc-pv-bg" style={{
          position: 'fixed', inset: 0, backgroundSize: 'cover', backgroundRepeat: 'no-repeat',
          opacity: 0, transition: 'opacity 1.5s ease', zIndex: 0, pointerEvents: 'none',
        }}></div>

        {/* Scrollable content */}
        <div ref={pvScrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div ref={pvContentRef} style={{
            maxWidth: '34rem', margin: '0 auto', padding: '50vh 2rem',
            fontFamily: "Georgia, 'EB Garamond', serif",
            fontSize: 'clamp(1.1rem, 2.2vw, 1.35rem)', lineHeight: 2, color: '#c8c0b4',
          }}>
            {/* Dead zone before */}
            <div style={{ height: '50vh', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '2rem' }}>
              <span style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#2a2620', fontStyle: 'italic' }}>— silence —</span>
            </div>

            {/* Scene label */}
            <div id="sc-pv-enter" style={{
              textAlign: 'center', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(255,120,68,0.25)', marginBottom: '3em', paddingBottom: '1em',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              {sectionTitle}
            </div>

            {/* Content blocks */}
            {elements.map((item, i) => {
              if (item.type === 'dialogue') {
                const spk = item.direction ? `${item.speaker} (${item.direction})` : item.speaker;
                return (
                  <div key={i} className="sc-pv-block" data-idx={i} style={{
                    marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
                    transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                    color: '#d4c090',
                  }}>
                    <span style={{
                      fontFamily: "'SF Mono','Fira Code',monospace", fontSize: '0.65em',
                      letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a08040',
                      display: 'block', marginBottom: '0.3em',
                    }}>{spk}</span>
                    {item.text}
                  </div>
                );
              }
              if (item.type === 'sticky') {
                const lines = item.text.split('\n').filter(l => l.trim());
                return (
                  <div key={i} style={{
                    display: 'flex', gap: '1.5em', alignItems: 'flex-start',
                    minHeight: '300px', marginBottom: '1.6em',
                    position: 'relative', zIndex: 2,
                  }}>
                    {item.imgSrc && (
                      <div style={{
                        position: 'sticky', top: '33vh',
                        width: '40%', flexShrink: 0,
                        cursor: 'zoom-in',
                      }} onClick={() => setEnlargedImg(resolveImgSrc(item.imgSrc!) || null)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={resolveImgSrc(item.imgSrc)} alt={item.caption || 'Sticky image'}
                             style={{ width: '100%', borderRadius: '4px', opacity: 0.9, display: 'block' }} />
                        {item.caption && (
                          <p style={{ fontSize: '0.75em', textAlign: 'center',
                                      fontStyle: 'italic', opacity: 0.6, margin: '0.4em 0 0' }}>
                            {item.caption}
                          </p>
                        )}
                      </div>
                    )}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1em' }}>
                      {lines.map((line, li) => (
                        <div key={li} className="sc-pv-block" data-idx={i} style={{
                          opacity: 0, transform: 'translateY(16px)',
                          transition: 'opacity 0.8s ease, transform 0.8s ease',
                        }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              if (item.type === 'emphasis') {
                return (
                  <div key={i} className="sc-pv-block" data-idx={i} style={{
                    marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
                    transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                    textAlign: 'center', fontSize: '1.2em', letterSpacing: '0.08em',
                    fontStyle: 'italic', color: '#e0c8b0',
                  }}>
                    {item.text}
                  </div>
                );
              }
              if (item.type === 'quote') {
                return (
                  <div key={i} className="sc-pv-block" data-idx={i} style={{
                    marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
                    transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                    borderLeft: '2px solid rgba(200,192,180,0.3)', paddingLeft: '1.5em',
                  }}>
                    {item.text}
                  </div>
                );
              }
              if (item.type === 'internal') {
                return (
                  <div key={i} className="sc-pv-block" data-idx={i} style={{
                    marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
                    transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                    fontStyle: 'italic', paddingLeft: '2em',
                  }}>
                    {item.text}
                  </div>
                );
              }
              if (item.type === 'break') {
                return (
                  <div key={i} className="sc-pv-block" data-idx={i} style={{
                    marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
                    transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                    textAlign: 'center', color: '#3a3530', letterSpacing: '0.3em',
                  }}>
                    {item.text}
                  </div>
                );
              }
              if (item.type === 'figure') {
                return (
                  <div key={i} className="sc-pv-block" data-idx={i} style={{
                    marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
                    transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                    textAlign: 'left',
                  }}>
                    {item.imgSrc ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={resolveImgSrc(item.imgSrc)} alt={item.alt || item.text} style={{ maxWidth: '260px', borderRadius: '4px', opacity: 0.9, display: 'block' }} />
                        <span style={{ fontFamily: "'SF Mono', monospace", fontSize: '0.55em', color: '#5a554e', letterSpacing: '0.06em', marginTop: '0.4em', display: 'block' }}>
                          {item.alt || item.text}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: '#5a554e', fontStyle: 'italic', fontSize: '0.8em' }}>[{item.alt || item.text}]</span>
                    )}
                  </div>
                );
              }
              if (item.type === 'h1' || item.type === 'h2' || item.type === 'h3') {
                const sizes = { h1: '1.8em', h2: '1.4em', h3: '1.15em' };
                return (
                  <div key={i} className="sc-pv-block" data-idx={i} style={{
                    marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
                    transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                    fontSize: sizes[item.type], fontWeight: 'bold', fontFamily: 'Georgia, "Times New Roman", serif',
                    color: '#c8c0b4',
                  }}>
                    {item.text}
                  </div>
                );
              }
              if (item.type === 'divider') {
                return (
                  <div key={i} className="sc-pv-block" data-idx={i} style={{
                    margin: '1.6em 0', opacity: 0, transform: 'translateY(16px)',
                    transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                    borderTop: '1px solid rgba(200,192,180,0.2)',
                  }} />
                );
              }
              if (item.type === 'linebreak') {
                return (
                  <div key={i} className="sc-pv-block" data-idx={i} style={{
                    height: '1.2em', margin: 0, opacity: 0, transform: 'translateY(16px)',
                    transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                  }} />
                );
              }
              if (item.type === 'para') {
                return (
                  <div key={i} className="sc-pv-block" data-idx={i} style={{
                    marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
                    transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                  }}>
                    {item.text}
                  </div>
                );
              }
              return null;
            })}

            {/* Exit marker */}
            <div id="sc-pv-exit" style={{
              textAlign: 'center', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(255,120,68,0.15)', marginTop: '3em', paddingTop: '1em',
              borderTop: '1px solid rgba(255,255,255,0.03)', fontStyle: 'italic',
            }}>
              — silence —
            </div>

            {/* Dead zone after */}
            <div style={{ height: '70vh' }}></div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SC_STYLES }} />
      <style dangerouslySetInnerHTML={{ __html: `
        .sc-pv-block.sc-pv-vis { opacity: 1 !important; transform: translateY(0) !important; }
        .sc-pv-block.sc-pv-past { opacity: 0.3 !important; }
      `}} />

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
              onClick={openPreview}
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
      {renderPreview()}

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

      {/* Click-to-enlarge overlay */}
      {enlargedImg && (
        <div onClick={() => setEnlargedImg(null)} style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: '#000', cursor: 'zoom-out',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enlargedImg} alt="Enlarged" style={{
            maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain',
          }} />
        </div>
      )}
    </>
  );
}
