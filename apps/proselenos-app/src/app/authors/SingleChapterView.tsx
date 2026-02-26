// app/authors/SingleChapterView.tsx
// Standalone scroll-driven immersive chapter viewer.
// Lifted from SceneCraftModal.tsx preview renderer — no editing UI,
// just the full-screen playhead-driven reading experience with
// wallpaper, ambient audio, narration, and per-dialogue voice clips.

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SceneCraftConfig } from '@/services/manuscriptStorage';
import StyledSmallButton from '@/components/StyledSmallButton';
import { ThemeConfig } from '@/app/shared/theme';

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

// ============================================================
//  Props
// ============================================================

interface SingleChapterViewProps {
  isOpen: boolean;
  onClose: () => void;
  sectionTitle: string;
  sectionXhtml: string;
  sceneCraftConfig: SceneCraftConfig | null;
  getImageUrl: (filename: string) => string | null;
  getAudioUrl: (filename: string) => Promise<string | null>;
  bookTitle?: string;
  bookAuthor?: string;
  bookCopyright?: string;
  theme: ThemeConfig;
}

// ============================================================
//  HTML Parser: XHTML → SceneCraftElement[]
// ============================================================

function parseSceneXhtml(xhtml: string): SceneCraftElement[] {
  if (!xhtml || !xhtml.trim()) return [];

  const parser = new DOMParser();
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
          const match = speakerText.match(/^([^(]+?)(?:\s*\(([^)]+)\))?:?\s*$/);
          if (match) {
            speaker = (match[1] || '').trim().toLowerCase();
            direction = (match[2] || '').trim();
          } else {
            speaker = speakerText.replace(/:$/, '').trim().toLowerCase();
          }
        }
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
//  Fade engine (imperative audio helpers)
// ============================================================

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

// ============================================================
//  Component
// ============================================================

export default function SingleChapterView({
  isOpen,
  onClose,
  sectionTitle,
  sectionXhtml,
  sceneCraftConfig,
  getImageUrl,
  getAudioUrl,
  bookTitle,
  bookAuthor,
  bookCopyright,
  theme,
}: SingleChapterViewProps) {
  // ── Preview toggles ────────────────────────────────────────
  const [pvLight, setPvLight] = useState(false);          // false=dark, true=light
  const [showScOrange, setShowScOrange] = useState(true); // show SceneCraft orange visuals

  // ── Derived colors based on pvLight ────────────────────────
  const pvBg = pvLight ? '#f5f5f0' : '#060608';
  const pvText = pvLight ? '#3a3530' : '#c8c0b4';
  const pvMuted = pvLight ? '#7a756e' : '#5a554e';
  const pvTopbarBg = pvLight ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.5)';
  const pvTopbarBorder = pvLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.06)';

  // ── Parse elements from XHTML ──────────────────────────────
  const elements = useMemo(() => parseSceneXhtml(sectionXhtml), [sectionXhtml]);

  // Merge provided config with defaults
  const config = useMemo(
    () => sceneCraftConfig ? { ...createDefaultConfig(), ...sceneCraftConfig } : createDefaultConfig(),
    [sceneCraftConfig],
  );

  // Enlarged image lightbox
  const [enlargedImg, setEnlargedImg] = useState<string | null>(null);

  // Resolve inline image src (e.g. "images/photo.jpg") to blob URL
  const resolveImgSrc = useCallback((src: string | undefined): string | undefined => {
    if (!src) return src;
    const fn = src.replace(/^(\.\.\/)?images\//, '');
    return getImageUrl(fn) || src;
  }, [getImageUrl]);

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

  // Resolved audio URL cache
  const audioUrlCache = useRef<Map<string, string>>(new Map());

  // ── Open: pre-resolve audio URLs ──────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function resolveAudio() {
      const cache = new Map<string, string>();
      const toResolve: string[] = [];
      if (config.ambientFilename) toResolve.push(config.ambientFilename);
      if (config.narrationFilename) toResolve.push(config.narrationFilename);
      Object.values(config.dialogueClips).forEach(clip => {
        if (clip.filename) toResolve.push(clip.filename);
      });

      for (const fn of toResolve) {
        if (cancelled) return;
        if (!cache.has(fn)) {
          const url = await getAudioUrl(fn);
          if (url) cache.set(fn, url);
        }
      }

      if (!cancelled) {
        audioUrlCache.current = cache;
        pvAmbient.current = null;
        pvAmbientOut.current = null;
        pvVoice.current = null;
        pvVoiceOut.current = null;
        pvActiveDialogue.current = -1;
        dlgFadeObj.current = null;
        dlgFadeOut.current = null;
      }
    }

    resolveAudio();
    return () => { cancelled = true; };
  }, [isOpen, config, getAudioUrl]);

  // ── Close handler ─────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (pvRAF.current) cancelAnimationFrame(pvRAF.current);
    pvAmbient.current = killAudio(pvAmbient.current);
    pvAmbientOut.current = killAudio(pvAmbientOut.current);
    pvVoice.current = killAudio(pvVoice.current);
    pvVoiceOut.current = killAudio(pvVoiceOut.current);
    dlgFadeObj.current = killAudio(dlgFadeObj.current);
    dlgFadeOut.current = killAudio(dlgFadeOut.current);
    pvActiveDialogue.current = -1;
    audioUrlCache.current.forEach(url => URL.revokeObjectURL(url));
    audioUrlCache.current.clear();
    onClose();
  }, [onClose]);

  // ── Cleanup on unmount ────────────────────────────────────
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

  // ── Animation loop ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const scrollEl = pvScrollRef.current;
    const contentEl = pvContentRef.current;
    if (!scrollEl || !contentEl) return;

    const timer = setTimeout(() => {
      scrollEl.scrollTop = 0;
      const playheadY = window.innerHeight * 0.33;
      const blocks = contentEl.querySelectorAll('.sc-pv-block');
      const enterEl = document.getElementById('scv-pv-enter');
      const exitEl = document.getElementById('scv-pv-exit');
      const infoEl = document.getElementById('scv-pv-info');
      const bgEl = document.getElementById('scv-pv-bg');
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
  }, [isOpen]);

  // ── Don't render if closed ────────────────────────────────
  if (!isOpen) return null;

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .sc-pv-block.sc-pv-vis { opacity: 1 !important; transform: translateY(0) !important; }
        .sc-pv-block.sc-pv-past { opacity: 0.3 !important; }
      `}} />

      <div style={{
        position: 'fixed', inset: 0, zIndex: 10001, background: pvBg,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Topbar */}
        <div style={{
          height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', background: pvTopbarBg, borderBottom: `1px solid ${pvTopbarBorder}`, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Dark/Light toggle */}
            <button onClick={() => setPvLight(v => !v)} title={pvLight ? 'Dark mode' : 'Light mode'}
              style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px' }}>
              {pvLight ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
            </button>
            {/* SceneCraft orange toggle — only shown when sceneCraftConfig exists */}
            {sceneCraftConfig && (
              <button onClick={() => setShowScOrange(v => !v)}
                title={showScOrange ? 'Hide SceneCraft visuals' : 'Show SceneCraft visuals'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                  style={{ width: '22px', height: '22px', fill: '#ff7844', opacity: showScOrange ? 1 : 0.35,
                    transition: 'opacity 0.2s' }}>
                  <path d="M19 2H6c-1.2 0-2 .9-2 2v16c0 1.1.8 2 2 2h13c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h2v8l2.5-1.5L13 12V4h6v16z"/>
                </svg>
              </button>
            )}
          </div>
          {/* Book metadata */}
          <span style={{ fontSize: '13px', color: pvMuted, letterSpacing: '0.05em' }}>
            <span style={{ fontStyle: 'italic' }}>{bookTitle || 'Untitled'}</span>
            {bookAuthor ? <span>{'  '}by {bookAuthor}</span> : null}
            {bookCopyright ? <span>{'  '}{bookCopyright}</span> : null}
          </span>
          {/* Close button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <StyledSmallButton onClick={handleClose} theme={theme}>Close</StyledSmallButton>
          </div>
        </div>

        {/* Playhead line at 33% */}
        <div style={{
          position: 'fixed', left: 0, right: 0, top: '33%', height: '1px',
          background: 'rgba(255,120,68,0.15)', zIndex: 10, pointerEvents: 'none',
          display: showScOrange ? undefined : 'none',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,120,68,0.4)',
            position: 'absolute', left: '50%', top: '-3px', transform: 'translateX(-50%)',
          }} />
        </div>

        {/* Scene info */}
        <div id="scv-pv-info" style={{
          position: 'fixed', right: '16px', top: 'calc(33% - 14px)', fontSize: '9px',
          letterSpacing: '0.12em', color: 'rgba(255,120,68,0.35)', zIndex: 10, pointerEvents: 'none',
          display: showScOrange ? undefined : 'none',
        }}></div>

        {/* Background wallpaper */}
        <div id="scv-pv-bg" style={{
          position: 'fixed', inset: 0, backgroundSize: 'cover', backgroundRepeat: 'no-repeat',
          opacity: 0, transition: 'opacity 1.5s ease', zIndex: 0, pointerEvents: 'none',
        }}></div>

        {/* Scrollable content */}
        <div ref={pvScrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div ref={pvContentRef} style={{
            maxWidth: '34rem', margin: '0 auto', padding: '50vh 2rem',
            fontFamily: "Georgia, 'EB Garamond', serif",
            fontSize: 'clamp(1.1rem, 2.2vw, 1.35rem)', lineHeight: 2, color: pvText,
          }}>
            {/* Dead zone before */}
            <div style={{ height: '50vh', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '2rem' }}>
              <span style={{ fontSize: '10px', letterSpacing: '0.15em', color: pvLight ? '#bab5ae' : '#2a2620', fontStyle: 'italic' }}>— silence —</span>
            </div>

            {/* Scene label */}
            <div id="scv-pv-enter" style={{
              textAlign: 'center', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(255,120,68,0.25)', marginBottom: '3em', paddingBottom: '1em',
              borderBottom: `1px solid ${pvLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)'}`,
              display: showScOrange ? undefined : 'none',
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
                    color: pvLight ? '#5a4520' : '#d4c090',
                  }}>
                    <span style={{
                      fontFamily: "'SF Mono','Fira Code',monospace", fontSize: '0.65em',
                      letterSpacing: '0.1em', textTransform: 'uppercase', color: pvLight ? '#8a6530' : '#a08040',
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
                    color: pvText,
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
            <div id="scv-pv-exit" style={{
              textAlign: 'center', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
              color: showScOrange ? 'rgba(255,120,68,0.15)' : (pvLight ? '#bab5ae' : '#2a2620'),
              marginTop: '3em', paddingTop: '1em',
              borderTop: `1px solid ${pvLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)'}`, fontStyle: 'italic',
            }}>
              — silence —
            </div>

            {/* Dead zone after */}
            <div style={{ height: '70vh' }}></div>
          </div>
        </div>
      </div>

      {/* Enlarged image overlay */}
      {enlargedImg && (
        <div
          onClick={() => setEnlargedImg(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enlargedImg} alt="Enlarged" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '6px' }} />
        </div>
      )}
    </>
  );
}
