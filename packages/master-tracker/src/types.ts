/**
 * User repository entry in master tracking
 */
export interface UserRepo {
  userId: string;
  repoName: string;
  createdAt: string;
  // Google SSO user info (added on sign in)
  user_name?: string;
  user_email?: string;
  last_sign_in?: string;
}

/**
 * Structure of user_repos.json
 */
export interface UserReposData {
  totalRepos: number;
  repos: UserRepo[];
}

/**
 * Book entry in master tracking
 */
export interface BookEntry {
  hash: string;
  title: string;
  firstUploadedAt: string;
}

/**
 * Structure of books.json
 */
export interface BooksData {
  totalBooks: number;
  books: BookEntry[];
}

/**
 * Generic file content with SHA for updates
 */
export interface FileContent<T> {
  data: T;
  sha: string;
}
