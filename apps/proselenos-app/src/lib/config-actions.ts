// lib/config-actions.ts
// Config/settings operations with auth wrapper

'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import {
  getAuthorConfig,
  updateProviderAndModel,
  updateSelectedModel,
  updateDarkMode,
} from './config-storage';

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
 * Get Proselenos config from Supabase
 */
export async function getproselenosConfigAction(): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const config = await getAuthorConfig(session.user.id);
    return { success: true, data: config };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get config' };
  }
}

/**
 * Update provider and model in Supabase config
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
 * Update selected AI model in Supabase config
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
 * Update dark mode preference in Supabase config
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
 * Validate current project (check if it exists)
 *
 * NOTE: This function is no longer called. It was previously used by a useEffect
 * in ClientBoot.tsx that re-validated the project on dependency changes. This caused
 * 12-second timeout errors during AI tool execution.
 */
export async function validateCurrentProjectAction(): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const config = await getAuthorConfig(session.user.id);
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
 * NOTE: This is a no-op stub. This function is still
 * called from ClientBoot.tsx during first-time user setup, but it just returns
 * success immediately. Kept for backwards compatibility with the initialization flow.
 * — Nov 2025
 */
export async function installToolPromptsAction(): Promise<ActionResult> {
  // Tool prompts are already in the template repo, so this is a no-op
  return { success: true, message: 'Tool prompts already installed from template' };
}
