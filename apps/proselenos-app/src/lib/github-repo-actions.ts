// lib/github-repo-actions.ts

'use server';

import { ensureUserRepoExists } from '@/lib/github-storage';

/**
 * Server action to ensure user's GitHub repo exists
 * Creates repo from template if needed (template already contains config files and tool-prompts)
 */
export async function ensureUserGitHubRepoAction(userId: string) {
  try {
    // Ensure repo exists (will be created from proselenos-template if it doesn't exist)
    const result = await ensureUserRepoExists(userId, 'proselenos', 'Proselenos user storage');

    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
