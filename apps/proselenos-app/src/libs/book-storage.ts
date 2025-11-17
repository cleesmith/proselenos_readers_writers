import {
  ensureUserRepoExists as ensureRepo,
  uploadFiles,
  listFiles,
  downloadFileBySha,
} from '@proselenosebooks/github-repo';
import { logBook } from '@proselenosebooks/master-tracker';
import { Book } from '@/types/book';
import { getLocalBookFilename, getConfigFilename } from '@/utils/book';

const APP_SUFFIX = 'proselenosebooks';
const BOOKS_PREFIX = 'Proselenosebooks/Books/';

/**
 * Ensure user repo exists for books
 */
export async function ensureUserRepoExists(userId: string) {
  return ensureRepo(userId, APP_SUFFIX, `Ebook storage for user ${userId}`);
}

/**
 * Upload a book (.epub and config.json) to GitHub
 */
export async function uploadBookToGitHub(
  userId: string,
  book: Book,
  epubData: ArrayBuffer,
  configData: string,
): Promise<void> {
  const epubPath = `${BOOKS_PREFIX}${getLocalBookFilename(book)}`;
  const configPath = `${BOOKS_PREFIX}${getConfigFilename(book)}`;

  await uploadFiles(
    userId,
    APP_SUFFIX,
    [
      { path: epubPath, content: epubData },
      { path: configPath, content: configData },
    ],
    `Upload ${book.title}`,
  );

  // Log to master tracking (don't fail if this errors)
  try {
    await logBook({ hash: book.hash, title: book.title });
  } catch (error) {
    console.error('Failed to log book to master tracking:', error);
  }
}

/**
 * List all books in the user's GitHub repo
 */
export async function listBooksInRepo(userId: string): Promise<Book[]> {
  const files = await listFiles(userId, APP_SUFFIX, BOOKS_PREFIX, '.epub');

  const books: Book[] = [];
  for (const file of files) {
    const pathParts = file.path.split('/');
    if (pathParts.length !== 4) continue;

    const hash = pathParts[2];
    const filename = pathParts[3];
    if (!hash || !filename) continue;

    const title = filename.replace('.epub', '');

    books.push({
      hash,
      title,
      author: '',
      format: 'EPUB',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return books;
}

/**
 * Download a book from GitHub repo
 */
export async function downloadBookFromRepo(
  userId: string,
  bookHash: string,
): Promise<{ epubData: ArrayBuffer; epubFilename: string }> {
  // List files in the book directory to get the epub file
  const bookPrefix = `${BOOKS_PREFIX}${bookHash}/`;
  const files = await listFiles(userId, APP_SUFFIX, bookPrefix, '.epub');

  const epubFile = files[0];

  if (!epubFile) {
    throw new Error('No epub file found in book directory');
  }

  // Download using SHA
  const { content, filename } = await downloadFileBySha(
    userId,
    APP_SUFFIX,
    epubFile.sha,
    epubFile.name,
  );

  return {
    epubData: content,
    epubFilename: filename,
  };
}
