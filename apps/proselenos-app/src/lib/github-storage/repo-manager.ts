import { createGitHubClient, getGitHubOwner } from './client';
import { logUserRepo } from '@proselenosebooks/master-tracker';

/**
 * Generate repo name from user ID and app suffix
 */
export function getUserRepoName(userId: string, appSuffix: string): string {
  return `${userId}_${appSuffix}`;
}

/**
 * Check if a repository exists
 */
export async function repoExists(userId: string, appSuffix: string): Promise<boolean> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();
  const repo = getUserRepoName(userId, appSuffix);

  try {
    await octokit.repos.get({
      owner,
      repo,
    });
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Create a new private repository for a user from template
 */
export async function createUserRepo(
  userId: string,
  appSuffix: string,
  description?: string,
): Promise<void> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();
  const repo = getUserRepoName(userId, appSuffix);

  await octokit.repos.createUsingTemplate({
    template_owner: owner,
    template_repo: 'proselenos-template',
    owner: owner,
    name: repo,
    private: true,
    description: description || `Storage for user ${userId}`,
    include_all_branches: false,
  });

  // Wait for GitHub to fully initialize repo from template
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Log to master tracking (don't fail if this errors)
  try {
    await logUserRepo(userId, repo);
  } catch (error) {
    console.error('Failed to log user repo to master tracking:', error);
  }
}

/**
 * Ensure user repo exists - check and create if needed
 */
export async function ensureUserRepoExists(
  userId: string,
  appSuffix: string,
  description?: string,
): Promise<{
  exists: boolean;
  created: boolean;
  repoName: string;
}> {
  const repoName = getUserRepoName(userId, appSuffix);
  const exists = await repoExists(userId, appSuffix);

  if (exists) {
    return {
      exists: true,
      created: false,
      repoName,
    };
  }

  try {
    await createUserRepo(userId, appSuffix, description);
    return {
      exists: true,
      created: true,
      repoName,
    };
  } catch (error: any) {
    // If repo already exists (race condition), treat as success
    if (error.status === 422 && error.message?.includes('already exists')) {
      return {
        exists: true,
        created: false,
        repoName,
      };
    }
    // Re-throw other errors
    throw error;
  }
}
