'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';

/**
 * Ensure storage is ready for the authenticated user
 * With Supabase, buckets are always ready (created via SQL setup)
 */
export async function ensureGitHubRepo(): Promise<{
  success: boolean;
  error?: string;
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

    // Supabase buckets are always ready (created via SQL setup)
    return {
      success: true,
      created: false,
    };
  } catch (error: any) {
    console.error('Error checking storage:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify storage',
    };
  }
}
