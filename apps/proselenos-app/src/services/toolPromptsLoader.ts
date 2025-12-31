// src/services/toolPromptsLoader.ts
// Client-side loader - fetches tool prompts from public/ folder on first run

import {
  isToolPromptsInitialized,
  saveToolPromptsData,
  ToolPromptsData
} from './manuscriptStorage';

interface ToolManifest {
  categories: string[];
  tools: { id: string; category: string; name: string; scope?: string }[];
}

/**
 * Initialize tool prompts from public/tool-prompts/ if not already in IndexedDB.
 * Called on app startup. Safe to call multiple times - will skip if already initialized.
 */
export async function initializeToolPrompts(): Promise<void> {
  // Check if already initialized
  const initialized = await isToolPromptsInitialized();
  if (initialized) {
    return;
  }

  console.log('Initializing tool prompts from public/tool-prompts/...');

  try {
    // Fetch the manifest
    const manifestResponse = await fetch('/tool-prompts/index.json');
    if (!manifestResponse.ok) {
      throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`);
    }
    const manifest: ToolManifest = await manifestResponse.json();

    // Fetch each tool prompt
    const originals: Record<string, string> = {};

    for (const tool of manifest.tools) {
      const promptResponse = await fetch(`/tool-prompts/${tool.id}`);
      if (promptResponse.ok) {
        const content = await promptResponse.text();
        originals[tool.id] = content;
      } else {
        console.warn(`Failed to fetch tool prompt: ${tool.id}`);
      }
    }

    // Save to IndexedDB (toolOrder preserves manifest order, toolScopes for chapter vs all)
    const data: ToolPromptsData = {
      originals,
      customized: {},
      categories: manifest.categories,
      toolOrder: manifest.tools.map(t => t.id),
      toolScopes: Object.fromEntries(manifest.tools.map(t => [t.id, t.scope || 'all'])),
      initialized: true
    };

    await saveToolPromptsData(data);
    console.log(`Tool prompts initialized: ${Object.keys(originals).length} prompts loaded`);

  } catch (error) {
    console.error('Failed to initialize tool prompts:', error);
    throw error;
  }
}
