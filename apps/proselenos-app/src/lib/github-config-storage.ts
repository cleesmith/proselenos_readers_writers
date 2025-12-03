// lib/github-config-storage.ts
// Handles proselenos-config.json and proselenos-settings.json in GitHub repos

'use server';

import { downloadFile, uploadFile } from '@/lib/github-storage';

// Config structure for GitHub repos
export interface ProselenosConfig {
  settings: {
    current_project: string | null;
    current_project_folder_id: string | null;
  };
  selectedApiProvider: string;
  selectedAiModel: string;
  author_name: string;
  isDarkMode?: boolean;
  // Google SSO user info (added on sign in)
  user_name?: string;
  user_email?: string;
  user_id?: string;
  last_sign_in?: string;
}

// Settings structure
export interface ProselenosSettings {
  last_updated: string;
  [key: string]: any; // For encrypted API keys
}

/**
 * Get or create proselenos-config.json from user's GitHub repo
 */
export async function getProselenosConfig(userId: string): Promise<ProselenosConfig> {
  const configFileName = 'proselenos-config.json';

  try {
    // Try to download existing config
    const { content } = await downloadFile(userId, 'proselenos', configFileName);

    // Convert ArrayBuffer to string
    const decoder = new TextDecoder('utf-8');
    const configText = decoder.decode(content);

    return JSON.parse(configText) as ProselenosConfig;
  } catch (error) {
    // Config doesn't exist, create default
    const defaultConfig: ProselenosConfig = {
      settings: {
        current_project: null,
        current_project_folder_id: null
      },
      selectedApiProvider: 'openrouter',
      selectedAiModel: '',
      author_name: 'Anonymous',
      isDarkMode: false
    };

    // Save default config
    await saveProselenosConfig(userId, defaultConfig);
    return defaultConfig;
  }
}

/**
 * Save proselenos-config.json to user's GitHub repo
 */
export async function saveProselenosConfig(userId: string, config: ProselenosConfig): Promise<void> {
  const configFileName = 'proselenos-config.json';
  const configContent = JSON.stringify(config, null, 2);

  await uploadFile(
    userId,
    'proselenos',
    configFileName,
    configContent,
    'Update Proselenos config'
  );
}

/**
 * Update config when user selects a project
 */
export async function updateCurrentProject(
  userId: string,
  projectName: string,
  projectFolderId: string
): Promise<void> {
  const config = await getProselenosConfig(userId);
  config.settings.current_project = projectName;
  config.settings.current_project_folder_id = projectFolderId;
  await saveProselenosConfig(userId, config);
}

/**
 * Update config when user changes AI provider and model settings
 */
export async function updateProviderAndModel(
  userId: string,
  provider: string,
  model: string
): Promise<void> {
  const config = await getProselenosConfig(userId);
  config.selectedApiProvider = provider;
  config.selectedAiModel = model;
  await saveProselenosConfig(userId, config);
}

/**
 * Update selected AI model
 */
export async function updateSelectedModel(userId: string, model: string): Promise<void> {
  const config = await getProselenosConfig(userId);
  config.selectedAiModel = model;
  await saveProselenosConfig(userId, config);
}

/**
 * Update dark mode preference
 */
export async function updateDarkMode(userId: string, dark: boolean): Promise<void> {
  const config = await getProselenosConfig(userId);
  config.isDarkMode = dark;
  await saveProselenosConfig(userId, config);
}

/**
 * Clear current project (when project is deleted or invalid)
 */
export async function clearCurrentProject(userId: string): Promise<void> {
  const config = await getProselenosConfig(userId);
  config.settings.current_project = null;
  config.settings.current_project_folder_id = null;
  await saveProselenosConfig(userId, config);
}

/**
 * Get or create proselenos-settings.json from user's GitHub repo
 */
export async function getProselenosSettings(userId: string): Promise<ProselenosSettings> {
  const settingsFileName = 'proselenos-settings.json';

  try {
    // Try to download existing settings
    const { content } = await downloadFile(userId, 'proselenos', settingsFileName);

    // Convert ArrayBuffer to string
    const decoder = new TextDecoder('utf-8');
    const settingsText = decoder.decode(content);

    return JSON.parse(settingsText) as ProselenosSettings;
  } catch (error) {
    // Settings don't exist, create default
    const defaultSettings: ProselenosSettings = {
      last_updated: new Date().toISOString()
    };

    // Save default settings
    await saveProselenosSettings(userId, defaultSettings);
    return defaultSettings;
  }
}

/**
 * Save proselenos-settings.json to user's GitHub repo
 */
export async function saveProselenosSettings(userId: string, settings: ProselenosSettings): Promise<void> {
  const settingsFileName = 'proselenos-settings.json';
  const settingsContent = JSON.stringify(settings, null, 2);

  await uploadFile(
    userId,
    'proselenos',
    settingsFileName,
    settingsContent,
    'Update Proselenos settings'
  );
}

/**
 * Update user info from Google SSO on sign in
 */
export async function updateUserInfo(
  userId: string,
  userInfo: {
    name?: string | null;
    email?: string | null;
    id?: string;
  }
): Promise<void> {
  const config = await getProselenosConfig(userId);
  if (userInfo.name) config.user_name = userInfo.name;
  if (userInfo.email) config.user_email = userInfo.email;
  if (userInfo.id) config.user_id = userInfo.id;
  config.last_sign_in = new Date().toISOString();
  await saveProselenosConfig(userId, config);
}
