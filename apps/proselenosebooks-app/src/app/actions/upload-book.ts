'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { uploadBookToGitHub } from '@/libs/book-storage';
import { Book } from '@/types/book';

/**
 * Upload a book from the client to GitHub
 * Client will read from IndexedDB and send the data
 */
export async function uploadBook(
  book: Book,
  epubData: ArrayBuffer,
  configData: string,
): Promise<{
  success: boolean;
  error?: string;
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

    // Upload to GitHub
    await uploadBookToGitHub(userId, book, epubData, configData);

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('Error uploading book:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload book to GitHub',
    };
  }
}
