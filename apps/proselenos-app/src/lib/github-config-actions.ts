// lib/github-config-actions.ts
// Server actions for GitHub config/settings operations

'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import {
  getProselenosConfig,
  // saveProselenosConfig,
  updateProviderAndModel,
  updateSelectedModel,
  updateDarkMode,
  // updateCurrentProject
} from './github-config-storage';

interface ExtendedSession {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
  accessToken?: string;
}

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

/**
 * Get Proselenos config from GitHub repo
 */
export async function getproselenosConfigAction(): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const config = await getProselenosConfig(session.user.id);
    return { success: true, data: config };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get config' };
  }
}

/**
 * Update provider and model in GitHub config
 */
export async function updateProviderAndModelAction(provider: string, model: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    await updateProviderAndModel(session.user.id, provider, model);
    return { success: true, message: 'Provider and model updated' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update provider and model' };
  }
}

/**
 * Update selected AI model in GitHub config
 */
export async function updateSelectedModelAction(model: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    await updateSelectedModel(session.user.id, model);
    return { success: true, message: 'Model updated' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update model' };
  }
}

/**
 * Update dark mode preference in GitHub config
 */
export async function updateDarkModeAction(isDark: boolean): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    await updateDarkMode(session.user.id, isDark);
    return { success: true, message: 'Dark mode preference updated' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update dark mode' };
  }
}

/**
 * Validate current project (check if it exists in repo)
 */
export async function validateCurrentProjectAction(): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const config = await getProselenosConfig(session.user.id);
    const currentProject = config.settings.current_project;

    if (!currentProject) {
      return { success: true, data: { isValid: false } };
    }

    // Project validation happens in project listing
    return { success: true, data: { isValid: true, projectName: currentProject } };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to validate project' };
  }
}

/**
 * Install tool prompts (not needed - template already has them)
 */
export async function installToolPromptsAction(): Promise<ActionResult> {
  // Tool prompts are already in the template repo, so this is a no-op
  return { success: true, message: 'Tool prompts already installed from template' };
}
