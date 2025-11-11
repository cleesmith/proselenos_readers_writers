'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { listBooksInRepo, downloadBookFromRepo } from '@/libs/book-storage';
import { Book } from '@/types/book';

/**
 * List all books available in the user's GitHub repo
 */
export async function listRepoBooks(): Promise<{
  success: boolean;
  books?: Book[];
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return {
        success: false,
        error: 'User ID not found in session',
      };
    }

    const books = await listBooksInRepo(userId);

    return {
      success: true,
      books,
    };
  } catch (error: any) {
    console.error('Error listing repo books:', error);
    return {
      success: false,
      error: error.message || 'Failed to list books from repo',
    };
  }
}

/**
 * Download a book from the user's GitHub repo
 * Returns base64-encoded epub data that client will process with importBook
 */
export async function downloadRepoBook(bookHash: string): Promise<{
  success: boolean;
  epubBase64?: string;
  epubFilename?: string;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return {
        success: false,
        error: 'User ID not found in session',
      };
    }

    const { epubData, epubFilename } = await downloadBookFromRepo(userId, bookHash);

    // Convert ArrayBuffer to base64 for serialization
    const epubBase64 = Buffer.from(epubData).toString('base64');

    return {
      success: true,
      epubBase64,
      epubFilename,
    };
  } catch (error: any) {
    console.error('Error downloading repo book:', error);
    return {
      success: false,
      error: error.message || 'Failed to download book from repo',
    };
  }
}
