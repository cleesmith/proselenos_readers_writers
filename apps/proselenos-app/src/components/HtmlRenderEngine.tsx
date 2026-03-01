// components/HtmlRenderEngine.tsx
//
// Pure utility module: XHTML parser, ContentBlocks renderer, fade engine,
// and SectionAudioEngine for per-section audio lifecycle.
// No UI shell — the immersive preview lives in SceneCraftPreview.tsx.

'use client';

import type { SceneCraftConfig } from '@/services/manuscriptStorage';

// ============================================================
//  Types (exported for reuse)
// ============================================================

export interface SceneCraftElement {
  type: 'sticky' | 'figure' | 'dialogue' | 'emphasis' | 'quote' | 'internal' | 'break' | 'para' | 'h1' | 'h2' | 'h3' | 'divider' | 'linebreak' | 'audio';
  text: string;
  speaker?: string;
  direction?: string;
  alt?: string;
  imgSrc?: string;
  caption?: string;
  audioSrc?: string;
  width?: string;
  idx: number;
}

// ============================================================
//  Fade engine (exported for reuse)
// ============================================================

export type FadeObj = {
  el: HTMLAudioElement;
  fadeState: 'in' | 'out' | 'playing';
  startTime: number;
  duration: number;
  targetVol?: number;
  startVol?: number;
};

export const DLG_FADE = 0.5;

export function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export function fadeIn(audioEl: HTMLAudioElement, vol: number, dur: number): FadeObj {
  audioEl.volume = 0;
  audioEl.play().catch(() => {});
  return { el: audioEl, fadeState: 'in', startTime: Date.now(), duration: dur * 1000, targetVol: vol };
}

export function fadeOut(obj: FadeObj | null, dur: number): FadeObj | null {
  if (!obj || !obj.el) return null;
  return { el: obj.el, fadeState: 'out', startTime: Date.now(), duration: dur * 1000, startVol: obj.el.volume };
}

export function tickFade(obj: FadeObj | null): FadeObj | null {
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

export function killAudio(obj: FadeObj | null): null {
  if (obj && obj.el) { obj.el.pause(); obj.el.src = ''; }
  return null;
}

// ============================================================
//  HTML Parser: XHTML → SceneCraftElement[] (exported)
// ============================================================

export function parseSceneXhtml(xhtml: string): SceneCraftElement[] {
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
        const styleAttr = node.getAttribute('style') || '';
        const widthMatch = styleAttr.match(/(?:^|;)\s*width\s*:\s*([^;]+)/);
        elements.push({
          type: 'figure',
          text: figcaption?.textContent?.trim() || img?.getAttribute('alt') || 'Image',
          alt: img?.getAttribute('alt') || undefined,
          imgSrc: img?.getAttribute('src') || undefined,
          width: widthMatch?.[1]?.trim() || undefined,
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

      // Audio block (author-inserted or VN scene-audio)
      if (tag === 'div' && (cls.includes('audio-block') || cls.includes('scene-audio'))) {
        const sourceEl = node.querySelector('audio source');
        const audioSrc = sourceEl?.getAttribute('src') || '';
        const captionEl = node.querySelector('.caption, .audio-label');
        const caption = captionEl?.textContent?.trim() || '';
        elements.push({ type: 'audio', text: caption, audioSrc, idx: idx++ });
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
//  ContentBlocks — shared element renderer (exported)
// ============================================================

export interface ContentBlocksProps {
  elements: SceneCraftElement[];
  resolveImgSrc: (src: string | undefined) => string | undefined;
  resolveAudioSrc?: (filename: string) => string | undefined;
  onEnlargeImage?: (src: string) => void;
  sectionIndex?: number;   // adds data-sec={si} to blocks
}

export function ContentBlocks({ elements, resolveImgSrc, resolveAudioSrc, onEnlargeImage, sectionIndex }: ContentBlocksProps) {
  return (
    <>
      {elements.map((item, i) => {
        if (item.type === 'dialogue') {
          const spk = item.direction ? `${item.speaker} (${item.direction})` : item.speaker;
          return (
            <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
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
            <div key={i} className="sc-pv-sticky" data-sticky-idx={item.idx} style={{
              display: 'flex', gap: '1.5em', alignItems: 'flex-start',
              minHeight: '300px', marginBottom: '1.6em',
              position: 'relative', zIndex: 2,
            }}>
              {item.imgSrc && (
                <div style={{
                  position: 'sticky', top: '33vh',
                  width: '40%', flexShrink: 0,
                  cursor: onEnlargeImage ? 'zoom-in' : undefined,
                }} onClick={onEnlargeImage ? () => {
                  const resolved = resolveImgSrc(item.imgSrc!);
                  if (resolved) onEnlargeImage(resolved);
                } : undefined}>
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
                  <div key={li} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
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
            <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
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
            <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
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
            <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
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
            <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
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
            <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
              marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
              transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
              textAlign: 'left',
            }}>
              {item.imgSrc ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions */}
                  <img src={resolveImgSrc(item.imgSrc)} alt={item.alt || item.text}
                    style={{ width: '100%', ...(item.width ? { maxWidth: item.width } : {}), borderRadius: '4px', opacity: 0.9, display: 'block',
                      ...(onEnlargeImage ? { cursor: 'zoom-in' } : {}),
                    }}
                    onClick={onEnlargeImage ? () => {
                      const resolved = resolveImgSrc(item.imgSrc!);
                      if (resolved) onEnlargeImage(resolved);
                    } : undefined}
                  />
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
        if (item.type === 'audio') {
          const fn = item.audioSrc?.replace(/^(\.\.\/)?audio\//, '') || '';
          const resolvedSrc = fn && resolveAudioSrc ? resolveAudioSrc(fn) : undefined;
          return (
            <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
              marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
              transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
            }}>
              {resolvedSrc ? (
                /* eslint-disable-next-line jsx-a11y/media-has-caption */
                <audio controls preload="none" style={{ width: '100%', maxWidth: '400px' }}>
                  <source src={resolvedSrc} />
                </audio>
              ) : (
                <span style={{ color: '#5a554e', fontStyle: 'italic', fontSize: '0.8em' }}>
                  [audio: {fn || 'unknown'}]
                </span>
              )}
              {item.text && <div style={{ fontSize: '0.75em', color: '#5a554e', marginTop: '0.3em' }}>{item.text}</div>}
            </div>
          );
        }
        if (item.type === 'h1' || item.type === 'h2' || item.type === 'h3') {
          const sizes = { h1: '1.8em', h2: '1.4em', h3: '1.15em' };
          return (
            <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
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
            <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
              margin: '1.6em 0', opacity: 0, transform: 'translateY(16px)',
              transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
              borderTop: '1px solid rgba(200,192,180,0.2)',
            }} />
          );
        }
        if (item.type === 'linebreak') {
          return (
            <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
              height: '1.2em', margin: 0, opacity: 0, transform: 'translateY(16px)',
              transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
            }} />
          );
        }
        if (item.type === 'para') {
          return (
            <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={sectionIndex} style={{
              marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
              transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
            }}>
              {item.text}
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

// ============================================================
//  SectionAudioEngine — per-section audio lifecycle manager
// ============================================================

export class SectionAudioEngine {
  // Audio state
  private ambient: FadeObj | null = null;
  private ambientOut: FadeObj | null = null;
  private voice: FadeObj | null = null;
  private voiceOut: FadeObj | null = null;
  private dlgFade: FadeObj | null = null;
  private dlgFadeOut: FadeObj | null = null;
  private activeDialogueIdx = -1;
  private stkFade: FadeObj | null = null;
  private stkFadeOut: FadeObj | null = null;
  private activeStickyIdx = -1;

  constructor(
    private config: SceneCraftConfig | null,
    private audioUrls: Map<string, string>,
    private imageUrls: Map<string, string>,
  ) {}

  /** Start ambient + narration audio, apply wallpaper. bgEl/infoEl are shared DOM nodes. */
  enter(bgEl: HTMLElement | null, infoEl: HTMLElement | null, title: string): void {
    if (infoEl) infoEl.textContent = title;

    const c = this.config;
    if (!c) return;

    // Wallpaper
    if (c.wallpaperFilename && bgEl) {
      const url = this.imageUrls.get(c.wallpaperFilename);
      if (url) {
        bgEl.style.backgroundImage = `url('${url}')`;
        bgEl.style.backgroundPosition = c.wallpaperPosition;
        bgEl.style.opacity = String(c.wallpaperOpacity);
      }
    }

    // Ambient audio
    this.ambientOut = killAudio(this.ambientOut);
    if (c.ambientFilename) {
      const url = this.audioUrls.get(c.ambientFilename);
      if (url) {
        const a = new Audio(url);
        a.loop = !!c.ambientLoop;
        this.ambient = fadeIn(a, c.ambientVolume, c.fadeIn);
      }
    }

    // Narration voice
    this.voiceOut = killAudio(this.voiceOut);
    if (c.voiceMode === 'narration' && c.narrationFilename) {
      const url = this.audioUrls.get(c.narrationFilename);
      if (url) {
        const a = new Audio(url);
        this.voice = fadeIn(a, c.narrationVolume, c.fadeIn);
      }
    }
  }

  /** Fade out all audio, clear wallpaper. */
  exit(bgEl: HTMLElement | null, infoEl: HTMLElement | null): void {
    const c = this.config;
    const fadeOutDur = c?.fadeOut ?? 3;

    if (infoEl) infoEl.textContent = '';
    if (bgEl) bgEl.style.opacity = '0';

    // Ambient fade out
    if (this.ambient) { this.ambientOut = fadeOut(this.ambient, fadeOutDur); this.ambient = null; }
    // Narration fade out
    if (this.voice) { this.voiceOut = fadeOut(this.voice, fadeOutDur); this.voice = null; }
    // Stop dialogue
    this.dlgFade = killAudio(this.dlgFade);
    this.dlgFadeOut = killAudio(this.dlgFadeOut);
    this.activeDialogueIdx = -1;
    // Stop sticky
    this.stkFade = killAudio(this.stkFade);
    this.stkFadeOut = killAudio(this.stkFadeOut);
    this.activeStickyIdx = -1;
  }

  /** Tick all ongoing fades (ambient, voice, dialogue, sticky). Call every RAF frame. */
  tick(): void {
    this.ambientOut = tickFade(this.ambientOut);
    this.voiceOut = tickFade(this.voiceOut);
    if (this.ambient && this.ambient.fadeState === 'in') tickFade(this.ambient);
    if (this.voice && this.voice.fadeState === 'in') tickFade(this.voice);
    this.dlgFade = tickFade(this.dlgFade);
    this.dlgFadeOut = tickFade(this.dlgFadeOut);
    this.stkFade = tickFade(this.stkFade);
    this.stkFadeOut = tickFade(this.stkFadeOut);
  }

  /** Returns true if this engine still has fading-out audio that needs ticking. */
  hasPendingFades(): boolean {
    return !!(this.ambientOut || this.voiceOut || this.dlgFadeOut || this.stkFadeOut);
  }

  /** Manage dialogue clip for the given element index. */
  tickDialogue(currentIdx: number): void {
    const c = this.config;
    if (!c || c.voiceMode !== 'dialogue') return;

    if (currentIdx !== this.activeDialogueIdx) {
      // Fade out previous
      if (this.dlgFade && this.dlgFade.el) {
        this.dlgFadeOut = killAudio(this.dlgFadeOut);
        this.dlgFadeOut = fadeOut(this.dlgFade, DLG_FADE);
        this.dlgFade = null;
      }
      this.activeDialogueIdx = currentIdx;

      // Fade in new
      if (currentIdx >= 0 && c.dialogueClips) {
        const clip = c.dialogueClips[currentIdx];
        if (clip?.filename) {
          const url = this.audioUrls.get(clip.filename);
          if (url) {
            const a = new Audio(url);
            this.dlgFade = fadeIn(a, clip.volume || c.dialogueVolume, DLG_FADE);
          }
        }
      }
    }
  }

  /** Manage sticky clip for the given element index. */
  tickSticky(currentIdx: number): void {
    const c = this.config;
    if (!c || !c.stickyClips) return;

    if (currentIdx !== this.activeStickyIdx) {
      // Fade out previous
      if (this.stkFade && this.stkFade.el) {
        this.stkFadeOut = killAudio(this.stkFadeOut);
        this.stkFadeOut = fadeOut(this.stkFade, DLG_FADE);
        this.stkFade = null;
      }
      this.activeStickyIdx = currentIdx;

      // Fade in new
      if (currentIdx >= 0) {
        const clip = c.stickyClips[currentIdx];
        if (clip?.filename) {
          const url = this.audioUrls.get(clip.filename);
          if (url) {
            const a = new Audio(url);
            this.stkFade = fadeIn(a, clip.volume || c.stickyVolume, DLG_FADE);
          }
        }
      }
    }
  }

  /** Kill all audio immediately (for unmount). */
  cleanup(): void {
    this.ambient = killAudio(this.ambient);
    this.ambientOut = killAudio(this.ambientOut);
    this.voice = killAudio(this.voice);
    this.voiceOut = killAudio(this.voiceOut);
    this.dlgFade = killAudio(this.dlgFade);
    this.dlgFadeOut = killAudio(this.dlgFadeOut);
    this.stkFade = killAudio(this.stkFade);
    this.stkFadeOut = killAudio(this.stkFadeOut);
    this.activeDialogueIdx = -1;
    this.activeStickyIdx = -1;
  }
}
