import { createGitHubClient, getGitHubOwner } from './client';
import { getUserRepoName } from './repo-manager';

/**
 * List files in a directory path
 */
export async function listFiles(
  userId: string,
  appSuffix: string,
  pathPrefix: string,
  fileExtension?: string,
): Promise<
  Array<{
    path: string;
    name: string;
    sha: string;
  }>
> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();
  const repo = getUserRepoName(userId, appSuffix);

  try {
    // Get the repo tree recursively
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: 'heads/main',
    });

    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: ref.object.sha,
      recursive: 'true',
    });

    // Filter files based on path prefix and optional extension
    const files = tree.tree
      .filter((item) => {
        if (item.type !== 'blob' || !item.path) return false;
        if (!item.path.startsWith(pathPrefix)) return false;
        if (fileExtension && !item.path.endsWith(fileExtension)) return false;
        return true;
      })
      .map((item) => ({
        path: item.path!,
        name: item.path!.split('/').pop() || '',
        sha: item.sha!,
      }));

    return files;
  } catch (error) {
    console.error('Failed to list files in repo:', error);
    throw error;
  }
}

/**
 * Download a file from GitHub repo
 */
export async function downloadFile(
  userId: string,
  appSuffix: string,
  filePath: string,
): Promise<{
  content: ArrayBuffer;
  filename: string;
}> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();
  const repo = getUserRepoName(userId, appSuffix);

  try {
    // Get the file content
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
    });

    if (Array.isArray(fileData) || fileData.type !== 'file') {
      throw new Error('Expected a file, not a directory');
    }

    // Download using blob API for large files
    const { data: blob } = await octokit.git.getBlob({
      owner,
      repo,
      file_sha: fileData.sha,
    });

    // Decode base64 to ArrayBuffer
    const buffer = Buffer.from(blob.content, 'base64');
    const content = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    return {
      content,
      filename: fileData.name,
    };
  } catch (error) {
    console.error('Failed to download file from repo:', error);
    throw error;
  }
}

/**
 * Download a file by SHA (useful when you already have the SHA from listFiles)
 */
export async function downloadFileBySha(
  userId: string,
  appSuffix: string,
  fileSha: string,
  filename: string,
): Promise<{
  content: ArrayBuffer;
  filename: string;
}> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();
  const repo = getUserRepoName(userId, appSuffix);

  try {
    // Download using blob API
    const { data: blob } = await octokit.git.getBlob({
      owner,
      repo,
      file_sha: fileSha,
    });

    // Decode base64 to ArrayBuffer
    const buffer = Buffer.from(blob.content, 'base64');
    const content = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    return {
      content,
      filename,
    };
  } catch (error) {
    console.error('Failed to download file by SHA from repo:', error);
    throw error;
  }
}
