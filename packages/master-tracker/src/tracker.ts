import { createGitHubClient, getGitHubOwner } from './client';
import { MASTER_REPO_NAME, USER_REPOS_FILE, BOOKS_FILE } from './constants';
import type { UserReposData, BooksData, FileContent, UserRepo, BookEntry } from './types';

/**
 * Check if master repository exists
 */
async function masterRepoExists(): Promise<boolean> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();

  try {
    await octokit.repos.get({
      owner,
      repo: MASTER_REPO_NAME,
    });
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Create master repository
 */
async function createMasterRepo(): Promise<void> {
  const octokit = createGitHubClient();

  await octokit.repos.createForAuthenticatedUser({
    name: MASTER_REPO_NAME,
    private: true,
    description: 'Master tracking for all user repos and books',
    auto_init: true,
  });
}

/**
 * Ensure master repository exists
 */
async function ensureMasterRepoExists(): Promise<void> {
  const exists = await masterRepoExists();
  if (!exists) {
    await createMasterRepo();
    // Wait a bit for GitHub to initialize the repo
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * Read a JSON file from master repo
 */
async function readJsonFile<T>(filename: string): Promise<FileContent<T>> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();

  const { data } = await octokit.repos.getContent({
    owner,
    repo: MASTER_REPO_NAME,
    path: filename,
  });

  // Type guard for file content
  if (Array.isArray(data) || data.type !== 'file') {
    throw new Error(`Expected ${filename} to be a file, not a directory`);
  }

  if (!data.sha) {
    throw new Error(`File SHA missing for ${filename}`);
  }

  // Decode base64 content
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  const parsed = JSON.parse(content) as T;

  return {
    data: parsed,
    sha: data.sha,
  };
}

/**
 * Write a JSON file to master repo
 */
async function writeJsonFile<T>(
  filename: string,
  data: T,
  commitMessage: string,
  sha?: string,
): Promise<void> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();

  const content = JSON.stringify(data, null, 2);
  const base64Content = Buffer.from(content).toString('base64');

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo: MASTER_REPO_NAME,
    path: filename,
    message: commitMessage,
    content: base64Content,
    sha, // Include SHA for updates, undefined for creation
  });
}

/**
 * Check if a file exists in master repo
 */
async function fileExists(filename: string): Promise<boolean> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();

  try {
    await octokit.repos.getContent({
      owner,
      repo: MASTER_REPO_NAME,
      path: filename,
    });
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Initialize user_repos.json with empty structure
 */
async function initializeUserReposFile(): Promise<void> {
  const initialData: UserReposData = {
    totalRepos: 0,
    repos: [],
  };

  await writeJsonFile(USER_REPOS_FILE, initialData, 'Initialize user_repos.json');
}

/**
 * Initialize books.json with empty structure
 */
async function initializeBooksFile(): Promise<void> {
  const initialData: BooksData = {
    totalBooks: 0,
    books: [],
  };

  await writeJsonFile(BOOKS_FILE, initialData, 'Initialize books.json');
}

/**
 * Ensure a JSON file exists in master repo
 */
async function ensureFileExists(filename: string): Promise<void> {
  const exists = await fileExists(filename);
  if (!exists) {
    if (filename === USER_REPOS_FILE) {
      await initializeUserReposFile();
    } else if (filename === BOOKS_FILE) {
      await initializeBooksFile();
    }
  }
}

/**
 * Log a user repo creation to master tracking
 */
export async function logUserRepo(userId: string, repoName: string): Promise<void> {
  // Ensure master repo and file exist
  await ensureMasterRepoExists();
  await ensureFileExists(USER_REPOS_FILE);

  // Read current data
  const { data, sha } = await readJsonFile<UserReposData>(USER_REPOS_FILE);

  // Create new repo entry
  const newRepo: UserRepo = {
    userId,
    repoName,
    createdAt: new Date().toISOString(),
  };

  // Update data
  const updatedData: UserReposData = {
    totalRepos: data.totalRepos + 1,
    repos: [...data.repos, newRepo],
  };

  // Write back
  await writeJsonFile(
    USER_REPOS_FILE,
    updatedData,
    `Add user repo: ${repoName}`,
    sha,
  );
}

/**
 * Log a book upload to master tracking (with deduplication)
 */
export async function logBook(book: { hash: string; title: string }): Promise<boolean> {
  // Ensure master repo and file exist
  await ensureMasterRepoExists();
  await ensureFileExists(BOOKS_FILE);

  // Read current data
  const { data, sha } = await readJsonFile<BooksData>(BOOKS_FILE);

  // Check for duplicates (hash OR title)
  const isDuplicate = data.books.some(
    (existingBook) =>
      existingBook.hash === book.hash || existingBook.title === book.title,
  );

  if (isDuplicate) {
    return false; // Not logged, duplicate found
  }

  // Create new book entry
  const newBook: BookEntry = {
    hash: book.hash,
    title: book.title,
    firstUploadedAt: new Date().toISOString(),
  };

  // Update data
  const updatedData: BooksData = {
    totalBooks: data.totalBooks + 1,
    books: [...data.books, newBook],
  };

  // Write back
  await writeJsonFile(
    BOOKS_FILE,
    updatedData,
    `Add book: ${book.title}`,
    sha,
  );

  return true; // Successfully logged
}
