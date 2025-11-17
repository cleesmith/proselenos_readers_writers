'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { ensureUserRepoExists } from '@/libs/book-storage';

/**
 * Ensure the authenticated user has a GitHub repo for their ebooks
 */
export async function ensureGitHubRepo(): Promise<{
  success: boolean;
  error?: string;
  repoName?: string;
  created?: boolean;
}> {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    // Get user ID from session
    const userId = (session.user as any).id;

    if (!userId) {
      return {
        success: false,
        error: 'User ID not found in session',
      };
    }

    // Ensure repo exists (creates if needed)
    const result = await ensureUserRepoExists(userId);

    return {
      success: true,
      repoName: result.repoName,
      created: result.created,
    };
  } catch (error: any) {
    console.error('Error ensuring GitHub repo:', error);
    return {
      success: false,
      error: error.message || 'Failed to create GitHub repository',
    };
  }
}
