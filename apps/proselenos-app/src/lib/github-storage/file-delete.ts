import { createGitHubClient, getGitHubOwner } from './client';
import { getUserRepoName } from './repo-manager';

/**
 * Delete a single file from GitHub repository
 * Uses the simple Contents API (not the complex Git Data API)
 */
export async function deleteFile(
  userId: string,
  appSuffix: string,
  filePath: string,
  commitMessage?: string
): Promise<void> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();
  const repo = getUserRepoName(userId, appSuffix);

  // First, get the file's current SHA (required for delete)
  const { data: fileData } = await octokit.repos.getContent({
    owner,
    repo,
    path: filePath,
  });

  // getContent returns array for directories, object for files
  if (Array.isArray(fileData)) {
    throw new Error('Cannot delete a directory');
  }

  // Delete the file using Contents API
  await octokit.repos.deleteFile({
    owner,
    repo,
    path: filePath,
    message: commitMessage || `Delete ${filePath}`,
    sha: fileData.sha,
  });
}
