// apps/proselenos-app/src/components/audiobook/audiobookService.ts

/**
 * Pure functions for:
 *   1. Analyzing an EPUB's audio structure and building an 
 *      M4B (from AudiobookBuilder.tsx)
 *   2. Parsing M4B files: MP4 box navigation, chapter/metadata extraction, 
 *      MP3 frame extraction (from m4b-player.html)
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import JSZip from 'jszip';

// ──────────────────────────────────────────────
// Types — EPUB analysis & M4B building
// ──────────────────────────────────────────────

export interface AudioClip {
  idx: number;
  filename: string;
  type: 'inline';
}

export interface AnalyzedSection {
  index: number;
  idref: string;
  title: string;
  clips: AudioClip[];
}

export interface ChapterEntry {
  title: string;
  startMs: number;
  endMs: number;
}

export interface AudiobookAnalysis {
  sections: AnalyzedSection[];
  allClipPaths: string[];
  totalSize: number;
  totalDurationMs: number;
  chapterEntries: ChapterEntry[];
  bookTitle: string;
  bookAuthor: string;
  coverData: Uint8Array | null;
  coverIsPng: boolean;
}

export interface BuildProgress {
  message: string;
  percent: number;
}

// ──────────────────────────────────────────────
// Types — M4B player / MP4 parser
// ──────────────────────────────────────────────

export interface Box {
  type: string;
  offset: number;
  size: number;
  headerSize: number;
  dataOffset: number;
  dataSize: number;
}

export interface PlayerChapter {
  title: string;
  start: number; // seconds
}

export interface M4BMetadata {
  title: string;
  artist: string;
  album: string;
  coverBlob: Blob | null;
}

// ──────────────────────────────────────────────
// EPUB Analysis
// ──────────────────────────────────────────────

/** Recursively collect audio filenames from any JSON structure. */
function collectAudioFilenames(obj: unknown): string[] {
  const result: string[] = [];
  if (typeof obj === 'string') {
    if (/\.(wav|mp3|ogg|m4a|aac|webm|mp4)$/i.test(obj)) result.push(obj);
  } else if (Array.isArray(obj)) {
    for (const item of obj) result.push(...collectAudioFilenames(item));
  } else if (obj && typeof obj === 'object') {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      result.push(...collectAudioFilenames(val));
    }
  }
  return result;
}

export async function analyzeEpub(zip: JSZip): Promise<AudiobookAnalysis> {
  // Step 1: Find content.opf
  const keys = Object.keys(zip.files);
  const opfPath = keys.find((k) => /content\.opf$/i.test(k));
  if (!opfPath) throw new Error('No content.opf found in EPUB');
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

  const opfXml = await zip.file(opfPath)!.async('string');
  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');

  // Build manifest map: id -> href
  const manifestMap: Record<string, string> = {};
  const manifestMediaTypes: Record<string, string> = {};
  const manifestItems = opfDoc.querySelectorAll('manifest > item');
  manifestItems.forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mt = item.getAttribute('media-type') || '';
    if (id && href) {
      manifestMap[id] = href;
      manifestMediaTypes[id] = mt;
    }
  });

  // Dublin Core metadata
  const dcTitle = opfDoc.querySelector('metadata > *|title');
  const dcCreator = opfDoc.querySelector('metadata > *|creator');
  const bookTitle = dcTitle?.textContent?.trim() || '';
  const bookAuthor = dcCreator?.textContent?.trim() || '';

  // Find cover image
  let coverHref = '';
  const metaCover = opfDoc.querySelector('metadata > meta[name="cover"]');
  if (metaCover) {
    const coverId = metaCover.getAttribute('content');
    if (coverId && manifestMap[coverId]) {
      coverHref = manifestMap[coverId];
    }
  }
  if (!coverHref) {
    manifestItems.forEach((item) => {
      if (!coverHref && (item.getAttribute('properties') || '').includes('cover-image')) {
        coverHref = item.getAttribute('href') || '';
      }
    });
  }
  if (!coverHref) {
    const guesses = [
      'cover.jpg',
      'cover.jpeg',
      'cover.png',
      'images/cover.jpg',
      'images/cover.jpeg',
      'images/cover.png',
    ];
    for (const g of guesses) {
      if (zip.file(opfDir + g)) {
        coverHref = g;
        break;
      }
    }
  }

  let coverData: Uint8Array | null = null;
  let coverIsPng = false;
  if (coverHref) {
    const coverFile = zip.file(opfDir + coverHref);
    if (coverFile) {
      coverData = await coverFile.async('uint8array');
      coverIsPng = /\.png$/i.test(coverHref);
    }
  }

  // Spine order
  const spineOrder: string[] = [];
  opfDoc.querySelectorAll('spine > itemref').forEach((si) => {
    const idref = si.getAttribute('idref');
    if (idref) spineOrder.push(idref);
  });

  // Step 2: Read meta.json (optional — provides additional audio references per section)
  const metaFile = zip.file(opfDir + 'meta.json');
  const metaSections: Array<{ id?: string; title?: string; [key: string]: unknown }> =
    metaFile ? (JSON.parse(await metaFile.async('string')).sections || []) : [];

  const sectionMap: Record<string, (typeof metaSections)[0]> = {};
  metaSections.forEach((sec) => { if (sec.id) sectionMap[sec.id] = sec; });

  // Step 3: Process each spine item
  const analyzed: AnalyzedSection[] = await Promise.all(
    spineOrder.map(async (idref, index) => {
      const href = manifestMap[idref];
      if (!href) return { index, idref, title: idref, clips: [] };

      const xhtmlFile = zip.file(opfDir + href);
      if (!xhtmlFile) return { index, idref, title: idref, clips: [] };

      const xhtml = await xhtmlFile.async('string');
      const clips: AudioClip[] = [];
      const sectionData = sectionMap[idref];

      // Title from xhtml
      const titleMatch = xhtml.match(/<title[^>]*>([^<]+)<\/title>/i);
      const sectionTitle = titleMatch?.[1]?.trim() || sectionData?.title || idref;

      // Source 1 (plays first): audio filenames from meta.json section config
      if (sectionData) {
        const metaFilenames = collectAudioFilenames(sectionData);
        for (const fn of metaFilenames) {
          if (zip.file(opfDir + 'audio/' + fn)) {
            clips.push({ idx: clips.length, filename: fn, type: 'inline' });
          }
        }
      }

      // Scan inline <audio><source> tags
      const xhtmlDoc = parser.parseFromString(xhtml, 'text/html');
      xhtmlDoc.querySelectorAll('audio source').forEach((el, i) => {
        const src = el.getAttribute('src');
        if (!src) return;
        const audioFilename = src.replace(/^(\.\/)?audio\//, '');
        if (clips.some((c) => c.filename === audioFilename)) return;
        clips.push({ idx: 9999 + i, filename: audioFilename, type: 'inline' });
      });

      // Deduplicate
      const seen = new Set<string>();
      const unique = clips.filter((c) => {
        if (seen.has(c.filename)) return false;
        seen.add(c.filename);
        return true;
      });

      return { index, idref, title: sectionTitle, clips: unique };
    }),
  );

  analyzed.sort((a, b) => a.index - b.index);
  const sectionsWithAudio = analyzed.filter((s) => s.clips.length > 0);

  // Collect all clip paths
  const allClipPaths: string[] = [];
  for (const sec of sectionsWithAudio) {
    for (const clip of sec.clips) {
      allClipPaths.push(opfDir + 'audio/' + clip.filename);
    }
  }

  // Calculate total size
  let totalSize = 0;
  for (const p of allClipPaths) {
    const f = zip.file(p);
    if (f && (f as any)._data?.uncompressedSize) {
      totalSize += (f as any)._data.uncompressedSize;
    }
  }

  // Decode durations using AudioContext
  const audioCtx = new AudioContext();
  const durationMap: Record<string, number> = {};

  await Promise.all(
    allClipPaths.map(async (clipPath) => {
      const zf = zip.file(clipPath);
      if (!zf) {
        durationMap[clipPath] = 0;
        return;
      }
      const buf = await zf.async('arraybuffer');
      try {
        const ab = await audioCtx.decodeAudioData(buf.slice(0));
        durationMap[clipPath] = Math.round(ab.duration * 1000);
      } catch {
        // Fallback: estimate from file size at 64kbps
        durationMap[clipPath] = Math.round((buf.byteLength * 8) / 64);
      }
    }),
  );
  await audioCtx.close();

  // Build chapter entries
  const sectionFileGroups = sectionsWithAudio.map((sec) => ({
    title: sec.title,
    files: sec.clips.map((c) => opfDir + 'audio/' + c.filename),
  }));

  let cumulativeMs = 0;
  const chapterEntries: ChapterEntry[] = [];
  for (const group of sectionFileGroups) {
    const startMs = cumulativeMs;
    for (const f of group.files) cumulativeMs += durationMap[f] || 0;
    chapterEntries.push({ title: group.title, startMs, endMs: cumulativeMs });
  }

  return {
    sections: sectionsWithAudio,
    allClipPaths,
    totalSize,
    totalDurationMs: cumulativeMs,
    chapterEntries,
    bookTitle: bookTitle || 'Audiobook',
    bookAuthor,
    coverData,
    coverIsPng,
  };
}

// ──────────────────────────────────────────────
// M4B Builder using ffmpeg.wasm
// ──────────────────────────────────────────────

export async function buildM4B(
  zip: JSZip,
  analysis: AudiobookAnalysis,
  onProgress: (p: BuildProgress) => void,
): Promise<Uint8Array> {
  onProgress({ message: 'Loading ffmpeg...', percent: 5 });

  const ffmpeg = new FFmpeg();

  // Load single-thread core from local files (no SharedArrayBuffer, no COOP/COEP)
  await ffmpeg.load({
    coreURL: '/ffmpeg/ffmpeg-core.js',
    wasmURL: '/ffmpeg/ffmpeg-core.wasm',
  });

  onProgress({ message: 'Writing audio files...', percent: 15 });

  // Write each audio clip to ffmpeg virtual FS
  const concatLines: string[] = [];
  for (let i = 0; i < analysis.allClipPaths.length; i++) {
    const clipPath = analysis.allClipPaths[i]!;
    const zf = zip.file(clipPath);
    if (!zf) continue;
    const data = await zf.async('uint8array');
    const vfsName = `clip_${String(i).padStart(4, '0')}.mp3`;
    await ffmpeg.writeFile(vfsName, data);
    concatLines.push(`file '${vfsName}'`);

    // Update progress for large file counts
    if (i % 20 === 0) {
      const pct = 15 + Math.round((i / analysis.allClipPaths.length) * 25);
      onProgress({
        message: `Writing audio ${i + 1}/${analysis.allClipPaths.length}...`,
        percent: pct,
      });
    }
  }

  if (concatLines.length === 0) {
    ffmpeg.terminate();
    throw new Error('No audio clips found in this EPUB — nothing to build');
  }

  onProgress({ message: 'Building chapter metadata...', percent: 45 });

  // Write concat list
  const concatTxt = concatLines.join('\n');
  await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatTxt));

  // Write ffmetadata with chapters
  let metaTxt = ';FFMETADATA1\n';
  metaTxt += `title=${analysis.bookTitle}\n`;
  if (analysis.bookAuthor) metaTxt += `artist=${analysis.bookAuthor}\n`;
  metaTxt += `genre=Audiobook\n`;
  metaTxt += '\n';

  for (const ch of analysis.chapterEntries) {
    metaTxt += '[CHAPTER]\n';
    metaTxt += 'TIMEBASE=1/1000\n';
    metaTxt += `START=${ch.startMs}\n`;
    metaTxt += `END=${ch.endMs}\n`;
    metaTxt += `title=${ch.title}\n`;
    metaTxt += '\n';
  }

  await ffmpeg.writeFile('meta.txt', new TextEncoder().encode(metaTxt));

  // Write cover image if present
  if (analysis.coverData) {
    const coverExt = analysis.coverIsPng ? 'png' : 'jpg';
    await ffmpeg.writeFile(`cover.${coverExt}`, analysis.coverData);
  }

  onProgress({ message: 'Building M4B...', percent: 55 });

  // Build ffmpeg command
  const args: string[] = [
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    'concat.txt',
    '-f',
    'ffmetadata',
    '-i',
    'meta.txt',
  ];

  if (analysis.coverData) {
    const coverExt = analysis.coverIsPng ? 'png' : 'jpg';
    args.push('-i', `cover.${coverExt}`);
    args.push(
      '-map',
      '0:a',
      '-map',
      '2:v',
      '-map_metadata',
      '1',
      '-c:a',
      'copy',
      '-c:v',
      'copy',
      '-disposition:v:0',
      'attached_pic',
    );
  } else {
    args.push('-map', '0:a', '-map_metadata', '1', '-c:a', 'copy');
  }

  args.push('-f', 'mp4', 'output.m4b');

  // Collect ffmpeg log output so we can surface real errors
  const logs: string[] = [];
  ffmpeg.on('log', ({ message }: { message: string }) => {
    console.warn('[ffmpeg]', message);
    logs.push(message);
  });

  // Run ffmpeg
  ffmpeg.on('progress', ({ progress }) => {
    const pct = 55 + Math.round(progress * 40);
    onProgress({ message: 'Encoding M4B...', percent: Math.min(pct, 95) });
  });

  const exitCode = await ffmpeg.exec(args);
  if (exitCode !== 0) {
    ffmpeg.terminate();
    const detail = logs.slice(-10).join('\n');
    throw new Error(`ffmpeg failed (exit ${exitCode}):\n${detail}`);
  }

  onProgress({ message: 'Reading output...', percent: 96 });

  // Read result
  const result = await ffmpeg.readFile('output.m4b');
  if (!(result instanceof Uint8Array) || result.length === 0) {
    throw new Error('ffmpeg produced no output — check audio files are valid MP3');
  }

  // Cleanup
  ffmpeg.terminate();

  onProgress({ message: 'Done!', percent: 100 });
  return result;
}

// ──────────────────────────────────────────────
// Helpers — EPUB / build
// ──────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function msToHMS(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ──────────────────────────────────────────────
// MP4 Box Parser (from m4b-player.html)
// ──────────────────────────────────────────────

export function findBoxes(buffer: ArrayBuffer, path: string): Box[] {
  const view = new DataView(buffer);
  const parts = path.split('.');
  const results: Box[] = [];

  function search(partIndex: number, start: number, end: number) {
    let offset = start;
    while (offset + 8 <= end) {
      let size = view.getUint32(offset);
      if (size < 8 || offset + size > end) break;
      const type = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7),
      );
      let headerSize = 8;
      if (size === 1 && offset + 16 <= end) {
        size = view.getUint32(offset + 8) * 4294967296 + view.getUint32(offset + 12);
        headerSize = 16;
      }
      if (size < headerSize || offset + size > end) break;
      if (type === parts[partIndex]) {
        if (partIndex === parts.length - 1) {
          results.push({
            type,
            offset,
            size,
            headerSize,
            dataOffset: offset + headerSize,
            dataSize: size - headerSize,
          });
        } else {
          // 'meta' is a full box: 4 extra bytes (version+flags) before children
          let childStart = offset + headerSize;
          if (type === 'meta') childStart += 4;
          search(partIndex + 1, childStart, offset + size);
        }
      }
      offset += size;
    }
  }

  search(0, 0, buffer.byteLength);
  return results;
}

// ── Internal chapter parsers ──

function extractChaptersFromChpl(buffer: ArrayBuffer, box: Box): PlayerChapter[] {
  const view = new DataView(buffer);
  const chs: PlayerChapter[] = [];
  let offset = box.dataOffset;
  const version = view.getUint8(offset);
  offset += 4; // skip version + flags
  if (version > 0) {
    offset += 4; // version 1+ has a 4-byte unknown/reserved field
  }
  const count = view.getUint8(offset);
  offset++;
  for (let i = 0; i < count && offset + 9 <= box.dataOffset + box.dataSize; i++) {
    const tsHigh = view.getUint32(offset);
    const tsLow = view.getUint32(offset + 4);
    const timestamp = (tsHigh * 4294967296 + tsLow) / 10000000;
    offset += 8;
    const titleLen = view.getUint8(offset);
    offset++;
    let title = '';
    for (let j = 0; j < titleLen && offset + j < buffer.byteLength; j++) {
      title += String.fromCharCode(view.getUint8(offset + j));
    }
    offset += titleLen;
    chs.push({ title: title || 'Chapter ' + (i + 1), start: timestamp });
  }
  return chs;
}

function extractChaptersFromTrak(buffer: ArrayBuffer): PlayerChapter[] {
  const view = new DataView(buffer);
  const traks = findBoxes(buffer, 'moov.trak');
  for (let t = 0; t < traks.length; t++) {
    const trak = traks[t]!;
    const hdlrs = findBoxes(buffer, 'moov.trak.mdia.hdlr').filter(
      (b) => b.offset > trak.offset && b.offset < trak.offset + trak.size,
    );
    if (!hdlrs.length) continue;
    const h = hdlrs[0]!;
    if (h.dataSize < 12) continue;
    const ht = String.fromCharCode(
      view.getUint8(h.dataOffset + 8),
      view.getUint8(h.dataOffset + 9),
      view.getUint8(h.dataOffset + 10),
      view.getUint8(h.dataOffset + 11),
    );
    if (ht !== 'text' && ht !== 'sbtl') continue;

    const filterInTrak = (arr: Box[]) =>
      arr.filter((b) => b.offset > trak.offset && b.offset < trak.offset + trak.size);
    const stts = filterInTrak(findBoxes(buffer, 'moov.trak.mdia.minf.stbl.stts'));
    const stco = filterInTrak(findBoxes(buffer, 'moov.trak.mdia.minf.stbl.stco'));
    const stsz = filterInTrak(findBoxes(buffer, 'moov.trak.mdia.minf.stbl.stsz'));
    const mdhd = filterInTrak(findBoxes(buffer, 'moov.trak.mdia.mdhd'));
    if (!stts.length || !stco.length || !stsz.length) continue;

    let timescale = 1000;
    if (mdhd.length) {
      const md = mdhd[0]!;
      const ver = view.getUint8(md.dataOffset);
      timescale = ver === 0 ? view.getUint32(md.dataOffset + 12) : view.getUint32(md.dataOffset + 20);
    }

    let sttsOff = stts[0]!.dataOffset + 4;
    const sttsCount = view.getUint32(sttsOff);
    sttsOff += 4;
    const durations: number[] = [];
    for (let i = 0; i < sttsCount; i++) {
      const sc = view.getUint32(sttsOff);
      const sd = view.getUint32(sttsOff + 4);
      sttsOff += 8;
      for (let j = 0; j < sc; j++) durations.push(sd);
    }

    let stcoOff = stco[0]!.dataOffset + 4;
    const stcoCount = view.getUint32(stcoOff);
    stcoOff += 4;
    const offsets: number[] = [];
    for (let i = 0; i < stcoCount; i++) {
      offsets.push(view.getUint32(stcoOff));
      stcoOff += 4;
    }

    let stszOff = stsz[0]!.dataOffset + 4;
    const defSize = view.getUint32(stszOff);
    stszOff += 4;
    const stszCount = view.getUint32(stszOff);
    stszOff += 4;
    const sizes: number[] = [];
    for (let i = 0; i < stszCount; i++) sizes.push(defSize || view.getUint32(stszOff + i * 4));

    const chs: PlayerChapter[] = [];
    let curTime = 0;
    const cnt = Math.min(offsets.length, sizes.length, durations.length);
    for (let i = 0; i < cnt; i++) {
      const off = offsets[i]!;
      const sz = sizes[i]!;
      if (off + sz > buffer.byteLength) continue;
      const textLen = view.getUint16(off);
      let title = '';
      for (let j = 0; j < textLen && j < sz - 2; j++)
        title += String.fromCharCode(view.getUint8(off + 2 + j));
      chs.push({ title: title || 'Chapter ' + (i + 1), start: curTime / timescale });
      curTime += durations[i]!;
    }
    if (chs.length) return chs;
  }
  return [];
}

// ── Exported chapter & metadata extraction ──

export function extractChapters(buffer: ArrayBuffer): PlayerChapter[] {
  const chpl = findBoxes(buffer, 'moov.udta.chpl');
  if (chpl.length) {
    const c = extractChaptersFromChpl(buffer, chpl[0]!);
    if (c.length) return c;
  }
  return extractChaptersFromTrak(buffer);
}

export function extractMetadata(buffer: ArrayBuffer): M4BMetadata {
  const view = new DataView(buffer);
  const meta: M4BMetadata = { title: '', artist: '', album: '', coverBlob: null };
  const ilst = findBoxes(buffer, 'moov.udta.meta.ilst');
  if (!ilst.length) return meta;
  const box = ilst[0]!;
  let offset = box.dataOffset;
  const end = box.offset + box.size;
  while (offset + 8 < end) {
    const size = view.getUint32(offset);
    if (size < 8 || offset + size > end) break;
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7),
    );
    let inner = offset + 8;
    while (inner + 16 < offset + size) {
      const dSize = view.getUint32(inner);
      const dType = String.fromCharCode(
        view.getUint8(inner + 4),
        view.getUint8(inner + 5),
        view.getUint8(inner + 6),
        view.getUint8(inner + 7),
      );
      if (dType === 'data' && dSize > 16) {
        const dataType = view.getUint32(inner + 8);
        const payload = inner + 16;
        const payloadSize = dSize - 16;
        if (dataType === 1 || dataType === 0) {
          // Text metadata
          if (type === '\xA9nam') {
            meta.title = new TextDecoder().decode(new Uint8Array(buffer, payload, payloadSize));
          } else if (type === '\xA9ART' || type === '\xA9art' || type === 'aART') {
            if (!meta.artist)
              meta.artist = new TextDecoder().decode(new Uint8Array(buffer, payload, payloadSize));
          } else if (type === '\xA9alb') {
            meta.album = new TextDecoder().decode(new Uint8Array(buffer, payload, payloadSize));
          }
        }
        // Cover art: check by atom type 'covr' or by data type 13(jpeg)/14(png)
        if (type === 'covr' || dataType === 13 || dataType === 14) {
          if (payloadSize > 100 && !meta.coverBlob) {
            const b0 = view.getUint8(payload);
            const b1 = view.getUint8(payload + 1);
            const imgType = b0 === 0x89 && b1 === 0x50 ? 'image/png' : 'image/jpeg';
            const imgBytes = new Uint8Array(buffer, payload, payloadSize);
            meta.coverBlob = new Blob([imgBytes], { type: imgType });
          }
        }
      }
      if (dSize < 8) break;
      inner += dSize;
    }
    offset += size;
  }
  return meta;
}

// ── Helpers — player ──

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  return m + ':' + String(s).padStart(2, '0');
}

export function getChapterIndex(chapters: PlayerChapter[], time: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (time >= chapters[i]!.start) return i;
  }
  return 0;
}

// ── MP3-in-M4B extraction ──

function readESDescriptorLen(
  view: DataView,
  off: number,
): { tag: number; length: number; offset: number } {
  const tag = view.getUint8(off);
  off++;
  let len = 0;
  for (let k = 0; k < 4; k++) {
    const b = view.getUint8(off);
    off++;
    len = (len << 7) | (b & 0x7f);
    if (!(b & 0x80)) break;
  }
  return { tag, length: len, offset: off };
}

export function extractMP3FromM4B(buffer: ArrayBuffer): Blob | null {
  const view = new DataView(buffer);
  const traks = findBoxes(buffer, 'moov.trak');

  for (let t = 0; t < traks.length; t++) {
    const trak = traks[t]!;
    const trakEnd = trak.offset + trak.size;

    // Find handler — look for 'soun' handler type
    const hdlrs = findBoxes(buffer, 'moov.trak.mdia.hdlr').filter(
      (b) => b.offset > trak.offset && b.offset < trakEnd,
    );
    if (!hdlrs.length) continue;
    const h = hdlrs[0]!;
    if (h.dataSize < 12) continue;
    const ht = String.fromCharCode(
      view.getUint8(h.dataOffset + 8),
      view.getUint8(h.dataOffset + 9),
      view.getUint8(h.dataOffset + 10),
      view.getUint8(h.dataOffset + 11),
    );
    if (ht !== 'soun') continue;

    // Found sound track — scan stsd for 'esds' box to check objectType
    const inTrak = (arr: Box[]) => arr.filter((b) => b.offset > trak.offset && b.offset < trakEnd);
    const stsdBoxes = inTrak(findBoxes(buffer, 'moov.trak.mdia.minf.stbl.stsd'));
    if (!stsdBoxes.length) continue;

    const stsd = stsdBoxes[0]!;
    let esdsOffset = -1;
    for (let i = stsd.dataOffset; i + 8 < stsd.offset + stsd.size; i++) {
      if (
        view.getUint8(i + 4) === 0x65 &&
        view.getUint8(i + 5) === 0x73 &&
        view.getUint8(i + 6) === 0x64 &&
        view.getUint8(i + 7) === 0x73
      ) {
        const boxSize = view.getUint32(i);
        if (boxSize >= 12 && i + boxSize <= stsd.offset + stsd.size) {
          esdsOffset = i + 8 + 4; // skip box header (8) + version+flags (4)
          break;
        }
      }
    }
    if (esdsOffset < 0) continue;

    // Parse ESDS: ES_Descriptor(0x03) -> DecoderConfigDescriptor(0x04) -> objectTypeIndication
    let objectType = -1;
    const desc = readESDescriptorLen(view, esdsOffset);
    if (desc.tag === 0x03) {
      let esOff = desc.offset;
      esOff += 2; // ES_ID
      const flags = view.getUint8(esOff);
      esOff++;
      if (flags & 0x80) esOff += 2;
      if (flags & 0x40) {
        esOff += 1 + view.getUint8(esOff);
      }
      if (flags & 0x20) esOff += 2;
      const decConfig = readESDescriptorLen(view, esOff);
      if (decConfig.tag === 0x04) {
        objectType = view.getUint8(decConfig.offset);
      }
    }

    if (objectType !== 0x6b) return null; // not MP3, use file as-is

    // MP3 detected — extract raw frames via stco/co64 + stsz + stsc
    const stcoBoxes = inTrak(findBoxes(buffer, 'moov.trak.mdia.minf.stbl.stco'));
    const co64Boxes = inTrak(findBoxes(buffer, 'moov.trak.mdia.minf.stbl.co64'));
    const stszBoxes = inTrak(findBoxes(buffer, 'moov.trak.mdia.minf.stbl.stsz'));
    const stscBoxes = inTrak(findBoxes(buffer, 'moov.trak.mdia.minf.stbl.stsc'));
    if ((!stcoBoxes.length && !co64Boxes.length) || !stszBoxes.length) return null;

    // Read chunk offsets (stco = 32-bit, co64 = 64-bit)
    const chunkOffsets: number[] = [];
    if (stcoBoxes.length) {
      let off = stcoBoxes[0]!.dataOffset + 4;
      const cnt = view.getUint32(off);
      off += 4;
      for (let i = 0; i < cnt; i++) {
        chunkOffsets.push(view.getUint32(off));
        off += 4;
      }
    } else {
      let off = co64Boxes[0]!.dataOffset + 4;
      const cnt = view.getUint32(off);
      off += 4;
      for (let i = 0; i < cnt; i++) {
        chunkOffsets.push(view.getUint32(off) * 4294967296 + view.getUint32(off + 4));
        off += 8;
      }
    }

    // Read sample sizes
    let stszOff = stszBoxes[0]!.dataOffset + 4;
    const defaultSize = view.getUint32(stszOff);
    stszOff += 4;
    const sampleCount = view.getUint32(stszOff);
    stszOff += 4;
    const sampleSizes: number[] = [];
    for (let i = 0; i < sampleCount; i++) {
      sampleSizes.push(defaultSize || view.getUint32(stszOff + i * 4));
    }

    // Read sample-to-chunk mapping
    const stscEntries: { firstChunk: number; samplesPerChunk: number }[] = [];
    if (stscBoxes.length) {
      let soff = stscBoxes[0]!.dataOffset + 4;
      const scnt = view.getUint32(soff);
      soff += 4;
      for (let i = 0; i < scnt; i++) {
        stscEntries.push({
          firstChunk: view.getUint32(soff),
          samplesPerChunk: view.getUint32(soff + 4),
        });
        soff += 12;
      }
    }
    if (!stscEntries.length) stscEntries.push({ firstChunk: 1, samplesPerChunk: 1 });

    // Calculate total size and extract MP3 bytes
    let totalSize = 0;
    for (let i = 0; i < sampleCount; i++) totalSize += sampleSizes[i]!;

    const mp3Data = new Uint8Array(totalSize);
    let writePos = 0;
    let sampleIdx = 0;

    for (let c = 0; c < chunkOffsets.length && sampleIdx < sampleCount; c++) {
      let samplesInChunk = stscEntries[0]!.samplesPerChunk;
      for (let e = stscEntries.length - 1; e >= 0; e--) {
        if (c + 1 >= stscEntries[e]!.firstChunk) {
          samplesInChunk = stscEntries[e]!.samplesPerChunk;
          break;
        }
      }
      let chunkPos = chunkOffsets[c]!;
      for (let s = 0; s < samplesInChunk && sampleIdx < sampleCount; s++) {
        const sz = sampleSizes[sampleIdx]!;
        if (chunkPos + sz <= buffer.byteLength) {
          mp3Data.set(new Uint8Array(buffer, chunkPos, sz), writePos);
          writePos += sz;
        }
        chunkPos += sz;
        sampleIdx++;
      }
    }

    return new Blob([mp3Data.subarray(0, writePos)], { type: 'audio/mpeg' });
  }

  return null; // no sound track found
}
