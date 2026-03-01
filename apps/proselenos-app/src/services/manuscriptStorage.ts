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

// AI Provider config (ai_provider.json)
export interface AIProviderConfig {
  providerName: string;
  base: string;
  authKey: string;
  models: string;
  completions: string;
}

export async function loadAIProviderConfig(): Promise<AIProviderConfig | null> {
  return getValue<AIProviderConfig>(STORES.SETTINGS, 'ai_provider.json');
}

export async function saveAIProviderConfig(config: AIProviderConfig): Promise<void> {
  await setValue(STORES.SETTINGS, 'ai_provider.json', config);
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
 * NOW extracts plain text from XHTML.
 */
export async function assembleManuscriptFromWorkingCopy(): Promise<string> {
  // Try new meta.json format first
  const newMeta = await loadManuscriptMeta();
  if (newMeta) {
    const parts: string[] = [];

    for (const sectionMeta of newMeta.sections) {
      // Skip front/back matter
      if (isFrontBackMatter(sectionMeta.title)) continue;

      const xhtml = await loadSectionXhtml(sectionMeta.id);
      if (!xhtml) continue;

      // Convert XHTML to plain text
      const plainText = xhtmlToPlainText(xhtml);

      // Add chapter with 2 blank lines before it
      parts.push(`\n\n${sectionMeta.title}\n\n${plainText}`);
    }

    return parts.join('');
  }

  // Fall back to old format
  const oldMeta = await loadWorkingCopyMeta();
  if (!oldMeta) return '';

  const parts: string[] = [];

  for (const id of oldMeta.sectionIds) {
    const section = await loadSection(id);
    if (!section) continue;

    // Skip front/back matter
    if (isFrontBackMatter(section.title)) continue;

    // XHTML is now the source of truth - convert to plain text
    const plainText = xhtmlToPlainText(section.xhtml);

    // Add chapter with 2 blank lines before it
    parts.push(`\n\n${section.title}\n\n${plainText}`);
  }

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

// Check if a AI Writing prompt is customized (differs from default)
export async function isWritingAssistantPromptCustomized(stepId: string): Promise<boolean> {
  const data = await getValue<WritingAssistantPromptsData>(STORES.AI, 'writing_assistant_prompts.json');
  if (!data || !data.prompts[stepId]) return false;
  const defaultPrompt = WRITING_ASSISTANT_DEFAULTS[stepId];
  if (!defaultPrompt) return false;
  return data.prompts[stepId] !== defaultPrompt;
}

// Get the default AI Writing prompt (for restore comparison)
export function getWritingAssistantDefaultPrompt(stepId: string): string {
  return WRITING_ASSISTANT_DEFAULTS[stepId] || '';
}

// Get all AI Writing step IDs
export function getWritingAssistantStepIds(): string[] {
  return Object.keys(WRITING_ASSISTANT_DEFAULTS);
}

// ============================================
// User Tools (custom prompts created by user)
// ============================================

// Check if a prompt is user-created (exists in customized but not in originals)
export async function isUserCreatedPrompt(toolId: string): Promise<boolean> {
  const data = await loadToolPromptsData();
  if (!data) return false;
  // User-created if it's in customized but NOT in originals
  return (toolId in data.customized) && !(toolId in data.originals);
}

// Add a new user-created prompt
export async function addUserPrompt(name: string, content: string): Promise<string> {
  const data = await loadToolPromptsData();
  if (!data) throw new Error('Tool prompts not initialized');

  // Generate tool ID in User Tools category
  const toolId = `User Tools/${name}.txt`;

  // Check for duplicate
  if (toolId in data.customized || toolId in data.originals) {
    throw new Error(`A prompt named "${name}" already exists`);
  }

  // Add to customized (user-created prompts only exist in customized)
  data.customized[toolId] = content;

  // Ensure User Tools category exists
  if (!data.categories.includes('User Tools')) {
    data.categories.push('User Tools');
  }

  // Add to toolOrder
  if (!data.toolOrder.includes(toolId)) {
    data.toolOrder.push(toolId);
  }

  await saveToolPromptsData(data);
  return toolId;
}

// Delete a user-created prompt
export async function deleteUserPrompt(toolId: string): Promise<void> {
  const data = await loadToolPromptsData();
  if (!data) return;

  // Only allow deleting user-created prompts (not in originals)
  if (toolId in data.originals) {
    throw new Error('Cannot delete built-in prompts');
  }

  // Remove from customized
  delete data.customized[toolId];

  // Remove from toolOrder
  data.toolOrder = data.toolOrder.filter(id => id !== toolId);

  await saveToolPromptsData(data);
}

// Reset all tool prompts to defaults (clears customized, preserves user-created)
export async function resetAllToolPrompts(): Promise<number> {
  const data = await loadToolPromptsData();
  if (!data) return 0;

  let resetCount = 0;
  const newCustomized: Record<string, string> = {};

  // Keep only user-created prompts (those not in originals)
  for (const [toolId, content] of Object.entries(data.customized)) {
    if (!(toolId in data.originals)) {
      // This is a user-created prompt, keep it
      newCustomized[toolId] = content;
    } else {
      // This was a customization of a built-in prompt, remove it
      resetCount++;
    }
  }

  data.customized = newCustomized;
  await saveToolPromptsData(data);
  return resetCount;
}

// Reset all AI Writing prompts to defaults
export async function resetAllWritingAssistantPrompts(): Promise<number> {
  const data = await getValue<WritingAssistantPromptsData>(STORES.AI, 'writing_assistant_prompts.json');
  if (!data) return 0;

  let resetCount = 0;
  for (const stepId of Object.keys(WRITING_ASSISTANT_DEFAULTS)) {
    if (data.prompts[stepId] !== WRITING_ASSISTANT_DEFAULTS[stepId]) {
      resetCount++;
    }
  }

  // Reset all prompts to defaults
  data.prompts = { ...WRITING_ASSISTANT_DEFAULTS };
  await setValue(STORES.AI, 'writing_assistant_prompts.json', data);
  return resetCount;
}

// Get list of all prompt categories for PromptEditor
export async function getPromptCategories(): Promise<string[]> {
  const data = await loadToolPromptsData();
  const categories: string[] = [];

  if (data?.categories) {
    // Add tool categories, ensuring User Tools is last
    const toolCategories = data.categories.filter(c => c !== 'User Tools');
    categories.push(...toolCategories);
    if (data.categories.includes('User Tools')) {
      categories.push('User Tools');
    }
  }

  return categories;
}

// Get original (default) prompt content for a tool
export async function getOriginalToolPrompt(toolId: string): Promise<string | null> {
  const data = await loadToolPromptsData();
  if (!data) return null;
  return data.originals[toolId] ?? null;
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
  // Voice mode
  voiceMode: string;                 // "narration" | "dialogue"
  // Narration
  narrationFilename: string | null;  // ref to Audio Library
  narrationVolume: number;
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
 * Get plain text from XHTML (for word count, search, AI tools)
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
