// lib/config-storage.ts
// Supabase-based config/settings storage

'use server';

import { supabase, isSupabaseConfigured } from './supabase';

// Config structure (matches ProselenosConfig interface for compatibility)
export interface AuthorConfig {
  settings: {
    current_project: string | null;
    current_project_folder_id: string | null;
  };
  selectedApiProvider: string;
  selectedAiModel: string;
  author_name: string;
  isDarkMode: boolean;
  api_keys: Record<string, string>;
}

// Default config for new users
const DEFAULT_CONFIG: AuthorConfig = {
  settings: {
    current_project: null,
    current_project_folder_id: null,
  },
  selectedApiProvider: 'openrouter',
  selectedAiModel: '',
  author_name: 'Anonymous',
  isDarkMode: false,
  api_keys: {},
};

/**
 * Get user's UUID from google_id
 * Returns null if user not found
 */
async function getUserIdByGoogleId(googleId: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('google_id', googleId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

/**
 * Get author config from Supabase
 * Returns default config if none exists (new user)
 */
export async function getAuthorConfig(googleId: string): Promise<AuthorConfig> {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, returning default config');
    return DEFAULT_CONFIG;
  }

  const userId = await getUserIdByGoogleId(googleId);
  if (!userId) {
    console.log('User not found in Supabase, returning default config');
    return DEFAULT_CONFIG;
  }

  const { data, error } = await supabase!
    .from('author_config')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // No config exists, return default (will be created on first save)
    return DEFAULT_CONFIG;
  }

  // Map database columns to AuthorConfig interface
  return {
    settings: {
      current_project: data.current_project,
      current_project_folder_id: data.current_project_id,
    },
    selectedApiProvider: data.ai_provider || 'openrouter',
    selectedAiModel: data.ai_model || '',
    author_name: data.author_name || 'Anonymous',
    isDarkMode: data.dark_mode || false,
    api_keys: data.api_keys || {},
  };
}

/**
 * Save author config to Supabase (upsert)
 */
export async function saveAuthorConfig(googleId: string, config: AuthorConfig): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, skipping config save');
    return;
  }

  const userId = await getUserIdByGoogleId(googleId);
  if (!userId) {
    throw new Error('User not found in Supabase');
  }

  const { error } = await supabase!.from('author_config').upsert(
    {
      user_id: userId,
      current_project: config.settings.current_project,
      current_project_id: config.settings.current_project_folder_id,
      ai_provider: config.selectedApiProvider,
      ai_model: config.selectedAiModel,
      author_name: config.author_name,
      dark_mode: config.isDarkMode,
      api_keys: config.api_keys,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(`Failed to save author config: ${error.message}`);
  }
}

/**
 * Update current project selection
 */
export async function updateCurrentProject(
  googleId: string,
  projectName: string | null,
  projectId: string | null
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const userId = await getUserIdByGoogleId(googleId);
  if (!userId) {
    throw new Error('User not found in Supabase');
  }

  const { error } = await supabase!.from('author_config').upsert(
    {
      user_id: userId,
      current_project: projectName,
      current_project_id: projectId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(`Failed to update current project: ${error.message}`);
  }
}

/**
 * Update AI provider and model
 */
export async function updateProviderAndModel(
  googleId: string,
  provider: string,
  model: string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const userId = await getUserIdByGoogleId(googleId);
  if (!userId) {
    throw new Error('User not found in Supabase');
  }

  const { error } = await supabase!.from('author_config').upsert(
    {
      user_id: userId,
      ai_provider: provider,
      ai_model: model,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(`Failed to update provider and model: ${error.message}`);
  }
}

/**
 * Update selected AI model only
 */
export async function updateSelectedModel(googleId: string, model: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const userId = await getUserIdByGoogleId(googleId);
  if (!userId) {
    throw new Error('User not found in Supabase');
  }

  const { error } = await supabase!.from('author_config').upsert(
    {
      user_id: userId,
      ai_model: model,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(`Failed to update model: ${error.message}`);
  }
}

/**
 * Update dark mode preference
 */
export async function updateDarkMode(googleId: string, isDark: boolean): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const userId = await getUserIdByGoogleId(googleId);
  if (!userId) {
    throw new Error('User not found in Supabase');
  }

  const { error } = await supabase!.from('author_config').upsert(
    {
      user_id: userId,
      dark_mode: isDark,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(`Failed to update dark mode: ${error.message}`);
  }
}

/**
 * Clear current project (when project is deleted)
 */
export async function clearCurrentProject(googleId: string): Promise<void> {
  await updateCurrentProject(googleId, null, null);
}
