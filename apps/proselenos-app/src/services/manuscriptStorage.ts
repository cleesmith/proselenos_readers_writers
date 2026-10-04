// src/services/manuscriptStorage.ts

// Client-side only - IndexedDB for Authors mode (ProselenosLocal database)
//
// XHTML-Native Storage:
// - Single source of truth: XHTML files
// - meta.json contains section order + metadata
// - section-XXX.xhtml contains raw XHTML body content
// - Conversions happen only at editor boundaries

import { ElementType } from '@/app/authors/elementTypes';
import { plateToXhtml, xhtmlToPlainText } from '@/lib/plateXhtml';

export interface ManuscriptSettings {
  title: string;
  author: string;
  publisher: string;
  buyUrl: string;
  aboutAuthor: string;
}

export interface CoverSettings {
  bgColor: string;
  fontColor: string;
  bgImageDataUrl?: string;  // Optional background image as data URL
}

export interface AppSettings {
  darkMode: boolean;
  selectedModel?: string;
  hideAboutModal?: boolean;
}

const DB_NAME = 'ProselenosLocal';
const DB_VERSION = 1;

// Store names matching the plan
const STORES = {
  SETTINGS: 'settings',
  MANUSCRIPT: 'manuscript',
  AI: 'ai',
  PUBLISH: 'publish',
} as const;

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      // Create all stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.MANUSCRIPT)) {
        db.createObjectStore(STORES.MANUSCRIPT, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.AI)) {
        db.createObjectStore(STORES.AI, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.PUBLISH)) {
        db.createObjectStore(STORES.PUBLISH, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getValue<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);

      req.onsuccess = () => {
        if (req.result?.value !== undefined) {
          resolve(req.result.value as T);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function setValue<T>(storeName: string, key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put({ key, value });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================
// settings/ store
// ============================================

// App settings (settings.json)
export async function loadAppSettings(): Promise<AppSettings | null> {
  return getValue<AppSettings>(STORES.SETTINGS, 'settings.json');
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await setValue(STORES.SETTINGS, 'settings.json', settings);
}

// ============================================
// manuscript/ store
// ============================================

// Manuscript text (manuscript.txt)
export async function loadManuscript(): Promise<string | null> {
  return getValue<string>(STORES.MANUSCRIPT, 'manuscript.txt');
}

export async function saveManuscript(content: string): Promise<void> {
  await setValue(STORES.MANUSCRIPT, 'manuscript.txt', content);
}

// Manuscript metadata (metadata.json) - title, author, etc.
export async function loadSettings(): Promise<ManuscriptSettings | null> {
  return getValue<ManuscriptSettings>(STORES.MANUSCRIPT, 'metadata.json');
}

export async function saveSettings(settings: ManuscriptSettings): Promise<void> {
  await setValue(STORES.MANUSCRIPT, 'metadata.json', settings);
}

// Cover settings (cover_settings.json) - colors and optional background image
export async function loadCoverSettings(): Promise<CoverSettings | null> {
  return getValue<CoverSettings>(STORES.MANUSCRIPT, 'cover_settings.json');
}

export async function saveCoverSettings(settings: CoverSettings): Promise<void> {
  await setValue(STORES.MANUSCRIPT, 'cover_settings.json', settings);
}

// ============================================
// ai/ store
// ============================================

// report.txt (legacy file, still viewable in Files/Editor)
export async function loadReport(): Promise<string | null> {
  return getValue<string>(STORES.AI, 'report.txt');
}

// ============================================
// publish/ store
// ============================================

// EPUB (manuscript.epub)
export async function loadEpub(): Promise<ArrayBuffer | null> {
  return getValue<ArrayBuffer>(STORES.PUBLISH, 'manuscript.epub');
}

export async function saveEpub(content: ArrayBuffer): Promise<void> {
  await setValue(STORES.PUBLISH, 'manuscript.epub', content);
}

// DOCX (manuscript.docx)
export async function loadDocx(): Promise<ArrayBuffer | null> {
  return getValue<ArrayBuffer>(STORES.PUBLISH, 'manuscript.docx');
}

export async function saveDocx(content: ArrayBuffer): Promise<void> {
  await setValue(STORES.PUBLISH, 'manuscript.docx', content);
}

// ============================================
// Delete functions
// ============================================

async function deleteValue(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(key);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteManuscript(): Promise<void> {
  await deleteValue(STORES.MANUSCRIPT, 'manuscript.txt');
}

export async function deleteReport(): Promise<void> {
  await deleteValue(STORES.AI, 'report.txt');
}

export async function deleteEpub(): Promise<void> {
  await deleteValue(STORES.PUBLISH, 'manuscript.epub');
}

export async function deleteDocx(): Promise<void> {
  await deleteValue(STORES.PUBLISH, 'manuscript.docx');
}

// ============================================
// Chat files (stored in AI store)
// ============================================

export async function saveChatFile(filename: string, content: string): Promise<void> {
  await setValue(STORES.AI, filename, content);
}

export async function loadChatFile(filename: string): Promise<string | null> {
  return getValue<string>(STORES.AI, filename);
}

export async function deleteChatFile(filename: string): Promise<void> {
  await deleteValue(STORES.AI, filename);
}

// List all keys in a store (for dynamic file listing)
async function listStoreKeys(storeName: string): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

// ============================================
// List files
// ============================================

export interface FileInfo {
  key: string;       // e.g., 'manuscript.txt'
  name: string;      // Display name
  store: string;     // Which store it's in
  exists: boolean;
}

export async function listFiles(): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  // Check manuscript.txt
  const manuscript = await loadManuscript();
  files.push({
    key: 'manuscript.txt',
    name: 'manuscript.txt',
    store: STORES.MANUSCRIPT,
    exists: manuscript !== null
  });

  // Check ALL files in AI store (report.txt + chat_*.txt)
  const aiKeys = await listStoreKeys(STORES.AI);
  for (const key of aiKeys) {
    // Skip internal config files - not user files
    if (key === 'tool_prompts.json' || key === 'writing_assistant_prompts.json') continue;
    files.push({
      key,
      name: key,
      store: STORES.AI,
      exists: true
    });
  }

  // Check manuscript.epub
  const epub = await loadEpub();
  files.push({
    key: 'manuscript.epub',
    name: 'manuscript.epub',
    store: STORES.PUBLISH,
    exists: epub !== null
  });

  // Check manuscript.docx
  const docx = await loadDocx();
  files.push({
    key: 'manuscript.docx',
    name: 'manuscript.docx',
    store: STORES.PUBLISH,
    exists: docx !== null
  });

  return files;
}

// ============================================
// Working Copy (normalized epub structure)
// Auto-persisted scratchpad - not user-facing "save"
// Stores: meta + individual sections + cover image
// ============================================

export interface WorkingCopyMeta {
  // Core book identity (required for EPUB)
  title: string;
  author: string;
  language: string;

  // Optional metadata for EPUB
  subtitle?: string;
  publisher?: string;
  rights?: string;        // Copyright statement
  description?: string;   // Book blurb
  publicationDate?: string;
  isbn?: string;

  // Structure
  sectionIds: string[];
  coverImageId: string | null;
  imageIds?: string[];    // Inline image filenames (stored in images/{filename})

  // Library integration
  libraryBookHash?: string;  // Hash of book in e-reader library (for updates)
}

// NEW: XHTML-Native section - single source of truth
export interface WorkingCopySection {
  id: string;
  title: string;
  xhtml: string;        // XHTML body content (single source of truth)
  type: ElementType;
  sceneCraftConfig?: SceneCraftConfig;  // SceneCraft immersive scene config
}

// For backward compatibility during migration - OLD format
interface LegacyWorkingCopySection {
  id: string;
  title: string;
  content: string;           // Plain text (deprecated)
  plateValue?: any[];        // PlateJS Slate Value (deprecated)
  type: ElementType;
}

// NEW: ManuscriptMeta structure for meta.json
export interface ManuscriptMeta {
  title: string;
  author: string;
  language: string;
  subtitle?: string;
  publisher?: string;
  rights?: string;
  description?: string;
  publicationDate?: string;
  isbn?: string;
  coverImageId: string | null;
  imageIds?: string[];
  sections: SectionMeta[];
  libraryBookHash?: string;  // Hash of book in e-reader library (for updates)
  fountainTitlePage?: Record<string, string>;  // Original Fountain title page fields (Credit, Contact, etc.)
}

// SceneCraft immersive scene config — stored per-section as pure JSON refs
export interface SceneCraftConfig {
  // Wallpaper
  wallpaperFilename: string | null;  // ref to Image Library
  wallpaperOpacity: number;          // 0-1
  wallpaperPosition: string;         // "top" | "center" | "bottom"
  // Ambient audio
  ambientFilename: string | null;    // ref to Audio Library
  ambientVolume: number;             // 0-1
  ambientLoop: boolean;
  // Scene transitions
  fadeIn: number;                    // seconds
  fadeOut: number;                   // seconds
  // Dialogue clips
  dialogueClips: Record<number, {    // keyed by element idx
    filename: string;                // ref to Audio Library
    volume: number;
  }>;
  dialogueVolume: number;            // default volume for new clips
  // Sticky image clips
  stickyClips: Record<number, {     // keyed by element idx
    filename: string;               // ref to Audio Library
    volume: number;
  }>;
  stickyVolume: number;             // default volume for new clips
  // Para clips
  paraClips: Record<number, {      // keyed by element idx
    filename: string;              // ref to Audio Library
    volume: number;
  }>;
  paraVolume: number;              // default volume for new clips
}

// NEW: SectionMeta - metadata only, content is in separate .xhtml file
export interface SectionMeta {
  id: string;
  title: string;
  type: ElementType;
  sceneCraftConfig?: SceneCraftConfig;  // SceneCraft immersive scene config
}

// Meta functions
export async function loadWorkingCopyMeta(): Promise<WorkingCopyMeta | null> {
  return getValue<WorkingCopyMeta>(STORES.MANUSCRIPT, 'working_copy_meta.json');
}

export async function saveWorkingCopyMeta(meta: WorkingCopyMeta): Promise<void> {
  await setValue(STORES.MANUSCRIPT, 'working_copy_meta.json', meta);
}

/**
 * Infer section type from title for formatting support.
 * Only structural/metadata sections are non-chapters.
 * Note: 'cover' is no longer a section type - cover is handled via Menu > Cover
 */
function inferSectionType(title: string): ElementType {
  const lowerTitle = title.toLowerCase();

  // Only truly structural/metadata sections are non-chapters
  // Note: 'cover' removed - cover is handled via Menu > Cover, not as a section
  if (lowerTitle.includes('title page')) return 'title-page';
  if (lowerTitle.includes('copyright')) return 'copyright';
  if (lowerTitle.includes('table of contents') || lowerTitle === 'contents') return 'table-of-contents';
  if (lowerTitle.includes('about the author')) return 'about-the-author';
  if (lowerTitle.includes('also by')) return 'also-by';

  // Everything else is author-written content that should support formatting
  return 'chapter';
}

// ============================================
// NEW: XHTML-Native Storage Functions
// ============================================

/**
 * Save ManuscriptMeta (section order + book metadata)
 */
export async function saveManuscriptMeta(meta: ManuscriptMeta): Promise<void> {
  await setValue(STORES.MANUSCRIPT, 'meta.json', meta);
}

/**
 * Load ManuscriptMeta
 */
export async function loadManuscriptMeta(): Promise<ManuscriptMeta | null> {
  return getValue<ManuscriptMeta>(STORES.MANUSCRIPT, 'meta.json');
}

/**
 * Save section XHTML content
 */
export async function saveSectionXhtml(id: string, xhtml: string): Promise<void> {
  await setValue(STORES.MANUSCRIPT, `${id}.xhtml`, xhtml);
}

/**
 * Load section XHTML content
 */
export async function loadSectionXhtml(id: string): Promise<string | null> {
  return getValue<string>(STORES.MANUSCRIPT, `${id}.xhtml`);
}

/**
 * Delete section XHTML content
 */
export async function deleteSectionXhtml(id: string): Promise<void> {
  await deleteValue(STORES.MANUSCRIPT, `${id}.xhtml`);
}

/**
 * Get plain text from XHTML (for word count, search)
 */
export function getPlainTextFromXhtml(xhtml: string): string {
  return xhtmlToPlainText(xhtml);
}

// ============================================
// Legacy Section Functions (for backward compatibility)
// Will be migrated to XHTML-native on first access
// ============================================

// Section functions - now load from XHTML with migration
export async function loadSection(id: string): Promise<WorkingCopySection | null> {
  // Try new XHTML format first
  const xhtml = await loadSectionXhtml(id);
  if (xhtml !== null) {
    // Load metadata from meta.json
    const meta = await loadManuscriptMeta();
    const sectionMeta = meta?.sections.find(s => s.id === id);
    if (sectionMeta) {
      return {
        id,
        title: sectionMeta.title,
        xhtml,
        type: sectionMeta.type || inferSectionType(sectionMeta.title),

        sceneCraftConfig: sectionMeta.sceneCraftConfig,
      };
    }
  }

  // Fall back to old JSON format (migration path)
  const legacySection = await getValue<LegacyWorkingCopySection>(STORES.MANUSCRIPT, `${id}.json`);
  if (legacySection) {
    // Convert to new format
    let xhtmlContent: string;
    if (legacySection.plateValue && Array.isArray(legacySection.plateValue) && legacySection.plateValue.length > 0) {
      xhtmlContent = plateToXhtml(legacySection.plateValue);
    } else if (legacySection.content) {
      // Convert plain text to XHTML paragraphs
      xhtmlContent = legacySection.content
        .split(/\n\s*\n/)
        .filter(p => p.trim())
        .map(p => `<p>${escapeHtmlForStorage(p.replace(/\n/g, ' ').trim())}</p>`)
        .join('\n');
    } else {
      xhtmlContent = '<p></p>';
    }

    const section: WorkingCopySection = {
      id,
      title: legacySection.title,
      xhtml: xhtmlContent,
      type: legacySection.type || inferSectionType(legacySection.title),
    };

    return section;
  }

  return null;
}

// Helper to escape HTML for storage
function escapeHtmlForStorage(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Save section - saves to XHTML format and updates meta
export async function saveSection(section: WorkingCopySection): Promise<void> {
  // Save XHTML content
  await saveSectionXhtml(section.id, section.xhtml);

  // Update meta with section info
  let meta = await loadManuscriptMeta();
  if (meta) {
    const existingIdx = meta.sections.findIndex(s => s.id === section.id);
    const sectionMeta: SectionMeta = {
      id: section.id,
      title: section.title,
      type: section.type,
    };

    if (existingIdx >= 0) {
      // Preserve fields managed outside saveSection (e.g. sceneCraftConfig)
      const existing = meta.sections[existingIdx];
      meta.sections[existingIdx] = { ...existing, ...sectionMeta };
    } else {
      meta.sections.push(sectionMeta);
    }
    await saveManuscriptMeta(meta);
  }
}

export async function deleteSection(id: string): Promise<void> {
  // Delete XHTML file
  await deleteSectionXhtml(id);

  // Also delete legacy JSON if exists
  await deleteValue(STORES.MANUSCRIPT, `${id}.json`);

  // Update meta
  const meta = await loadManuscriptMeta();
  if (meta) {
    meta.sections = meta.sections.filter(s => s.id !== id);
    await saveManuscriptMeta(meta);
  }
}

// Cover image functions
export async function loadCoverImage(): Promise<Blob | null> {
  // Try new meta.json first
  const newMeta = await loadManuscriptMeta();
  if (newMeta?.coverImageId) {
    return getValue<Blob>(STORES.MANUSCRIPT, newMeta.coverImageId);
  }

  // Fall back to old format
  const oldMeta = await loadWorkingCopyMeta();
  if (!oldMeta?.coverImageId) return null;
  return getValue<Blob>(STORES.MANUSCRIPT, oldMeta.coverImageId);
}

export async function saveCoverImage(blob: Blob, filename: string): Promise<void> {
  await setValue(STORES.MANUSCRIPT, filename, blob);
}

export async function deleteCoverImage(): Promise<void> {
  // Try new meta.json first
  const newMeta = await loadManuscriptMeta();
  if (newMeta?.coverImageId) {
    await deleteValue(STORES.MANUSCRIPT, newMeta.coverImageId);
    return;
  }

  // Fall back to old format
  const oldMeta = await loadWorkingCopyMeta();
  if (oldMeta?.coverImageId) {
    await deleteValue(STORES.MANUSCRIPT, oldMeta.coverImageId);
  }
}

// ============================================
// Inline image functions (for images beyond cover)
// Storage key pattern: images/{filename}
// ============================================

/**
 * Save an inline image to IndexedDB
 */
export async function saveManuscriptImage(filename: string, blob: Blob): Promise<void> {
  await setValue(STORES.MANUSCRIPT, `images/${filename}`, blob);
}

/**
 * Get an inline image from IndexedDB
 */
export async function getManuscriptImage(filename: string): Promise<Blob | null> {
  return getValue<Blob>(STORES.MANUSCRIPT, `images/${filename}`);
}

/**
 * Delete an inline image from IndexedDB
 */
export async function deleteManuscriptImage(filename: string): Promise<void> {
  await deleteValue(STORES.MANUSCRIPT, `images/${filename}`);
}

/**
 * Get all inline images (for picker display)
 * Returns array of {filename, blob} for each stored image
 */
export async function getAllManuscriptImages(): Promise<Array<{filename: string, blob: Blob}>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MANUSCRIPT, 'readonly');
      const store = tx.objectStore(STORES.MANUSCRIPT);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = req.result || [];
        const images: Array<{filename: string, blob: Blob}> = [];

        for (const item of results) {
          // Check if this is an image (key starts with 'images/')
          if (item.key && typeof item.key === 'string' && item.key.startsWith('images/')) {
            const filename = item.key.replace('images/', '');
            if (item.value instanceof Blob) {
              images.push({ filename, blob: item.value });
            }
          }
        }

        resolve(images);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

// ============================================
// X-Ray entries (for ManuscriptXrayModal)
// ============================================

export interface ManuscriptXrayEntry {
  key: string;       // e.g. 'section-001.xhtml'
  title: string;     // from meta.json or fallback to key
  type: string;      // ElementType from meta
  content: string;   // raw XHTML string
  size: number;      // byte length
}

export async function loadManuscriptXrayEntries(): Promise<ManuscriptXrayEntry[]> {
  const meta = await loadManuscriptMeta();
  if (!meta || meta.sections.length === 0) return [];

  const entries: ManuscriptXrayEntry[] = [];
  for (const sectionMeta of meta.sections) {
    const xhtml = await loadSectionXhtml(sectionMeta.id);
    if (xhtml === null) continue;
    const key = `${sectionMeta.id}.xhtml`;
    entries.push({
      key,
      title: sectionMeta.title,
      type: sectionMeta.type || 'chapter',
      content: xhtml,
      size: new TextEncoder().encode(xhtml).length,
    });
  }
  return entries;
}

/**
 * Clear all inline images from IndexedDB
 * Called when creating a new manuscript
 */
export async function clearManuscriptImages(): Promise<void> {
  try {
    const db = await openDB();
    const keys = await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORES.MANUSCRIPT, 'readonly');
      const store = tx.objectStore(STORES.MANUSCRIPT);
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });

    // Delete all keys that start with 'images/'
    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith('images/')) {
        await deleteValue(STORES.MANUSCRIPT, key);
      }
    }
  } catch {
    // Ignore errors during cleanup
  }
}

// ============================================
// Audio files (for Visual Narrative)
// ============================================

/**
 * Save an audio file to IndexedDB
 */
export async function saveManuscriptAudio(filename: string, blob: Blob): Promise<void> {
  await setValue(STORES.MANUSCRIPT, `audio/${filename}`, blob);
}

/**
 * Get an audio file from IndexedDB
 */
export async function getManuscriptAudio(filename: string): Promise<Blob | null> {
  return getValue<Blob>(STORES.MANUSCRIPT, `audio/${filename}`);
}

/**
 * Delete an audio file from IndexedDB
 */
export async function deleteManuscriptAudio(filename: string): Promise<void> {
  await deleteValue(STORES.MANUSCRIPT, `audio/${filename}`);
}

/**
 * Get all audio files (for picker display)
 * Returns array of {filename, blob} for each stored audio file
 */
export async function getAllManuscriptAudios(): Promise<Array<{filename: string, blob: Blob}>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MANUSCRIPT, 'readonly');
      const store = tx.objectStore(STORES.MANUSCRIPT);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = req.result || [];
        const audios: Array<{filename: string, blob: Blob}> = [];

        for (const item of results) {
          if (item.key && typeof item.key === 'string' && item.key.startsWith('audio/')) {
            const filename = item.key.replace('audio/', '');
            if (item.value instanceof Blob) {
              audios.push({ filename, blob: item.value });
            }
          }
        }

        resolve(audios);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Clear all audio files from IndexedDB
 * Called when creating a new manuscript
 */
export async function clearManuscriptAudios(): Promise<void> {
  try {
    const db = await openDB();
    const keys = await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORES.MANUSCRIPT, 'readonly');
      const store = tx.objectStore(STORES.MANUSCRIPT);
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });

    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith('audio/')) {
        await deleteValue(STORES.MANUSCRIPT, key);
      }
    }
  } catch {
    // Ignore errors during cleanup
  }
}

// Full working copy functions (for convenience)
// NOW uses XHTML as single source of truth
export interface FullWorkingCopy {
  title: string;
  author: string;
  language: string;
  coverImage: Blob | null;
  sections: WorkingCopySection[];  // XHTML is the single source of truth
}

export async function loadFullWorkingCopy(): Promise<FullWorkingCopy | null> {
  // Try new meta.json format first
  const newMeta = await loadManuscriptMeta();
  if (newMeta) {
    // Load all sections in order
    const sections: WorkingCopySection[] = [];
    for (const sectionMeta of newMeta.sections) {
      const xhtml = await loadSectionXhtml(sectionMeta.id);
      if (xhtml !== null) {
        sections.push({
          id: sectionMeta.id,
          title: sectionMeta.title,
          xhtml,
          type: sectionMeta.type || inferSectionType(sectionMeta.title),
  
          sceneCraftConfig: sectionMeta.sceneCraftConfig,
        });
      }
    }

    // Load cover image
    let coverImage: Blob | null = null;
    if (newMeta.coverImageId) {
      coverImage = await getValue<Blob>(STORES.MANUSCRIPT, newMeta.coverImageId);
    }

    return {
      title: newMeta.title,
      author: newMeta.author,
      language: newMeta.language,
      coverImage,
      sections,
    };
  }

  // Fall back to old working_copy_meta.json format (migration path)
  const oldMeta = await loadWorkingCopyMeta();
  if (!oldMeta) return null;

  // Load all sections in order (will auto-migrate via loadSection)
  const sections: WorkingCopySection[] = [];
  for (const id of oldMeta.sectionIds) {
    const section = await loadSection(id);
    if (section) {
      sections.push(section);
    }
  }

  // Load cover image
  let coverImage: Blob | null = null;
  if (oldMeta.coverImageId) {
    coverImage = await getValue<Blob>(STORES.MANUSCRIPT, oldMeta.coverImageId);
  }

  return {
    title: oldMeta.title,
    author: oldMeta.author,
    language: oldMeta.language,
    coverImage,
    sections,
  };
}

/**
 * Save full working copy with normalization.
 * Normalizes section IDs to section-001, section-002, etc.
 * NOW saves as XHTML files (single source of truth)
 *
 * Accepts both old format (content/plateValue) and new format (xhtml) for compatibility
 */
export async function saveFullWorkingCopy(epub: {
  title: string;
  author: string;
  language: string;
  coverImage: Blob | null;
  sections: Array<{
    id: string;
    title: string;
    // NEW: XHTML format
    xhtml?: string;
    // OLD: content/plateValue format (for backward compatibility during import)
    content?: string;
    plateValue?: any[];
    type?: ElementType;
    sceneCraftConfig?: SceneCraftConfig;
  }>;
}): Promise<void> {
  // Normalize section IDs and convert to XHTML
  const sectionMetas: SectionMeta[] = [];

  for (let i = 0; i < epub.sections.length; i++) {
    const section = epub.sections[i];
    if (!section) continue;

    const normalizedId = `section-${String(i + 1).padStart(3, '0')}`;
    const sectionType = section.type || 'section';

    // Determine XHTML content
    let xhtmlContent: string;
    if (section.xhtml) {
      // Already have XHTML (new format)
      xhtmlContent = section.xhtml;
    } else if (section.plateValue && Array.isArray(section.plateValue) && section.plateValue.length > 0) {
      // Convert from PlateJS JSON
      xhtmlContent = plateToXhtml(section.plateValue);
    } else if (section.content) {
      // Convert plain text to XHTML paragraphs
      xhtmlContent = section.content
        .split(/\n\s*\n/)
        .filter(p => p.trim())
        .map(p => `<p>${escapeHtmlForStorage(p.replace(/\n/g, ' ').trim())}</p>`)
        .join('\n');
      if (!xhtmlContent) xhtmlContent = '<p></p>';
    } else {
      xhtmlContent = '<p></p>';
    }

    // Save XHTML file
    await saveSectionXhtml(normalizedId, xhtmlContent);

    // Build section meta
    sectionMetas.push({
      id: normalizedId,
      title: section.title,
      type: sectionType as ElementType,
      sceneCraftConfig: section.sceneCraftConfig,
    });
  }

  // Save cover image if present
  let coverImageId: string | null = null;
  if (epub.coverImage) {
    const ext = epub.coverImage.type === 'image/png' ? 'png' : 'jpg';
    coverImageId = `cover.${ext}`;
    await saveCoverImage(epub.coverImage, coverImageId);
  }

  // Save new ManuscriptMeta
  const meta: ManuscriptMeta = {
    title: epub.title,
    author: epub.author,
    language: epub.language,
    coverImageId,
    sections: sectionMetas,
  };
  await saveManuscriptMeta(meta);

  // Also save old format meta for backward compatibility
  const oldMeta: WorkingCopyMeta = {
    title: epub.title,
    author: epub.author,
    language: epub.language,
    sectionIds: sectionMetas.map(s => s.id),
    coverImageId,
  };
  await saveWorkingCopyMeta(oldMeta);
}

/**
 * Clear all working copy data from IndexedDB
 */
export async function clearWorkingCopy(): Promise<void> {
  // Try new meta.json format first
  const newMeta = await loadManuscriptMeta();
  if (newMeta) {
    // Delete all sections (XHTML files)
    for (const section of newMeta.sections) {
      await deleteSectionXhtml(section.id);
      // Also delete legacy JSON if exists
      await deleteValue(STORES.MANUSCRIPT, `${section.id}.json`);
    }

    // Delete cover image
    if (newMeta.coverImageId) {
      await deleteValue(STORES.MANUSCRIPT, newMeta.coverImageId);
    }

    // Delete meta.json
    await deleteValue(STORES.MANUSCRIPT, 'meta.json');
  }

  // Also try old format for backward compatibility
  const oldMeta = await loadWorkingCopyMeta();
  if (oldMeta) {
    // Delete all sections
    for (const id of oldMeta.sectionIds) {
      await deleteSectionXhtml(id);
      await deleteValue(STORES.MANUSCRIPT, `${id}.json`);
    }

    // Delete cover image (if not already deleted)
    if (oldMeta.coverImageId) {
      await deleteValue(STORES.MANUSCRIPT, oldMeta.coverImageId);
    }

    // Delete old meta
    await deleteValue(STORES.MANUSCRIPT, 'working_copy_meta.json');
  }

  // Delete all inline images
  await clearManuscriptImages();

  // Delete all audio files
  await clearManuscriptAudios();
}
