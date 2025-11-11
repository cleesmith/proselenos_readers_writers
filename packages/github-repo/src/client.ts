import { Octokit } from '@octokit/rest';

/**
 * Create GitHub API client with personal access token
 */
export function createGitHubClient(): Octokit {
  const token = process.env['GITHUB_PAT'];

  if (!token) {
    throw new Error('GITHUB_PAT environment variable is not set');
  }

  return new Octokit({
    auth: token,
  });
}

/**
 * Get GitHub owner username from environment
 */
export function getGitHubOwner(): string {
  const owner = process.env['GITHUB_OWNER'];

  if (!owner) {
    throw new Error('GITHUB_OWNER environment variable is not set');
  }

  return owner;
}
