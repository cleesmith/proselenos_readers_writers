// app/reader/view/FullBookView.tsx
// Full-book scroll-driven immersive reader.
// Cloned from SingleChapterView.tsx — renders ALL sections as one continuous
// scroll with per-section SceneCraft support (wallpaper, ambient audio,
// narration, dialogue clips, playhead animation).
// Key diff from SingleChapterView: receives pre-resolved imageUrls/audioUrls Maps
// instead of getImageUrl/getAudioUrl callbacks, and loops over multiple sections.

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SceneCraftConfig } from '@/services/manuscriptStorage';
import Swal from 'sweetalert2';

// ============================================================
//  Types
// ============================================================

interface SceneCraftElement {
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
//  Props
// ============================================================

export interface FullBookViewProps {
  bookTitle: string;
  bookAuthor: string;
  sections: Array<{
    title: string;
    xhtml: string;
    sceneCraftConfig: SceneCraftConfig | null;
  }>;
  imageUrls: Map<string, string>;    // filename → blob URL
  audioUrls: Map<string, string>;    // filename → blob URL
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
        elements.push({ type: 'break', text: node.textContent?.trim() || '\u2022 \u2022 \u2022', idx: idx++ });
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

      // Recurse into container elements (div + HTML5 semantic wrappers)
      if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main' || tag === 'aside' || tag === 'nav' || tag === 'header' || tag === 'footer') {
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
//  Download helpers
// ============================================================

function escapeHtml(text: string): string {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;').replace(/`/g,'&#96;').replace(/\$/g,'&#36;');
}

async function blobUrlToDataUri(blobUrl: string): Promise<string> {
  const resp = await fetch(blobUrl);
  const blob = await resp.blob();
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return `data:${blob.type};base64,${btoa(binary)}`;
}

interface BuildFullBookHtmlParams {
  sections: Array<{
    title: string;
    elements: SceneCraftElement[];
    config: SceneCraftConfig | null;
  }>;
  bookTitle: string;
  bookAuthor: string;
  imageMap: Map<string, string>;
  audioMap: Map<string, string>;
  wallpaperUris: Map<number, string>;
  hasAnySceneCraft: boolean;
  isDark: boolean;
}

function buildFullBookHtml(p: BuildFullBookHtmlParams): string {
  const esc = escapeHtml;

  // Build content blocks for ALL sections and per-section JS config data
  let allBlocksHtml = '';
  const sectionsJsData: Array<{
    title: string;
    wallpaperUri: string;
    config: Record<string, unknown> | null;
    dialogueElements: Record<number, { type: string; speaker?: string }>;
  }> = [];

  // Title → section-index lookup for TOC links (mirrors React titleToSectionIndex)
  const titleToSectionMap = new Map<string, number>();
  for (let i = 0; i < p.sections.length; i++) {
    const t = p.sections[i]!.title.trim();
    if (t) titleToSectionMap.set(t, i);
  }

  for (let si = 0; si < p.sections.length; si++) {
    const section = p.sections[si]!;

    // Section enter marker
    allBlocksHtml += `<div class="section-enter" id="section-enter-${si}">${esc(section.title)}</div>\n`;

    // Content blocks for this section
    for (const el of section.elements) {
      const idx = el.idx;
      if (el.type === 'dialogue') {
        const spk = el.direction ? `${el.speaker} (${el.direction})` : (el.speaker || '');
        allBlocksHtml += `<div class="sc-pv-block dialogue-block" data-idx="${idx}" data-sec="${si}"><span class="speaker-label">${esc(spk || '')}</span>${esc(el.text)}</div>\n`;
      } else if (el.type === 'sticky') {
        const lines = el.text.split('\n').filter((l: string) => l.trim());
        const imgSrc = el.imgSrc ? (p.imageMap.get(el.imgSrc) || el.imgSrc) : '';
        let stickyInner = '';
        if (imgSrc) {
          stickyInner += `<div class="sticky-img-wrap" onclick="openLightbox('${imgSrc.replace(/'/g, "\\'")}')"><img src="${imgSrc}" alt="${esc(el.caption || 'Sticky image')}" class="sticky-img" />`;
          if (el.caption) stickyInner += `<p class="sticky-caption">${esc(el.caption)}</p>`;
          stickyInner += `</div>`;
        }
        stickyInner += `<div class="sticky-text-col">`;
        for (const line of lines) {
          stickyInner += `<div class="sc-pv-block" data-idx="${idx}" data-sec="${si}">${esc(line)}</div>\n`;
        }
        stickyInner += `</div>`;
        allBlocksHtml += `<div class="sticky-wrap" data-sticky-idx="${idx}" data-sec="${si}">${stickyInner}</div>\n`;
      } else if (el.type === 'emphasis') {
        allBlocksHtml += `<div class="sc-pv-block emphasis-block" data-idx="${idx}" data-sec="${si}">${esc(el.text)}</div>\n`;
      } else if (el.type === 'quote') {
        allBlocksHtml += `<div class="sc-pv-block quote-block" data-idx="${idx}" data-sec="${si}">${esc(el.text)}</div>\n`;
      } else if (el.type === 'internal') {
        allBlocksHtml += `<div class="sc-pv-block internal-block" data-idx="${idx}" data-sec="${si}">${esc(el.text)}</div>\n`;
      } else if (el.type === 'break') {
        allBlocksHtml += `<div class="sc-pv-block break-block" data-idx="${idx}" data-sec="${si}">${esc(el.text)}</div>\n`;
      } else if (el.type === 'figure') {
        const imgSrc = el.imgSrc ? (p.imageMap.get(el.imgSrc) || el.imgSrc) : '';
        if (imgSrc) {
          allBlocksHtml += `<div class="sc-pv-block figure-block" data-idx="${idx}" data-sec="${si}"><img src="${imgSrc}" alt="${esc(el.alt || el.text)}" class="figure-img" style="width:100%${el.width ? `;max-width:${el.width}` : ''}" onclick="openLightbox(this.src)" /><span class="figure-caption">${esc(el.alt || el.text)}</span></div>\n`;
        } else {
          allBlocksHtml += `<div class="sc-pv-block figure-block" data-idx="${idx}" data-sec="${si}"><span class="figure-missing">[${esc(el.alt || el.text)}]</span></div>\n`;
        }
      } else if (el.type === 'audio') {
        const fn = el.audioSrc?.replace(/^(\.\.\/)?audio\//, '') || '';
        const audioDataUri = fn ? (p.audioMap.get(fn) || '') : '';
        if (audioDataUri) {
          allBlocksHtml += `<div class="sc-pv-block audio-block-pv" data-idx="${idx}" data-sec="${si}"><audio controls preload="none" style="width:100%;max-width:400px"><source src="${audioDataUri}"></audio></div>\n`;
        } else {
          allBlocksHtml += `<div class="sc-pv-block audio-block-pv" data-idx="${idx}" data-sec="${si}"><span style="color:#5a554e;font-style:italic;font-size:0.8em">[audio: ${esc(fn || 'unknown')}]</span></div>\n`;
        }
      } else if (el.type === 'h1' || el.type === 'h2' || el.type === 'h3') {
        allBlocksHtml += `<div class="sc-pv-block heading-block ${el.type}-block" data-idx="${idx}" data-sec="${si}">${esc(el.text)}</div>\n`;
      } else if (el.type === 'divider') {
        allBlocksHtml += `<div class="sc-pv-block divider-block" data-idx="${idx}" data-sec="${si}"></div>\n`;
      } else if (el.type === 'linebreak') {
        allBlocksHtml += `<div class="sc-pv-block linebreak-block" data-idx="${idx}" data-sec="${si}"></div>\n`;
      } else if (el.type === 'para') {
        const tocTarget = titleToSectionMap.get(el.text.trim());
        if (tocTarget !== undefined) {
          allBlocksHtml += `<a class="sc-pv-block para-block toc-link" href="#section-enter-${tocTarget}" data-idx="${idx}" data-sec="${si}">${esc(el.text)}</a>\n`;
        } else {
          allBlocksHtml += `<div class="sc-pv-block para-block" data-idx="${idx}" data-sec="${si}">${esc(el.text)}</div>\n`;
        }
      }
    }

    // Section exit marker
    allBlocksHtml += `<div class="section-exit" id="section-exit-${si}">&mdash; silence &mdash;</div>\n`;

    // Build per-section JS config data
    const dialogueElements: Record<number, { type: string; speaker?: string }> = {};
    for (const el of section.elements) {
      if (el.type === 'dialogue') {
        dialogueElements[el.idx] = { type: 'dialogue', speaker: el.speaker };
      }
    }
    const c = section.config;
    sectionsJsData.push({
      title: section.title,
      wallpaperUri: p.wallpaperUris.get(si) || '',
      config: c ? {
        wallpaperOpacity: c.wallpaperOpacity,
        wallpaperPosition: c.wallpaperPosition,
        ambientFilename: c.ambientFilename,
        ambientVolume: c.ambientVolume,
        ambientLoop: c.ambientLoop,
        fadeIn: c.fadeIn,
        fadeOut: c.fadeOut,
        voiceMode: c.voiceMode,
        narrationFilename: c.narrationFilename,
        narrationVolume: c.narrationVolume,
        dialogueClips: c.dialogueClips,
        dialogueVolume: c.dialogueVolume,
        stickyClips: c.stickyClips,
        stickyVolume: c.stickyVolume,
        paraClips: c.paraClips,
        paraVolume: c.paraVolume,
      } : null,
      dialogueElements,
    });
  }

  const scToggleBtn = p.hasAnySceneCraft ? `<button id="sc-toggle" onclick="toggleScOrange()" title="Toggle SceneCraft visuals" style="background:none;border:none;cursor:pointer;padding:4px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:22px;height:22px;fill:#ff7844;opacity:1;transition:opacity 0.2s"><path d="M19 2H6c-1.2 0-2 .9-2 2v16c0 1.1.8 2 2 2h13c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h2v8l2.5-1.5L13 12V4h6v16z"/></svg></button>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.bookTitle)} - Full Book</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden}
body{font-family:Georgia,'EB Garamond',serif;font-size:clamp(1.1rem,2.2vw,1.35rem);line-height:2;transition:background 0.3s,color 0.3s}
#topbar{height:40px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:10;position:relative;transition:background 0.3s,border-color 0.3s}
#topbar .left{display:flex;align-items:center;gap:10px}
#topbar .meta{font-size:13px;letter-spacing:0.05em;transition:color 0.3s}
#topbar .meta .title{font-style:italic}
#playhead{position:fixed;left:0;right:0;top:33%;height:1px;background:rgba(255,120,68,0.15);z-index:10;pointer-events:none}
#playhead .dot{width:6px;height:6px;border-radius:50%;background:rgba(255,120,68,0.4);position:absolute;left:50%;top:-3px;transform:translateX(-50%)}
#scene-info{position:fixed;right:16px;top:calc(33% - 14px);font-size:9px;letter-spacing:0.12em;color:rgba(255,120,68,0.35);z-index:10;pointer-events:none}
#bg-wall{position:fixed;inset:0;background-size:cover;background-repeat:no-repeat;opacity:0;transition:opacity 1.5s ease;z-index:0;pointer-events:none}
#scroll-wrap{flex:1;overflow-y:auto;position:relative}
#content{padding:50vh 10vw}
.dead-zone-top{height:50vh;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2rem}
.silence{font-size:10px;letter-spacing:0.15em;font-style:italic;transition:color 0.3s}
.section-enter{text-align:center;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,120,68,0.25);margin-bottom:3em;padding-bottom:1em;transition:border-color 0.3s}
.section-exit{text-align:center;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;margin-top:3em;padding-top:1em;font-style:italic;transition:border-color 0.3s,color 0.3s}
.dead-zone-bottom{height:70vh}
.sc-pv-block{margin-bottom:1.6em;opacity:0;transform:translateY(16px);transition:opacity 0.8s ease,transform 0.8s ease;position:relative;z-index:2}
.sc-pv-block.sc-pv-vis{opacity:1!important;transform:translateY(0)!important}
.sc-pv-block.sc-pv-past{opacity:0.3!important}
.dialogue-block .speaker-label{font-family:'SF Mono','Fira Code',monospace;font-size:0.65em;letter-spacing:0.1em;text-transform:uppercase;display:block;margin-bottom:0.3em;transition:color 0.3s}
.sticky-wrap{display:flex;gap:1.5em;align-items:flex-start;min-height:300px;margin-bottom:1.6em;position:relative;z-index:2}
.sticky-img-wrap{position:sticky;top:33vh;width:40%;flex-shrink:0;cursor:zoom-in}
.sticky-img{width:100%;border-radius:4px;opacity:0.9;display:block}
.sticky-caption{font-size:0.75em;text-align:center;font-style:italic;opacity:0.6;margin:0.4em 0 0}
.sticky-text-col{flex:1;display:flex;flex-direction:column;gap:1em}
.emphasis-block{text-align:center;font-size:1.2em;letter-spacing:0.08em;font-style:italic;color:#e0c8b0}
.quote-block{border-left:2px solid rgba(200,192,180,0.3);padding-left:1.5em}
.internal-block{font-style:italic;padding-left:2em}
.break-block{text-align:center;letter-spacing:0.3em;color:#3a3530}
.toc-link{display:block;text-decoration:underline;text-underline-offset:3px;cursor:pointer;color:inherit}
.figure-img{width:100%;border-radius:4px;opacity:0.9;display:block;cursor:zoom-in}
.figure-caption{font-family:'SF Mono',monospace;font-size:0.55em;letter-spacing:0.06em;margin-top:0.4em;display:block;transition:color 0.3s}
.figure-missing{font-style:italic;font-size:0.8em;transition:color 0.3s}
.heading-block{font-weight:bold;font-family:Georgia,"Times New Roman",serif;transition:color 0.3s}
.h1-block{font-size:1.8em}
.h2-block{font-size:1.4em}
.h3-block{font-size:1.15em}
.divider-block{margin:1.6em 0;border-top:1px solid rgba(200,192,180,0.2)}
.linebreak-block{height:1.2em;margin:0}
#lightbox{position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.85);display:none;align-items:center;justify-content:center;cursor:zoom-out}
#lightbox img{max-width:90vw;max-height:90vh;border-radius:6px}
.theme-toggle-btn{background:none;border:none;font-size:18px;cursor:pointer;padding:4px}
</style>
</head>
<body>
<div id="app" style="position:fixed;inset:0;display:flex;flex-direction:column">
  <div id="topbar">
    <div class="left">
      <button class="theme-toggle-btn" id="theme-btn" onclick="toggleTheme()"></button>
      ${scToggleBtn}
    </div>
    <span class="meta">
      <span class="title">${esc(p.bookTitle || 'Untitled')}</span>${p.bookAuthor ? `  by ${esc(p.bookAuthor)}` : ''}
    </span>
    <div></div>
  </div>
  <div id="playhead"><div class="dot"></div></div>
  <div id="scene-info"></div>
  <div id="bg-wall"></div>
  <div id="scroll-wrap">
    <div id="content">
      <div class="dead-zone-top"><span class="silence">&mdash; silence &mdash;</span></div>
      ${allBlocksHtml}
      <div class="dead-zone-bottom"></div>
    </div>
  </div>
</div>
<div id="lightbox" onclick="closeLightbox()"><img id="lb-img" src="" alt="Enlarged" /></div>

<script>
// -- Config data --
var AUDIO_MAP = ${JSON.stringify(Object.fromEntries(p.audioMap))};
var SECTIONS = ${JSON.stringify(sectionsJsData)};
var HAS_SCENECRAFT = ${p.hasAnySceneCraft ? 'true' : 'false'};

// -- Themes --
var THEMES = {
  dark: { bg:'#060608', text:'#c8c0b4', muted:'#5a554e', topbarBg:'rgba(0,0,0,0.5)', topbarBorder:'rgba(255,255,255,0.06)', dialogueText:'#d4c090', speakerText:'#a08040', silence:'#2a2620', sceneBorder:'rgba(255,255,255,0.03)' },
  light: { bg:'#f5f5f0', text:'#3a3530', muted:'#7a756e', topbarBg:'rgba(0,0,0,0.05)', topbarBorder:'rgba(0,0,0,0.1)', dialogueText:'#5a4520', speakerText:'#8a6530', silence:'#bab5ae', sceneBorder:'rgba(0,0,0,0.05)' }
};
var isDark = ${p.isDark ? 'true' : 'false'};

function applyTheme() {
  var t = isDark ? THEMES.dark : THEMES.light;
  document.body.style.background = t.bg;
  document.body.style.color = t.text;
  var topbar = document.getElementById('topbar');
  topbar.style.background = t.topbarBg;
  topbar.style.borderBottom = '1px solid ' + t.topbarBorder;
  var meta = topbar.querySelector('.meta');
  if (meta) meta.style.color = t.muted;
  document.getElementById('theme-btn').textContent = isDark ? '\\u2600\\uFE0F' : '\\uD83C\\uDF19';
  document.querySelectorAll('.dialogue-block').forEach(function(b) { b.style.color = t.dialogueText; });
  document.querySelectorAll('.speaker-label').forEach(function(s) { s.style.color = t.speakerText; });
  document.querySelectorAll('.silence').forEach(function(s) { s.style.color = t.silence; });
  document.querySelectorAll('.section-enter').forEach(function(en) { en.style.borderBottom = '1px solid ' + t.sceneBorder; });
  document.querySelectorAll('.section-exit').forEach(function(ex) { ex.style.borderTop = '1px solid ' + t.sceneBorder; ex.style.color = scOrangeOn ? 'rgba(255,120,68,0.15)' : t.silence; });
  document.querySelectorAll('.figure-caption,.figure-missing').forEach(function(el) { el.style.color = t.muted; });
  document.querySelectorAll('.heading-block').forEach(function(el) { el.style.color = t.text; });
}

function toggleTheme() { isDark = !isDark; applyTheme(); }

// -- SceneCraft toggle --
var scOrangeOn = true;
function toggleScOrange() {
  scOrangeOn = !scOrangeOn;
  var ph = document.getElementById('playhead');
  var si = document.getElementById('scene-info');
  var sc = document.getElementById('sc-toggle');
  if (ph) ph.style.display = scOrangeOn ? '' : 'none';
  if (si) si.style.display = scOrangeOn ? '' : 'none';
  document.querySelectorAll('.section-enter').forEach(function(en) { en.style.display = scOrangeOn ? '' : 'none'; });
  if (sc) { var svg = sc.querySelector('svg'); if (svg) svg.style.opacity = scOrangeOn ? '1' : '0.35'; }
  var t = isDark ? THEMES.dark : THEMES.light;
  document.querySelectorAll('.section-exit').forEach(function(ex) { ex.style.color = scOrangeOn ? 'rgba(255,120,68,0.15)' : t.silence; });
}

// -- Lightbox --
function openLightbox(src) { var lb = document.getElementById('lightbox'); document.getElementById('lb-img').src = src; lb.style.display = 'flex'; }
function closeLightbox() { document.getElementById('lightbox').style.display = 'none'; }

// -- Fade engine --
var DLG_FADE = 0.5;
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function createFadeIn(url, vol, dur, loop) {
  var a = new Audio(url); a.loop = !!loop; a.volume = 0; a.play().catch(function(){});
  return { el: a, fadeState: 'in', startTime: Date.now(), duration: dur * 1000, targetVol: vol };
}
function createFadeOut(obj, dur) {
  if (!obj || !obj.el) return null;
  return { el: obj.el, fadeState: 'out', startTime: Date.now(), duration: dur * 1000, startVol: obj.el.volume };
}
function tickFade(obj) {
  if (!obj || !obj.el) return null;
  var t = obj.duration > 0 ? clamp((Date.now() - obj.startTime) / obj.duration, 0, 1) : 1;
  if (obj.fadeState === 'in') { obj.el.volume = t * (obj.targetVol || 1); if (t >= 1) obj.fadeState = 'playing'; }
  else if (obj.fadeState === 'out') { obj.el.volume = (1 - t) * (obj.startVol || 1); if (t >= 1) { obj.el.pause(); return null; } }
  return obj;
}
function killAudio(obj) { if (obj && obj.el) { obj.el.pause(); obj.el.src = ''; } return null; }

// -- Multi-section animation loop --
var ambient = null, ambientOut = null, voice = null, voiceOut = null;
var dlgObj = null, dlgOut = null, activeDlgIdx = -1;
var stkObj = null, stkOut = null, activeStkIdx = -1;
var paraObj = null, paraOut = null, activeParaIdx = -1;
var activeSectionIdx = -1;
var playheadY = window.innerHeight * 0.33;
window.addEventListener('resize', function() { playheadY = window.innerHeight * 0.33; });

var scrollEl = document.getElementById('scroll-wrap');
var contentEl = document.getElementById('content');
var blocks = contentEl.querySelectorAll('.sc-pv-block');
var infoEl = document.getElementById('scene-info');
var bgEl = document.getElementById('bg-wall');

// Cache section zone elements
var sectionZones = [];
for (var i = 0; i < SECTIONS.length; i++) {
  sectionZones.push({
    enterEl: document.getElementById('section-enter-' + i),
    exitEl: document.getElementById('section-exit-' + i)
  });
}

function doEnter(si) {
  if (activeSectionIdx === si) return;
  if (activeSectionIdx >= 0) doExitCurrent();
  activeSectionIdx = si;
  var sec = SECTIONS[si];
  if (!sec) return;
  if (infoEl) infoEl.textContent = sec.title;
  var c = sec.config;
  if (!c) return;
  if (sec.wallpaperUri && bgEl) {
    bgEl.style.backgroundImage = "url('" + sec.wallpaperUri + "')";
    bgEl.style.backgroundPosition = c.wallpaperPosition;
    bgEl.style.opacity = String(c.wallpaperOpacity);
  }
  ambientOut = killAudio(ambientOut);
  if (c.ambientFilename && AUDIO_MAP[c.ambientFilename]) {
    ambient = createFadeIn(AUDIO_MAP[c.ambientFilename], c.ambientVolume, c.fadeIn, c.ambientLoop);
  }
  voiceOut = killAudio(voiceOut);
  if (c.voiceMode === 'narration' && c.narrationFilename && AUDIO_MAP[c.narrationFilename]) {
    voice = createFadeIn(AUDIO_MAP[c.narrationFilename], c.narrationVolume, c.fadeIn, false);
  }
}

function doExitCurrent() {
  if (activeSectionIdx < 0) return;
  var sec = SECTIONS[activeSectionIdx];
  var c = sec ? sec.config : null;
  var fadeOutDur = c ? c.fadeOut : 3;
  if (infoEl) infoEl.textContent = '';
  if (bgEl) bgEl.style.opacity = '0';
  if (ambient) { ambientOut = createFadeOut(ambient, fadeOutDur); ambient = null; }
  if (voice) { voiceOut = createFadeOut(voice, fadeOutDur); voice = null; }
  dlgObj = killAudio(dlgObj);
  dlgOut = killAudio(dlgOut);
  activeDlgIdx = -1;
  stkObj = killAudio(stkObj);
  stkOut = killAudio(stkOut);
  activeStkIdx = -1;
  paraObj = killAudio(paraObj);
  paraOut = killAudio(paraOut);
  activeParaIdx = -1;
  activeSectionIdx = -1;
}

function tick() {
  ambientOut = tickFade(ambientOut);
  voiceOut = tickFade(voiceOut);
  if (ambient && ambient.fadeState === 'in') tickFade(ambient);
  if (voice && voice.fadeState === 'in') tickFade(voice);
  dlgObj = tickFade(dlgObj);
  dlgOut = tickFade(dlgOut);
  stkObj = tickFade(stkObj);
  stkOut = tickFade(stkOut);
  paraObj = tickFade(paraObj);
  paraOut = tickFade(paraOut);

  blocks.forEach(function(b) {
    var rect = b.getBoundingClientRect();
    if (rect.top < playheadY + 100) b.classList.add('sc-pv-vis'); else b.classList.remove('sc-pv-vis');
    var center = rect.top + rect.height / 2;
    if (center < playheadY - window.innerHeight * 0.3) b.classList.add('sc-pv-past'); else b.classList.remove('sc-pv-past');
  });

  var foundSection = -1;
  for (var si = 0; si < sectionZones.length; si++) {
    var zone = sectionZones[si];
    var enterBottom = zone.enterEl ? zone.enterEl.getBoundingClientRect().bottom : 0;
    var exitTop = zone.exitEl ? zone.exitEl.getBoundingClientRect().top : window.innerHeight;
    if (enterBottom <= playheadY && exitTop > playheadY) {
      foundSection = si;
      break;
    }
  }

  if (foundSection >= 0) {
    doEnter(foundSection);
  } else if (activeSectionIdx >= 0) {
    doExitCurrent();
  }

  if (activeSectionIdx >= 0) {
    var sec = SECTIONS[activeSectionIdx];
    var c = sec ? sec.config : null;
    if (c && c.voiceMode === 'dialogue') {
      var currentDlg = -1;
      blocks.forEach(function(b) {
        var r = b.getBoundingClientRect();
        var di = parseInt(b.dataset.idx || '-1', 10);
        var ds = parseInt(b.dataset.sec || '-1', 10);
        if (ds === activeSectionIdx && r.top < playheadY && r.bottom > playheadY && sec.dialogueElements[di]) currentDlg = di;
      });
      if (currentDlg !== activeDlgIdx) {
        if (dlgObj && dlgObj.el) { dlgOut = killAudio(dlgOut); dlgOut = createFadeOut(dlgObj, DLG_FADE); dlgObj = null; }
        activeDlgIdx = currentDlg;
        if (currentDlg >= 0 && c.dialogueClips && c.dialogueClips[currentDlg]) {
          var clip = c.dialogueClips[currentDlg];
          if (clip.filename && AUDIO_MAP[clip.filename]) {
            dlgObj = createFadeIn(AUDIO_MAP[clip.filename], clip.volume || c.dialogueVolume, DLG_FADE, false);
          }
        }
      }
    }
  }

  // Sticky audio (plays regardless of voiceMode)
  if (activeSectionIdx >= 0) {
    var secStk = SECTIONS[activeSectionIdx];
    var cStk = secStk ? secStk.config : null;
    if (cStk) {
      var currentStk = -1;
      var stickyWraps = contentEl.querySelectorAll('.sticky-wrap');
      stickyWraps.forEach(function(sw) {
        var r = sw.getBoundingClientRect();
        var si = parseInt(sw.dataset.stickyIdx || '-1', 10);
        var ds = parseInt(sw.dataset.sec || '-1', 10);
        if (ds === activeSectionIdx && r.top < playheadY && r.bottom > playheadY) currentStk = si;
      });
      if (currentStk !== activeStkIdx) {
        if (stkObj && stkObj.el) { stkOut = killAudio(stkOut); stkOut = createFadeOut(stkObj, DLG_FADE); stkObj = null; }
        activeStkIdx = currentStk;
        if (currentStk >= 0 && cStk.stickyClips && cStk.stickyClips[currentStk]) {
          var sClip = cStk.stickyClips[currentStk];
          if (sClip.filename && AUDIO_MAP[sClip.filename]) {
            stkObj = createFadeIn(AUDIO_MAP[sClip.filename], sClip.volume || cStk.stickyVolume, DLG_FADE, false);
          }
        }
      }
    }
  }

  // Para audio (plays regardless of voiceMode)
  if (activeSectionIdx >= 0) {
    var secPara = SECTIONS[activeSectionIdx];
    var cPara = secPara ? secPara.config : null;
    if (cPara) {
      var currentPara = -1;
      blocks.forEach(function(b) {
        var r = b.getBoundingClientRect();
        var pi = parseInt(b.dataset.idx || '-1', 10);
        var ps = parseInt(b.dataset.sec || '-1', 10);
        if (ps === activeSectionIdx && r.top < playheadY && r.bottom > playheadY && b.classList.contains('para-block')) currentPara = pi;
      });
      if (currentPara !== activeParaIdx) {
        if (paraObj && paraObj.el) { paraOut = killAudio(paraOut); paraOut = createFadeOut(paraObj, DLG_FADE); paraObj = null; }
        activeParaIdx = currentPara;
        if (currentPara >= 0 && cPara.paraClips && cPara.paraClips[currentPara]) {
          var pClip = cPara.paraClips[currentPara];
          if (pClip.filename && AUDIO_MAP[pClip.filename]) {
            paraObj = createFadeIn(AUDIO_MAP[pClip.filename], pClip.volume || cPara.paraVolume, DLG_FADE, false);
          }
        }
      }
    }
  }

  requestAnimationFrame(tick);
}

// -- Init --
scrollEl.scrollTop = 0;
applyTheme();
requestAnimationFrame(tick);
<\/script>
</body>
</html>`;
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

export default function FullBookView({
  bookTitle,
  bookAuthor,
  sections,
  imageUrls,
  audioUrls,
}: FullBookViewProps) {
  // ── Preview toggles ────────────────────────────────────────
  const [pvLight, setPvLight] = useState(false);          // false=dark, true=light
  const [showScOrange, setShowScOrange] = useState(true); // show SceneCraft orange visuals

  // ── Derived colors based on pvLight ────────────────────────
  const pvBg = pvLight ? '#f5f5f0' : '#060608';
  const pvText = pvLight ? '#3a3530' : '#c8c0b4';
  const pvMuted = pvLight ? '#7a756e' : '#5a554e';
  const pvTopbarBg = pvLight ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.5)';
  const pvTopbarBorder = pvLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.06)';

  // ── Parse all sections' XHTML into elements ────────────────
  const parsedSections = useMemo(
    () => sections.map(s => ({
      title: s.title,
      elements: parseSceneXhtml(s.xhtml),
      config: s.sceneCraftConfig
        ? { ...createDefaultConfig(), ...s.sceneCraftConfig }
        : null,
    })),
    [sections],
  );

  // Check if ANY section has SceneCraft config
  const hasAnySceneCraft = useMemo(
    () => parsedSections.some(ps => ps.config !== null),
    [parsedSections],
  );

  // ── Title → section-index lookup (for clickable TOC entries) ──
  const titleToSectionIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let si = 0; si < parsedSections.length; si++) {
      const t = parsedSections[si]!.title.trim();
      if (t) map.set(t, si);
    }
    return map;
  }, [parsedSections]);

  // ── Scroll to a section by index ──
  const scrollToSection = useCallback((sectionIndex: number) => {
    const el = document.getElementById(`section-enter-${sectionIndex}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Enlarged image lightbox
  const [enlargedImg, setEnlargedImg] = useState<string | null>(null);

  // ── Download state ────────────────────────────────────────
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    Swal.fire({
      title: 'Processing...',
      text: 'Preparing standalone HTML download...',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => { Swal.showLoading(); },
    });
    try {
      // Resolve inline images to data URIs
      const imageMap = new Map<string, string>();
      for (const section of parsedSections) {
        for (const el of section.elements) {
          if (el.imgSrc && !imageMap.has(el.imgSrc)) {
            const fn = el.imgSrc.replace(/^(\.\.\/)*images\//, '');
            const blobUrl = imageUrls.get(fn) || imageUrls.get(el.imgSrc);
            if (blobUrl) {
              try { imageMap.set(el.imgSrc, await blobUrlToDataUri(blobUrl)); } catch { /* skip */ }
            }
          }
        }
      }

      // Resolve wallpapers to data URIs
      const wallpaperUris = new Map<number, string>();
      for (let si = 0; si < parsedSections.length; si++) {
        const c = parsedSections[si]!.config;
        if (c?.wallpaperFilename) {
          const blobUrl = imageUrls.get(c.wallpaperFilename);
          if (blobUrl) {
            try { wallpaperUris.set(si, await blobUrlToDataUri(blobUrl)); } catch { /* skip */ }
          }
        }
      }

      // Resolve audio to data URIs
      const audioMap = new Map<string, string>();
      for (const section of parsedSections) {
        const c = section.config;
        if (!c) continue;
        const audioFiles: string[] = [];
        if (c.ambientFilename) audioFiles.push(c.ambientFilename);
        if (c.narrationFilename) audioFiles.push(c.narrationFilename);
        if (c.dialogueClips) {
          Object.values(c.dialogueClips).forEach(clip => {
            if (clip.filename) audioFiles.push(clip.filename);
          });
        }
        if (c.stickyClips) {
          Object.values(c.stickyClips).forEach(clip => {
            if (clip.filename) audioFiles.push(clip.filename);
          });
        }
        if (c.paraClips) {
          Object.values(c.paraClips).forEach(clip => {
            if (clip.filename) audioFiles.push(clip.filename);
          });
        }
        for (const fn of audioFiles) {
          if (!audioMap.has(fn)) {
            const blobUrl = audioUrls.get(fn);
            if (blobUrl) {
              try { audioMap.set(fn, await blobUrlToDataUri(blobUrl)); } catch { /* skip */ }
            }
          }
        }
      }

      // Also resolve inline audio-block audio from elements
      for (const section of parsedSections) {
        for (const el of section.elements) {
          if (el.type === 'audio' && el.audioSrc) {
            const fn = el.audioSrc.replace(/^(\.\.\/)?audio\//, '');
            if (fn && !audioMap.has(fn)) {
              const blobUrl = audioUrls.get(fn);
              if (blobUrl) {
                try { audioMap.set(fn, await blobUrlToDataUri(blobUrl)); } catch { /* skip */ }
              }
            }
          }
        }
      }

      const html = buildFullBookHtml({
        sections: parsedSections,
        bookTitle: bookTitle || 'Untitled',
        bookAuthor: bookAuthor || '',
        imageMap,
        audioMap,
        wallpaperUris,
        hasAnySceneCraft,
        isDark: !pvLight,
      });

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(bookTitle || 'book').replace(/[^a-zA-Z0-9_\- ]/g, '').trim()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      Swal.close();
      setDownloading(false);
    }
  }, [parsedSections, imageUrls, audioUrls, bookTitle, bookAuthor, hasAnySceneCraft, pvLight]);

  // Resolve inline image src (e.g. "images/photo.jpg") to blob URL
  const resolveImgSrc = useCallback((src: string | undefined): string | undefined => {
    if (!src) return src;
    const fn = src.replace(/^(\.\.\/)*images\//, '');
    return imageUrls.get(fn) || imageUrls.get(src) || src;
  }, [imageUrls]);

  // ── Preview refs (imperative audio) ───────────────────────
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
      stkFadeObj.current = killAudio(stkFadeObj.current);
      stkFadeOut.current = killAudio(stkFadeOut.current);
      paraFadeObj.current = killAudio(paraFadeObj.current);
      paraFadeOut.current = killAudio(paraFadeOut.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Multi-section animation loop ──────────────────────────
  useEffect(() => {
    const scrollEl = pvScrollRef.current;
    const contentEl = pvContentRef.current;
    if (!scrollEl || !contentEl) return;

    const timer = setTimeout(() => {
      scrollEl.scrollTop = 0;
      const playheadY = window.innerHeight * 0.33;
      const blocks = contentEl.querySelectorAll('.sc-pv-block');

      // Collect enter/exit DOM elements for each section
      const sectionZones: Array<{
        enterEl: HTMLElement | null;
        exitEl: HTMLElement | null;
        config: SceneCraftConfig | null;
        title: string;
        elements: SceneCraftElement[];
      }> = parsedSections.map((ps, si) => ({
        enterEl: document.getElementById(`section-enter-${si}`),
        exitEl: document.getElementById(`section-exit-${si}`),
        config: ps.config,
        title: ps.title,
        elements: ps.elements,
      }));

      let activeSectionIdx = -1;

      function doEnter(sectionIdx: number) {
        if (activeSectionIdx === sectionIdx) return;

        // Exit previous section if any
        if (activeSectionIdx >= 0) {
          doExitCurrent();
        }

        activeSectionIdx = sectionIdx;
        const zone = sectionZones[sectionIdx];
        if (!zone) return;

        const infoEl = document.getElementById('fbv-pv-info');
        const bgEl = document.getElementById('fbv-pv-bg');

        if (infoEl) infoEl.textContent = zone.title;

        const c = zone.config;
        if (!c) return; // No SceneCraft config — just show title

        // Wallpaper
        if (c.wallpaperFilename && bgEl) {
          const url = imageUrls.get(c.wallpaperFilename);
          if (url) {
            bgEl.style.backgroundImage = `url('${url}')`;
            bgEl.style.backgroundPosition = c.wallpaperPosition;
            bgEl.style.opacity = String(c.wallpaperOpacity);
          }
        }

        // Ambient audio
        pvAmbientOut.current = killAudio(pvAmbientOut.current);
        if (c.ambientFilename) {
          const url = audioUrls.get(c.ambientFilename);
          if (url) {
            const a = new Audio(url);
            a.loop = !!c.ambientLoop;
            pvAmbient.current = fadeIn(a, c.ambientVolume, c.fadeIn);
          }
        }

        // Narration voice
        pvVoiceOut.current = killAudio(pvVoiceOut.current);
        if (c.voiceMode === 'narration' && c.narrationFilename) {
          const url = audioUrls.get(c.narrationFilename);
          if (url) {
            const a = new Audio(url);
            pvVoice.current = fadeIn(a, c.narrationVolume, c.fadeIn);
          }
        }
      }

      function doExitCurrent() {
        if (activeSectionIdx < 0) return;
        const zone = sectionZones[activeSectionIdx];
        const c = zone?.config;
        const fadeOutDur = c?.fadeOut ?? 3;

        const infoEl = document.getElementById('fbv-pv-info');
        const bgEl = document.getElementById('fbv-pv-bg');

        if (infoEl) infoEl.textContent = '';
        if (bgEl) bgEl.style.opacity = '0';

        // Ambient fade out
        if (pvAmbient.current) { pvAmbientOut.current = fadeOut(pvAmbient.current, fadeOutDur); pvAmbient.current = null; }
        // Narration fade out
        if (pvVoice.current) { pvVoiceOut.current = fadeOut(pvVoice.current, fadeOutDur); pvVoice.current = null; }
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

        activeSectionIdx = -1;
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
        // Tick sticky/para fades
        stkFadeObj.current = tickFade(stkFadeObj.current);
        stkFadeOut.current = tickFade(stkFadeOut.current);
        paraFadeObj.current = tickFade(paraFadeObj.current);
        paraFadeOut.current = tickFade(paraFadeOut.current);

        // Block visibility — use top edge so tall blocks appear as soon as
        // their top crosses the playhead; keep center for "past" dimming
        blocks.forEach(b => {
          const rect = b.getBoundingClientRect();
          if (rect.top < playheadY + 100) b.classList.add('sc-pv-vis'); else b.classList.remove('sc-pv-vis');
          const center = rect.top + rect.height / 2;
          if (center < playheadY - window.innerHeight * 0.3) b.classList.add('sc-pv-past'); else b.classList.remove('sc-pv-past');
        });

        // Multi-section zone detection: find which section the playhead is inside
        let foundSection = -1;
        for (let si = 0; si < sectionZones.length; si++) {
          const zone = sectionZones[si]!;
          const enterBottom = zone.enterEl?.getBoundingClientRect().bottom ?? 0;
          const exitTop = zone.exitEl?.getBoundingClientRect().top ?? window.innerHeight;
          if (enterBottom <= playheadY && exitTop > playheadY) {
            foundSection = si;
            break;
          }
        }

        if (foundSection >= 0) {
          doEnter(foundSection);
        } else if (activeSectionIdx >= 0) {
          doExitCurrent();
        }

        // Per-dialogue voice (only if current section uses dialogue mode)
        if (activeSectionIdx >= 0) {
          const zone = sectionZones[activeSectionIdx];
          const c = zone?.config;
          if (c && c.voiceMode === 'dialogue') {
            let currentDialogueIdx = -1;
            blocks.forEach(b => {
              const r = b.getBoundingClientRect();
              const dataIdx = parseInt((b as HTMLElement).dataset.idx || '-1', 10);
              const dataSec = parseInt((b as HTMLElement).dataset.sec || '-1', 10);
              if (dataSec === activeSectionIdx && r.top < playheadY && r.bottom > playheadY) {
                const sectionElements = zone?.elements;
                if (sectionElements && sectionElements[dataIdx] && sectionElements[dataIdx]!.type === 'dialogue') {
                  currentDialogueIdx = dataIdx;
                }
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
              if (currentDialogueIdx >= 0 && c.dialogueClips) {
                const clip = c.dialogueClips[currentDialogueIdx];
                if (clip?.filename) {
                  const url = audioUrls.get(clip.filename);
                  if (url) {
                    const a = new Audio(url);
                    dlgFadeObj.current = fadeIn(a, clip.volume || c.dialogueVolume, DLG_FADE);
                  }
                }
              }
            }
          }
        }

        // Per-sticky-image audio (plays regardless of voiceMode)
        if (activeSectionIdx >= 0) {
          const zone = sectionZones[activeSectionIdx];
          const c = zone?.config;
          if (c) {
            let currentStickyIdx = -1;
            const stickyContainers = contentEl!.querySelectorAll('.sc-pv-sticky');
            stickyContainers.forEach((sc: Element) => {
              const r = sc.getBoundingClientRect();
              const dataIdx = parseInt((sc as HTMLElement).dataset.stickyIdx || '-1', 10);
              const dataSec = parseInt((sc as HTMLElement).dataset.sec || '-1', 10);
              if (dataSec === activeSectionIdx && r.top < playheadY && r.bottom > playheadY) {
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

              if (currentStickyIdx >= 0 && c.stickyClips) {
                const clip = c.stickyClips[currentStickyIdx];
                if (clip?.filename) {
                  const url = audioUrls.get(clip.filename);
                  if (url) {
                    const a = new Audio(url);
                    stkFadeObj.current = fadeIn(a, clip.volume || c.stickyVolume, DLG_FADE);
                  }
                }
              }
            }
          }
        }

        // Per-para audio (plays regardless of voiceMode)
        if (activeSectionIdx >= 0) {
          const zone = sectionZones[activeSectionIdx];
          const c = zone?.config;
          if (c) {
            let currentParaIdx = -1;
            blocks.forEach(b => {
              const r = b.getBoundingClientRect();
              const dataIdx = parseInt((b as HTMLElement).dataset.idx || '-1', 10);
              const dataSec = parseInt((b as HTMLElement).dataset.sec || '-1', 10);
              if (dataSec === activeSectionIdx && r.top < playheadY && r.bottom > playheadY) {
                const sectionElements = zone?.elements;
                if (sectionElements && sectionElements[dataIdx] && sectionElements[dataIdx]!.type === 'para') {
                  currentParaIdx = dataIdx;
                }
              }
            });

            if (currentParaIdx !== pvActivePara.current) {
              if (paraFadeObj.current && paraFadeObj.current.el) {
                paraFadeOut.current = killAudio(paraFadeOut.current);
                paraFadeOut.current = fadeOut(paraFadeObj.current, DLG_FADE);
                paraFadeObj.current = null;
              }
              pvActivePara.current = currentParaIdx;

              if (currentParaIdx >= 0 && c.paraClips) {
                const clip = c.paraClips[currentParaIdx];
                if (clip?.filename) {
                  const url = audioUrls.get(clip.filename);
                  if (url) {
                    const a = new Audio(url);
                    paraFadeObj.current = fadeIn(a, clip.volume || c.paraVolume, DLG_FADE);
                  }
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
  }, [parsedSections, imageUrls, audioUrls]);

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .sc-pv-block.sc-pv-vis { opacity: 1 !important; transform: translateY(0) !important; }
        .sc-pv-block.sc-pv-past { opacity: 0.3 !important; }
      `}} />

      <div style={{
        position: 'fixed', inset: 0, background: pvBg,
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
            {/* SceneCraft orange toggle — only shown when any section has config */}
            {hasAnySceneCraft && (
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
            {/* Download button */}
            <button onClick={handleDownload} disabled={downloading}
              title="Download as standalone HTML"
              style={{
                fontSize: '11px', cursor: downloading ? 'default' : 'pointer',
                padding: '4px 8px', letterSpacing: '0.05em', borderRadius: '4px',
                backgroundColor: downloading ? '#6c757d' : 'rgba(34,197,94,0.15)',
                border: `1px solid ${downloading ? '#6c757d' : 'rgba(34,197,94,0.3)'}`,
                color: downloading ? '#999' : '#22c55e',
              }}>
              {downloading ? 'Preparing...' : 'Download'}
            </button>
          </div>
          {/* Book metadata */}
          <span style={{ fontSize: '13px', color: pvMuted, letterSpacing: '0.05em' }}>
            <span style={{ fontStyle: 'italic' }}>{bookTitle || 'Untitled'}</span>
            {bookAuthor ? <span>{'  '}by {bookAuthor}</span> : null}
          </span>
          <div></div>
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
        <div id="fbv-pv-info" style={{
          position: 'fixed', right: '16px', top: 'calc(33% - 14px)', fontSize: '9px',
          letterSpacing: '0.12em', color: 'rgba(255,120,68,0.35)', zIndex: 10, pointerEvents: 'none',
          display: showScOrange ? undefined : 'none',
        }}></div>

        {/* Background wallpaper */}
        <div id="fbv-pv-bg" style={{
          position: 'fixed', inset: 0, backgroundSize: 'cover', backgroundRepeat: 'no-repeat',
          opacity: 0, transition: 'opacity 1.5s ease', zIndex: 0, pointerEvents: 'none',
        }}></div>

        {/* Scrollable content */}
        <div ref={pvScrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div ref={pvContentRef} style={{
            padding: '50vh 10vw',
            fontFamily: "Georgia, 'EB Garamond', serif",
            fontSize: 'clamp(1.1rem, 2.2vw, 1.35rem)', lineHeight: 2, color: pvText,
          }}>
            {/* Dead zone before */}
            <div style={{ height: '50vh', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '2rem' }}>
              <span style={{ fontSize: '10px', letterSpacing: '0.15em', color: pvLight ? '#bab5ae' : '#2a2620', fontStyle: 'italic' }}>{'\u2014'} silence {'\u2014'}</span>
            </div>

            {/* Render all sections */}
            {parsedSections.map((section, si) => (
              <div key={si}>
                {/* Section enter label */}
                <div id={`section-enter-${si}`} style={{
                  textAlign: 'center', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: 'rgba(255,120,68,0.25)',
                  marginBottom: showScOrange ? '3em' : 0,
                  paddingBottom: showScOrange ? '1em' : 0,
                  borderBottom: showScOrange ? `1px solid ${pvLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)'}` : 'none',
                  height: showScOrange ? undefined : 0,
                  overflow: showScOrange ? undefined : 'hidden',
                }}>
                  {section.title}
                </div>

                {/* Content blocks for this section — inline, exactly as SingleChapterView */}
                {section.elements.map((item, i) => {
                  if (item.type === 'dialogue') {
                    const spk = item.direction ? `${item.speaker} (${item.direction})` : item.speaker;
                    return (
                      <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
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
                      <div key={i} className="sc-pv-sticky" data-sticky-idx={item.idx} data-sec={si} style={{
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
                            <div key={li} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
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
                      <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
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
                      <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
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
                      <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
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
                      <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
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
                      <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
                        marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
                        transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                        textAlign: 'left',
                      }}>
                        {item.imgSrc ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions */}
                            <img src={resolveImgSrc(item.imgSrc)} alt={item.alt || item.text} style={{ width: '100%', ...(item.width ? { maxWidth: item.width } : {}), borderRadius: '4px', opacity: 0.9, display: 'block', cursor: 'zoom-in' }}
                              onClick={() => setEnlargedImg(resolveImgSrc(item.imgSrc!) || null)} />
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
                    const resolvedSrc = fn ? audioUrls.get(fn) : undefined;
                    return (
                      <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
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
                      <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
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
                      <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
                        margin: '1.6em 0', opacity: 0, transform: 'translateY(16px)',
                        transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                        borderTop: '1px solid rgba(200,192,180,0.2)',
                      }} />
                    );
                  }
                  if (item.type === 'linebreak') {
                    return (
                      <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
                        height: '1.2em', margin: 0, opacity: 0, transform: 'translateY(16px)',
                        transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                      }} />
                    );
                  }
                  if (item.type === 'para') {
                    const tocTarget = titleToSectionIndex.get(item.text.trim());
                    if (tocTarget !== undefined) {
                      return (
                        <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si}
                          onClick={() => scrollToSection(tocTarget)}
                          style={{
                            marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
                            transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                            cursor: 'pointer', textDecoration: 'underline', textDecorationColor: pvMuted,
                            textUnderlineOffset: '3px',
                          }}
                        >
                          {item.text}
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="sc-pv-block" data-idx={item.idx} data-sec={si} style={{
                        marginBottom: '1.6em', opacity: 0, transform: 'translateY(16px)',
                        transition: 'opacity 0.8s ease, transform 0.8s ease', position: 'relative', zIndex: 2,
                      }}>
                        {item.text}
                      </div>
                    );
                  }
                  return null;
                })}

                {/* Section exit */}
                <div id={`section-exit-${si}`} style={{
                  textAlign: 'center', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: showScOrange ? 'rgba(255,120,68,0.15)' : (pvLight ? '#bab5ae' : '#2a2620'),
                  marginTop: '3em', paddingTop: '1em',
                  borderTop: `1px solid ${pvLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)'}`, fontStyle: 'italic',
                }}>
                  {'\u2014'} silence {'\u2014'}
                </div>
              </div>
            ))}

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
