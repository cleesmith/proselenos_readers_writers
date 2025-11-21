'use server';

import JSZip from 'jszip';

// Define the return type for the action
type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

/**
 * Server Action: fetches Standard Ebooks source files and compiles them into an EPUB.
 */
export async function generateStandardEbookAction(
  githubUrl: string
): Promise<ActionResult<{ base64: string; filename: string }>> {
  try {
    // 1. Parse URL to get Owner and Repo
    const { owner, repo } = extractRepoInfo(githubUrl);

    // 2. Get Default Branch (master or main)
    const repoMetaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        next: { revalidate: 3600 }
    });

    if (!repoMetaRes.ok) {
      return { success: false, error: `Repository not found: ${repoMetaRes.statusText}` };
    }

    const repoMeta = await repoMetaRes.json();
    const defaultBranch = repoMeta.default_branch;

    // 3. Fetch Recursive File Tree
    // This gets a list of EVERY file in the repo in one request
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      { cache: 'no-store' }
    );

    if (!treeRes.ok) {
      return { success: false, error: 'Failed to fetch repository file tree' };
    }

    const treeData = await treeRes.json();

    // 4. Filter for 'src/' files only
    // We only want the actual book content, not the build tools
    const srcFiles = treeData.tree.filter((item: GitHubTreeItem) =>
      item.path.startsWith('src/') && item.type === 'blob'
    );

    if (!srcFiles.length) {
      return { success: false, error: 'No src/ directory found in this repository' };
    }

    // 5. Initialize Zip
    const zip = new JSZip();

    // 6. Find mimetype file specifically
    const mimetypeItem = srcFiles.find((item: GitHubTreeItem) => item.path === 'src/mimetype');
    if (!mimetypeItem) {
      return { success: false, error: 'Invalid Standard Ebooks source: missing mimetype file' };
    }

    // 7. Process Files (Fetch Content)
    // We batch requests to avoid hitting browser/network limits
    const BATCH_SIZE = 10;
    const chunks = [];
    for (let i = 0; i < srcFiles.length; i += BATCH_SIZE) {
        chunks.push(srcFiles.slice(i, i + BATCH_SIZE));
    }

    for (const chunk of chunks) {
        await Promise.all(chunk.map(async (item: GitHubTreeItem) => {
            // Use raw.githubusercontent.com to get the actual file content
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${item.path}`;

            const res = await fetch(rawUrl, { cache: 'no-store' });
            if (!res.ok) {
                console.error(`Failed to fetch ${item.path}`);
                return;
            }

            const arrayBuffer = await res.arrayBuffer();

            // MAPPING LOGIC:
            // The zip root should mirror the contents of 'src/'
            // src/mimetype -> mimetype
            // src/epub/content.opf -> epub/content.opf
            const zipPath = item.path.replace(/^src\//, '');

            if (zipPath === 'mimetype') {
                // EPUB RULE: mimetype must be uncompressed (STORE)
                zip.file(zipPath, arrayBuffer, { compression: 'STORE' });
            } else {
                // All other files use standard compression
                zip.file(zipPath, arrayBuffer);
            }
        }));
    }

    // 8. Generate Base64 string to send back to client
    const contentBase64 = await zip.generateAsync({
        type: 'base64',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    return {
      success: true,
      data: {
        base64: contentBase64,
        filename: `${repo}.epub`
      }
    };

  } catch (error: any) {
    console.error('Server Action Error:', error);
    return { success: false, error: error.message || 'Unknown server error' };
  }
}

// Helper: Extract owner and repo from URL
function extractRepoInfo(inputUrl: string) {
  try {
    const urlObj = new URL(inputUrl);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length < 2) throw new Error();
    return { owner: parts[0], repo: parts[1] };
  } catch (e) {
    throw new Error('Invalid GitHub URL');
  }
}
