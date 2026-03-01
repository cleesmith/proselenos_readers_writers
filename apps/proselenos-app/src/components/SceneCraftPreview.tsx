// components/SceneCraftPreview.tsx
//
// Immersive scroll-driven preview for SceneCraft scenes.
// Uses the pure utility exports from HtmlRenderEngine for parsing and rendering.

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SceneCraftConfig } from '@/services/manuscriptStorage';
import {
  ContentBlocks,
  type SceneCraftElement,
  type FadeObj,
  fadeIn,
  fadeOut,
  tickFade,
  killAudio,
  DLG_FADE,
} from './HtmlRenderEngine';

export type { SceneCraftElement };

// ============================================================
//  Props
// ============================================================

interface SceneCraftPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  sectionTitle: string;
  elements: SceneCraftElement[];
  config: SceneCraftConfig;
  resolveImgSrc: (src: string | undefined) => string | undefined;
  getAudioUrl: (filename: string) => Promise<string | null>;
  getImageUrl: (filename: string) => string | null;
  isDarkMode: boolean;
}

// ============================================================
//  Component
// ============================================================

export default function SceneCraftPreview({
  isOpen,
  onClose,
  sectionTitle,
  elements,
  config,
  resolveImgSrc,
  getAudioUrl,
  getImageUrl,
}: SceneCraftPreviewProps) {
  const [enlargedImg, setEnlargedImg] = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────
  const pvRAF = useRef<number | null>(null);
  const pvAmbient = useRef<FadeObj | null>(null);
  const pvAmbientOut = useRef<FadeObj | null>(null);
  const pvVoice = useRef<FadeObj | null>(null);
  const pvVoiceOut = useRef<FadeObj | null>(null);
  const pvActiveDialogue = useRef(-1);
  const dlgFadeObj = useRef<FadeObj | null>(null);
  const dlgFadeOut = useRef<FadeObj | null>(null);
  const pvActiveSticky = useRef(-1);
  const stkFadeObj = useRef<FadeObj | null>(null);
  const stkFadeOut = useRef<FadeObj | null>(null);
  const pvActivePara = useRef(-1);
  const paraFadeObj = useRef<FadeObj | null>(null);
  const paraFadeOut = useRef<FadeObj | null>(null);
  const pvScrollRef = useRef<HTMLDivElement>(null);
  const pvContentRef = useRef<HTMLDivElement>(null);
  const audioUrlCache = useRef<Map<string, string>>(new Map());

  // ── Cleanup helper ──────────────────────────────────────────
  const cleanupAudio = useCallback(() => {
    if (pvRAF.current) cancelAnimationFrame(pvRAF.current);
    pvRAF.current = null;
    pvAmbient.current = killAudio(pvAmbient.current);
    pvAmbientOut.current = killAudio(pvAmbientOut.current);
    pvVoice.current = killAudio(pvVoice.current);
    pvVoiceOut.current = killAudio(pvVoiceOut.current);
    dlgFadeObj.current = killAudio(dlgFadeObj.current);
    dlgFadeOut.current = killAudio(dlgFadeOut.current);
    stkFadeObj.current = killAudio(stkFadeObj.current);
    stkFadeOut.current = killAudio(stkFadeOut.current);
    paraFadeObj.current = killAudio(paraFadeObj.current);
    paraFadeOut.current = killAudio(paraFadeOut.current);
    pvActiveDialogue.current = -1;
    pvActiveSticky.current = -1;
    pvActivePara.current = -1;
    audioUrlCache.current.forEach(url => URL.revokeObjectURL(url));
    audioUrlCache.current.clear();
  }, []);

  // ── Close handler ───────────────────────────────────────────
  const handleClose = useCallback(() => {
    cleanupAudio();
    setEnlargedImg(null);
    onClose();
  }, [cleanupAudio, onClose]);

  // ── Audio pre-resolution on open ────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    (async () => {
      const cache = new Map<string, string>();
      const toResolve: string[] = [];
      if (config.ambientFilename) toResolve.push(config.ambientFilename);
      if (config.narrationFilename) toResolve.push(config.narrationFilename);
      Object.values(config.dialogueClips).forEach(clip => {
        if (clip.filename) toResolve.push(clip.filename);
      });
      Object.values(config.stickyClips).forEach(clip => {
        if (clip.filename) toResolve.push(clip.filename);
      });
      Object.values(config.paraClips).forEach(clip => {
        if (clip.filename) toResolve.push(clip.filename);
      });

      for (const el of elements) {
        if (el.type === 'audio' && el.audioSrc) {
          const fn = el.audioSrc.replace(/^(\.\.\/)?audio\//, '');
          if (fn && !toResolve.includes(fn)) toResolve.push(fn);
        }
      }

      for (const fn of toResolve) {
        if (cancelled) return;
        if (!cache.has(fn)) {
          const url = await getAudioUrl(fn);
          if (url) cache.set(fn, url);
        }
      }

      if (!cancelled) {
        audioUrlCache.current = cache;
      }
    })();

    // Reset refs
    pvAmbient.current = null;
    pvAmbientOut.current = null;
    pvVoice.current = null;
    pvVoiceOut.current = null;
    pvActiveDialogue.current = -1;
    dlgFadeObj.current = null;
    dlgFadeOut.current = null;
    pvActiveSticky.current = -1;
    stkFadeObj.current = null;
    stkFadeOut.current = null;
    pvActivePara.current = -1;
    paraFadeObj.current = null;
    paraFadeOut.current = null;

    return () => {
      cancelled = true;
      cleanupAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Unmount cleanup ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animation loop ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const scrollEl = pvScrollRef.current;
    const contentEl = pvContentRef.current;
    if (!scrollEl || !contentEl) return;

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
        // Stop all sticky audio
        stkFadeObj.current = killAudio(stkFadeObj.current);
        stkFadeOut.current = killAudio(stkFadeOut.current);
        pvActiveSticky.current = -1;
        // Stop all para audio
        paraFadeObj.current = killAudio(paraFadeObj.current);
        paraFadeOut.current = killAudio(paraFadeOut.current);
        pvActivePara.current = -1;
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

        // Tick sticky fades
        stkFadeObj.current = tickFade(stkFadeObj.current);
        stkFadeOut.current = tickFade(stkFadeOut.current);

        // Tick para fades
        paraFadeObj.current = tickFade(paraFadeObj.current);
        paraFadeOut.current = tickFade(paraFadeOut.current);

        // Fade indicator
        const isFading = pvAmbientOut.current || pvVoiceOut.current || dlgFadeObj.current || dlgFadeOut.current || stkFadeObj.current || stkFadeOut.current || paraFadeObj.current || paraFadeOut.current ||
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

        // Per-sticky-image audio (plays regardless of voiceMode)
        if (inScene) {
          let currentStickyIdx = -1;
          const stickyContainers = pvScrollRef.current?.querySelectorAll('.sc-pv-sticky') ?? [];
          stickyContainers.forEach((sc: Element) => {
            const dataIdx = parseInt((sc as HTMLElement).dataset.stickyIdx || '-1', 10);
            // Only trigger audio when at least one text block inside is visible
            if (sc.querySelector('.sc-pv-block.sc-pv-vis')) {
              currentStickyIdx = dataIdx;
            }
          });

          if (currentStickyIdx !== pvActiveSticky.current) {
            if (stkFadeObj.current && stkFadeObj.current.el) {
              stkFadeOut.current = killAudio(stkFadeOut.current);
              stkFadeOut.current = fadeOut(stkFadeObj.current, DLG_FADE);
              stkFadeObj.current = null;
            }
            pvActiveSticky.current = currentStickyIdx;

            if (currentStickyIdx >= 0) {
              const clip = c.stickyClips[currentStickyIdx];
              if (clip?.filename) {
                const url = audioUrlCache.current.get(clip.filename);
                if (url) {
                  const a = new Audio(url);
                  stkFadeObj.current = fadeIn(a, clip.volume || c.stickyVolume, DLG_FADE);
                }
              }
            }
          }
        }

        // Per-para audio (plays regardless of voiceMode, like sticky)
        if (inScene) {
          let currentParaIdx = -1;
          blocks.forEach(b => {
            const r = b.getBoundingClientRect();
            const dataIdx = parseInt((b as HTMLElement).dataset.idx || '-1', 10);
            if (r.top < playheadY && r.bottom > playheadY && elements[dataIdx] && elements[dataIdx]!.type === 'para') {
              currentParaIdx = dataIdx;
            }
          });

          if (currentParaIdx !== pvActivePara.current) {
            if (paraFadeObj.current && paraFadeObj.current.el) {
              paraFadeOut.current = killAudio(paraFadeOut.current);
              paraFadeOut.current = fadeOut(paraFadeObj.current, DLG_FADE);
              paraFadeObj.current = null;
            }
            pvActivePara.current = currentParaIdx;

            if (currentParaIdx >= 0) {
              const clip = c.paraClips[currentParaIdx];
              if (clip?.filename) {
                const url = audioUrlCache.current.get(clip.filename);
                if (url) {
                  const a = new Audio(url);
                  paraFadeObj.current = fadeIn(a, clip.volume || c.paraVolume, DLG_FADE);
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

  // ── Don't render if closed ──────────────────────────────────
  if (!isOpen) return null;

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .sc-pv-block.sc-pv-vis { opacity: 1 !important; transform: translateY(0) !important; }
        .sc-pv-block.sc-pv-past { opacity: 0.3 !important; }
      `}} />

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
              onClick={handleClose}
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
            padding: '50vh 10vw',
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
            <ContentBlocks
              elements={elements}
              resolveImgSrc={resolveImgSrc}
              resolveAudioSrc={(fn) => audioUrlCache.current.get(fn)}
              onEnlargeImage={(src) => setEnlargedImg(src)}
            />

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
