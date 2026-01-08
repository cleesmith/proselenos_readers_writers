// src/services/manuscriptStorage.ts
// Client-side only - IndexedDB for Authors mode (ProselenosLocal database)
// SEPARATE from E-Reader's Proselenosebooks database

import { ElementType } from '@/app/authors/elementTypes';

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
  selectedModel: string;
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

// API key (api_key.json)
export async function loadApiKey(): Promise<string | null> {
  return getValue<string>(STORES.SETTINGS, 'api_key.json');
}

export async function saveApiKey(apiKey: string): Promise<void> {
  await setValue(STORES.SETTINGS, 'api_key.json', apiKey);
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
// Workflow files (brainstorm.txt, outline.txt, world.txt)
// Stored in AI store (same as Chat files)
// ============================================

export async function saveWorkflowFile(filename: string, content: string): Promise<void> {
  await setValue(STORES.AI, filename, content);
}

export async function loadWorkflowFile(filename: string): Promise<string | null> {
  return getValue<string>(STORES.AI, filename);
}

export async function workflowFileExists(filename: string): Promise<boolean> {
  const content = await getValue<string>(STORES.AI, filename);
  return content !== null && content.length > 0;
}

export async function deleteWorkflowFile(filename: string): Promise<void> {
  await deleteValue(STORES.AI, filename);
}

// ============================================
// ai/ store
// ============================================

// AI report (report.txt) - ONE report, replaced by any AI tool
export async function loadReport(): Promise<string | null> {
  return getValue<string>(STORES.AI, 'report.txt');
}

export async function saveReport(content: string): Promise<void> {
  await setValue(STORES.AI, 'report.txt', content);
}

// ============================================
// Tool Prompts (tool_prompts.json)
// ============================================

export interface ToolPromptsData {
  originals: Record<string, string>;   // toolId -> content (from public/)
  customized: Record<string, string>;  // toolId -> content (user edits)
  categories: string[];                // ["AI Writing Tools", "Core Editing Tools", ...]
  toolOrder: string[];                 // tool IDs in manifest order
  toolScopes: Record<string, string>;  // toolId -> "chapter" | "all"
  initialized: boolean;
}

export interface ToolInfo {
  id: string;
  name: string;
  category: string;
  isCustomized: boolean;
}

// Load entire tool prompts data structure
export async function loadToolPromptsData(): Promise<ToolPromptsData | null> {
  return getValue<ToolPromptsData>(STORES.AI, 'tool_prompts.json');
}

// Save entire tool prompts data structure
export async function saveToolPromptsData(data: ToolPromptsData): Promise<void> {
  await setValue(STORES.AI, 'tool_prompts.json', data);
}

// Check if tool prompts are initialized
export async function isToolPromptsInitialized(): Promise<boolean> {
  const data = await loadToolPromptsData();
  return data?.initialized === true;
}

// Get single prompt (returns customized if exists, else original)
export async function getToolPrompt(toolId: string): Promise<string | null> {
  const data = await loadToolPromptsData();
  if (!data) return null;
  return data.customized[toolId] ?? data.originals[toolId] ?? null;
}

// Check if a prompt is customized
export async function isToolPromptCustomized(toolId: string): Promise<boolean> {
  const data = await loadToolPromptsData();
  if (!data) return false;
  return toolId in data.customized;
}

// Update single prompt (saves to customized)
export async function updateToolPrompt(toolId: string, content: string): Promise<void> {
  const data = await loadToolPromptsData();
  if (!data) return;
  data.customized[toolId] = content;
  await saveToolPromptsData(data);
}

// Reset prompt to original (removes from customized)
export async function resetToolPrompt(toolId: string): Promise<void> {
  const data = await loadToolPromptsData();
  if (!data) return;
  delete data.customized[toolId];
  await saveToolPromptsData(data);
}

// Get tool list for UI grouped by category
export async function listToolsByCategory(): Promise<{ category: string; tools: ToolInfo[] }[]> {
  const data = await loadToolPromptsData();
  if (!data) return [];

  const result: { category: string; tools: ToolInfo[] }[] = [];

  for (const category of data.categories) {
    const tools: ToolInfo[] = [];

    // Use toolOrder to preserve manifest order (Object.keys doesn't preserve order after IndexedDB)
    const toolIds = data.toolOrder || Object.keys(data.originals);
    for (const toolId of toolIds) {
      if (toolId.startsWith(category + '/')) {
        const name = toolId.split('/')[1] || toolId;
        tools.push({
          id: toolId,
          name: name.replace('.txt', ''),
          category,
          isCustomized: toolId in data.customized
        });
      }
    }

    if (tools.length > 0) {
      result.push({ category, tools });
    }
  }

  return result;
}

// Get flat list of all tools (for compatibility)
export async function listAllTools(): Promise<ToolInfo[]> {
  const grouped = await listToolsByCategory();
  return grouped.flatMap(g => g.tools);
}

// Get tool scope: "chapter" or "all"
export async function getToolScope(toolId: string): Promise<string> {
  const data = await loadToolPromptsData();
  if (!data?.toolScopes) return 'all';
  return data.toolScopes[toolId] || 'all';
}

// Front/back matter section titles to exclude from "full manuscript"
const EXCLUDED_SECTIONS = [
  'title page',
  'copyright',
  'dedication',
  'acknowledgments',
  'acknowledgements',
  'about the author',
  'also by',
  'books by',
  'contents',
  'table of contents',
];

/**
 * Check if a section title indicates front/back matter (should be excluded from manuscript).
 */
function isFrontBackMatter(title: string): boolean {
  const lower = title.toLowerCase().trim();
  return EXCLUDED_SECTIONS.some(exc => lower === exc || lower.startsWith(exc + ':'));
}

/**
 * Assemble chapters from working copy into manuscript text.
 * Excludes front/back matter (Title Page, Copyright, etc.).
 * Format: 2 blank lines before EVERY chapter (including first), 1 blank line between paragraphs.
 */
export async function assembleManuscriptFromWorkingCopy(): Promise<string> {
  const meta = await loadWorkingCopyMeta();
  if (!meta) return '';

  const parts: string[] = [];

  for (const id of meta.sectionIds) {
    const section = await loadSection(id);
    if (!section) continue;

    // Skip front/back matter
    if (isFrontBackMatter(section.title)) continue;

    // Add chapter with 2 blank lines before it
    // Format: \n\n + Title + \n\n + Content
    parts.push(`\n\n${section.title}\n\n${section.content}`);
  }

  // Join all parts and ensure it starts with the 2 blank lines
  return parts.join('');
}

// ============================================
// AI Writing Prompts (SEPARATE from general tool_prompts)
// ============================================

// Generic default prompts for AI Writing workflow
const WRITING_ASSISTANT_DEFAULTS: Record<string, string> = {
  brainstorm: `You are a skilled creative writing assistant specializing in brainstorming and character development. Your task is to take the provided story ideas and expand them into a rich foundation for fiction writing.

IMPORTANT: NO Markdown formatting of ANY kind. Use only plain text with standard punctuation.

Based on the ideas provided, create:

1. STORY CONCEPT EXPANSION:
   - Expand the core concept into a compelling story premise
   - Identify the central conflict or tension
   - Determine the story's genre and tone
   - Suggest the target audience and story length
   - Highlight what makes this story unique or compelling

2. MAIN CHARACTERS:
   - Create 3-5 main characters with distinct personalities
   - Give each character a clear motivation and goal
   - Describe their relationships and conflicts with each other
   - Include basic physical descriptions and backgrounds
   - Show how each character serves the story's central theme

3. SETTING AND WORLD:
   - Establish the time period and location
   - Describe the key locations where the story takes place
   - Create the rules and atmosphere of this world
   - Explain how the setting influences the characters and plot

4. PLOT FOUNDATIONS:
   - Identify the inciting incident that starts the story
   - Outline the main plot progression
   - Create 2-3 major plot points or turning moments
   - Suggest how the story might conclude
   - Include potential subplots that support the main story

5. THEMES AND DEEPER MEANING:
   - Identify the central themes the story explores
   - Explain what message or experience the story offers readers
   - Show how characters and plot serve these themes

Create a comprehensive brainstorm that provides enough detail to guide outline and world-building work, but leaves room for creative development. Focus on creating compelling characters and conflicts that will drive an engaging story.`,

  outline: `You are an expert fiction outline writer who creates detailed, compelling story structures. Your task is to take the provided brainstorm content and develop it into a comprehensive chapter-by-chapter outline.

IMPORTANT: NO Markdown formatting of ANY kind. Use only plain text with standard punctuation.

Create a detailed outline that includes:

1. STORY STRUCTURE:
   - Organize the story into clear acts or major sections
   - Identify key plot points and turning moments
   - Ensure proper pacing and story progression
   - Balance action, character development, and world-building

2. CHAPTER BREAKDOWN:
   Format each chapter as: "Chapter X: [Title]"
   For each chapter, provide:
   - A compelling chapter title that hints at the content
   - 2-3 paragraphs describing the key events
   - Character development and interactions
   - Plot advancement and conflicts
   - Setting and atmosphere details
   - How the chapter connects to the overall story arc

3. CHARACTER ARCS:
   - Show how each main character grows and changes
   - Include key character moments and revelations
   - Demonstrate character relationships and conflicts
   - Ensure each character serves the story's purpose

4. PACING AND TENSION:
   - Alternate between action and quieter character moments
   - Build tension toward climactic moments
   - Include cliffhangers and hooks to maintain reader engagement
   - Balance dialogue, action, and description

5. PLOT THREADS:
   - Weave together main plot and subplots
   - Plant and resolve story elements at appropriate times
   - Create satisfying character and story resolutions
   - Ensure all major questions are answered

Create an outline detailed enough that a writer could use it to write the full story, with clear chapter divisions and comprehensive scene descriptions.
Aim for 20 chapters depending on the story's scope and complexity.`,

  world: `You are a skilled novelist, world builder, and character developer helping to create a comprehensive world document in fluent, authentic English.

IMPORTANT: NO Markdown formatting of ANY kind. Use only plain text with standard punctuation.

Your task is to create a detailed world document for the story titled [TITLE].
This document should serve as a comprehensive reference for writing the manuscript.

Based on the provided outline and characters, create:

1. WORLD OVERVIEW:
   - Establish the time period, location, and general setting
   - Describe the overall atmosphere and mood of this world
   - Explain the genre conventions and world type
   - Detail what makes this world unique and interesting

2. PHYSICAL WORLD:
   - Describe key locations where the story takes place
   - Include geography, climate, and environmental details
   - Explain the layout and features of important places
   - Detail how locations connect to each other

3. SOCIETY AND CULTURE:
   - Describe the social structures and hierarchies
   - Explain cultural norms, customs, and traditions
   - Detail languages, dialects, and communication methods
   - Include information about education, arts, and entertainment

4. POLITICS AND GOVERNANCE:
   - Explain the government systems and political structures
   - Describe laws, justice systems, and authority figures
   - Detail conflicts between different groups or factions
   - Include information about alliances and enemies

5. ECONOMY AND DAILY LIFE:
   - Describe how people make a living and trade
   - Explain currency, commerce, and economic systems
   - Detail daily routines and lifestyle patterns
   - Include information about food, clothing, and shelter

6. HISTORY AND BACKGROUND:
   - Provide relevant historical context
   - Explain past events that shape the current world
   - Detail legends, myths, and important stories
   - Include information about how the world came to be as it is

7. CHARACTER INTEGRATION:
   - Show how each main character fits into this world
   - Show more personal information and emotions and internal thoughts
   - Explain their social status, background, and connections
   - Detail their knowledge and skills relevant to this world
   - Describe how the world shapes their motivations and conflicts
   - Include more details, so that each character can become an AI persona that is able to chat about itself
   - Really flush out each character, so we can know them as a individual person
   - Take your time and think deeply about each character as they are very important to the story

Create a comprehensive world document that provides all the background information needed to write authentic, consistent scenes.
The document should be detailed enough to answer questions about how this world works while supporting the story's plot and characters.

- Write in the appropriate POV for each of our main characters
- Include specific details that make the world feel real and lived-in
- Ensure consistency with the provided characters and outline
- Focus on elements that will be important to the story being told`,

  chapters: `You are an expert fiction writer specializing in compelling storytelling and character development. Your task is to write a complete chapter for the story based on the provided outline, world document, and existing manuscript.

IMPORTANT: NO Markdown formatting of ANY kind. Use only plain text with standard punctuation.

Write the chapter for: [CHAPTER_HEADING]

Based on the provided materials, create:

1. CHAPTER CONTENT:
   - Write a complete chapter that follows the outline specifications
   - Include compelling dialogue, action, and description
   - Maintain consistent character voices and personalities
   - Advance the plot according to the outline's requirements
   - Use your full vocabulary with appropriate language for the story
   - Do not start each chapter with someone waking up or the weather outside, that's boring, be more creative
   - Give more time and extra thought to Chapter 1 and the very first paragraph
   - IMPORTANT: Do not add any more new characters, do not use the words: echo or whisper in any form

2. WRITING STYLE:
   - Use vivid, engaging prose that draws readers into the story
   - More dialogue, both internal and external, and less descriptive passages, "show don't tell"
   - Maintain the tone and atmosphere established in existing chapters
   - Write in fluent, authentic [LANGUAGE]

3. CHARACTER DEVELOPMENT:
   - Show character growth and change through actions and dialogue
   - Reveal character motivations and internal conflicts
   - Create authentic interactions between characters
   - Ensure characters behave consistently with their established personalities

4. WORLD INTEGRATION:
   - Incorporate world-building details naturally into the narrative
   - Use setting and atmosphere to enhance the story
   - Include relevant cultural, social, or historical elements
   - Make the world feel real and lived-in through specific details

5. PLOT ADVANCEMENT:
   - Move the story forward according to the outline
   - Include the key events and developments specified
   - Build tension and maintain reader engagement
   - Set up future plot developments as needed

6. TECHNICAL REQUIREMENTS:
   - Start with the chapter heading: [CHAPTER_HEADING]
   - Write 3,000-4,000 words per chapter
   - Use proper scene breaks and transitions
   - End with a compelling hook or resolution that leads to the next chapter

7. CONTINUITY:
   - Maintain consistency with the existing manuscript
   - Reference previous events and character development appropriately
   - Ensure the chapter fits seamlessly into the overall story
   - Keep track of timeline and character locations

Write a complete, polished chapter that could be published as part of the final novel.
Focus on creating an engaging reading experience that advances the story while maintaining high literary quality.

Use the outline as your guide for plot events, the world document for setting and background details, and the existing manuscript to maintain consistency in style and continuity.`
};

export interface WritingAssistantPromptsData {
  prompts: Record<string, string>;
  initialized: boolean;
}

// Initialize AI Writing prompts with defaults (ALWAYS writes defaults to ensure latest version)
export async function initWritingAssistantPrompts(): Promise<void> {
  // Always write the defaults to ensure IndexedDB has the latest prompts
  const data: WritingAssistantPromptsData = {
    prompts: { ...WRITING_ASSISTANT_DEFAULTS },
    initialized: true
  };
  await setValue(STORES.AI, 'writing_assistant_prompts.json', data);
}

// Get a AI Writing prompt (returns user's version or default)
export async function getWritingAssistantPrompt(stepId: string): Promise<string> {
  const data = await getValue<WritingAssistantPromptsData>(STORES.AI, 'writing_assistant_prompts.json');
  if (data?.prompts[stepId]) {
    return data.prompts[stepId];
  }
  // Fallback to default if not found
  return WRITING_ASSISTANT_DEFAULTS[stepId] || '';
}

// Save a AI Writing prompt (user customization)
export async function saveWritingAssistantPrompt(stepId: string, content: string): Promise<void> {
  let data = await getValue<WritingAssistantPromptsData>(STORES.AI, 'writing_assistant_prompts.json');
  if (!data) {
    data = { prompts: { ...WRITING_ASSISTANT_DEFAULTS }, initialized: true };
  }
  data.prompts[stepId] = content;
  await setValue(STORES.AI, 'writing_assistant_prompts.json', data);
}

// Reset a AI Writing prompt to default
export async function resetWritingAssistantPrompt(stepId: string): Promise<void> {
  const data = await getValue<WritingAssistantPromptsData>(STORES.AI, 'writing_assistant_prompts.json');
  if (data && WRITING_ASSISTANT_DEFAULTS[stepId]) {
    data.prompts[stepId] = WRITING_ASSISTANT_DEFAULTS[stepId];
    await setValue(STORES.AI, 'writing_assistant_prompts.json', data);
  }
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

export interface WorkingCopySection {
  id: string;
  title: string;
  content: string;
  type: ElementType;
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
 */
function inferSectionType(title: string): ElementType {
  const lowerTitle = title.toLowerCase();

  // Only truly structural/metadata sections are non-chapters
  if (lowerTitle === 'cover') return 'cover';
  if (lowerTitle.includes('title page')) return 'title-page';
  if (lowerTitle.includes('copyright')) return 'copyright';
  if (lowerTitle.includes('table of contents') || lowerTitle === 'contents') return 'table-of-contents';
  if (lowerTitle.includes('about the author')) return 'about-the-author';
  if (lowerTitle.includes('also by')) return 'also-by';

  // Everything else is author-written content that should support formatting
  return 'chapter';
}

// Section functions
export async function loadSection(id: string): Promise<WorkingCopySection | null> {
  const section = await getValue<WorkingCopySection>(STORES.MANUSCRIPT, `${id}.json`);
  // Apply type inference if type is missing or generic
  if (section && (!section.type || section.type === 'section')) {
    section.type = inferSectionType(section.title);
  }
  return section;
}

export async function saveSection(section: WorkingCopySection): Promise<void> {
  await setValue(STORES.MANUSCRIPT, `${section.id}.json`, section);
}

export async function deleteSection(id: string): Promise<void> {
  await deleteValue(STORES.MANUSCRIPT, `${id}.json`);
}

// Cover image functions
export async function loadCoverImage(): Promise<Blob | null> {
  const meta = await loadWorkingCopyMeta();
  if (!meta?.coverImageId) return null;
  return getValue<Blob>(STORES.MANUSCRIPT, meta.coverImageId);
}

export async function saveCoverImage(blob: Blob, filename: string): Promise<void> {
  await setValue(STORES.MANUSCRIPT, filename, blob);
}

export async function deleteCoverImage(): Promise<void> {
  const meta = await loadWorkingCopyMeta();
  if (meta?.coverImageId) {
    await deleteValue(STORES.MANUSCRIPT, meta.coverImageId);
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

// Full working copy functions (for convenience)
export interface FullWorkingCopy {
  title: string;
  author: string;
  language: string;
  coverImage: Blob | null;
  sections: WorkingCopySection[];
}

export async function loadFullWorkingCopy(): Promise<FullWorkingCopy | null> {
  const meta = await loadWorkingCopyMeta();
  if (!meta) return null;

  // Load all sections in order
  const sections: WorkingCopySection[] = [];
  for (const id of meta.sectionIds) {
    const section = await loadSection(id);
    if (section) {
      sections.push(section);
    }
  }

  // Load cover image
  let coverImage: Blob | null = null;
  if (meta.coverImageId) {
    coverImage = await getValue<Blob>(STORES.MANUSCRIPT, meta.coverImageId);
  }

  return {
    title: meta.title,
    author: meta.author,
    language: meta.language,
    coverImage,
    sections,
  };
}

/**
 * Save full working copy with normalization.
 * Normalizes section IDs to section-001, section-002, etc.
 */
export async function saveFullWorkingCopy(epub: {
  title: string;
  author: string;
  language: string;
  coverImage: Blob | null;
  sections: { id: string; title: string; content: string; type?: ElementType }[];
}): Promise<void> {
  // Normalize section IDs
  const normalizedSections: WorkingCopySection[] = [];
  const sectionIds: string[] = [];

  epub.sections.forEach((section, i) => {
    const normalizedId = `section-${String(i + 1).padStart(3, '0')}`;
    sectionIds.push(normalizedId);
    normalizedSections.push({
      id: normalizedId,
      title: section.title,
      content: section.content,
      type: section.type || 'section', // Default to 'section' for backward compatibility
    });
  });

  // Save cover image if present
  let coverImageId: string | null = null;
  if (epub.coverImage) {
    // Determine filename based on blob type
    const ext = epub.coverImage.type === 'image/png' ? 'png' : 'jpg';
    coverImageId = `cover.${ext}`;
    await saveCoverImage(epub.coverImage, coverImageId);
  }

  // Save meta
  const meta: WorkingCopyMeta = {
    title: epub.title,
    author: epub.author,
    language: epub.language,
    sectionIds,
    coverImageId,
  };
  await saveWorkingCopyMeta(meta);

  // Save all sections
  for (const section of normalizedSections) {
    await saveSection(section);
  }
}

/**
 * Clear all working copy data from IndexedDB
 */
export async function clearWorkingCopy(): Promise<void> {
  const meta = await loadWorkingCopyMeta();
  if (!meta) return;

  // Delete all sections
  for (const id of meta.sectionIds) {
    await deleteSection(id);
  }

  // Delete cover image
  if (meta.coverImageId) {
    await deleteValue(STORES.MANUSCRIPT, meta.coverImageId);
  }

  // Delete all inline images
  await clearManuscriptImages();

  // Delete meta
  await deleteValue(STORES.MANUSCRIPT, 'working_copy_meta.json');
}
