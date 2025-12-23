// Server Actions - Internal server-side functions (NOT public API endpoints)
'use server';

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';

import { streamAIInternal } from './aiInternal';

/**
 * Server Action to test AI functionality
 * This is NOT a public API endpoint - only callable from app components
 */
export async function testAIAction(prompt: string, manuscript: string) {
  // Verify user session
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error('Unauthorized - please sign in');
  }

  try {
    // Call internal AI function
    const response = await streamAIInternal(prompt, manuscript);
    return {
      success: true,
      response: response
    };
  } catch (error) {
    console.error('AI test error:', error);
    throw new Error(`AI test failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}