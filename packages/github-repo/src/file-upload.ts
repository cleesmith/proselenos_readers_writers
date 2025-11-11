import { createGitHubClient, getGitHubOwner } from './client';
import { getUserRepoName } from './repo-manager';

/**
 * Convert ArrayBuffer to base64 using Buffer (Node.js only)
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

/**
 * Upload a single file to GitHub
 */
export async function uploadFile(
  userId: string,
  appSuffix: string,
  filePath: string,
  content: string | ArrayBuffer,
  commitMessage?: string,
): Promise<void> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();
  const repo = getUserRepoName(userId, appSuffix);

  // Convert content to base64
  const base64Content =
    content instanceof ArrayBuffer
      ? arrayBufferToBase64(content)
      : Buffer.from(content).toString('base64');

  // Get the current reference (main branch)
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: 'heads/main',
  });
  const currentCommitSha = ref.object.sha;

  // Get the current commit
  const { data: currentCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: currentCommitSha,
  });
  const currentTreeSha = currentCommit.tree.sha;

  // Create a blob with the file content
  const { data: blob } = await octokit.git.createBlob({
    owner,
    repo,
    content: base64Content,
    encoding: 'base64',
  });

  // Create a new tree with the blob
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: currentTreeSha,
    tree: [
      {
        path: filePath,
        mode: '100644', // file mode
        type: 'blob',
        sha: blob.sha,
      },
    ],
  });

  // Create a commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage || 'Upload file',
    tree: newTree.sha,
    parents: [currentCommitSha],
  });

  // Update the reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: 'heads/main',
    sha: newCommit.sha,
  });
}

/**
 * Upload multiple files in a single commit
 */
export async function uploadFiles(
  userId: string,
  appSuffix: string,
  files: Array<{
    path: string;
    content: string | ArrayBuffer;
  }>,
  commitMessage?: string,
): Promise<void> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();
  const repo = getUserRepoName(userId, appSuffix);

  // Get the current reference (main branch)
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: 'heads/main',
  });
  const currentCommitSha = ref.object.sha;

  // Get the current commit
  const { data: currentCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: currentCommitSha,
  });
  const currentTreeSha = currentCommit.tree.sha;

  // Create blobs for all files
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const base64Content =
        file.content instanceof ArrayBuffer
          ? arrayBufferToBase64(file.content)
          : Buffer.from(file.content).toString('base64');

      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: base64Content,
        encoding: 'base64',
      });

      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha,
      };
    }),
  );

  // Create a new tree with all blobs
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: currentTreeSha,
    tree: treeItems,
  });

  // Create a single commit for all files
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage || 'Upload files',
    tree: newTree.sha,
    parents: [currentCommitSha],
  });

  // Update the reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: 'heads/main',
    sha: newCommit.sha,
  });
}
