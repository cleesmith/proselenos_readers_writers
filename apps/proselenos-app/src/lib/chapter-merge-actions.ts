// lib/chapter-merge-actions.ts
// Merge chapter files back into a single manuscript - uses Supabase storage

'use server';

import { listProjectFiles, downloadFile, uploadFileToProject, deleteProjectFile } from '@/lib/project-storage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export interface ChapterMergeResult {
  outputFileName: string;
  chapterCount: number;
  totalWords: number;
  deletedCount: number;
}

/**
 * Extract chapter number from filename: ovids_tenth_c0003.txt → 3
 */
function getChapterNumber(fileName: string): number {
  const match = fileName.match(/_c(\d{4})\.txt$/);
  return match && match[1] ? parseInt(match[1], 10) : 0;
}

/**
 * Derive source prefix from manuscript filename: Ovids_Tenth.txt → ovids_tenth
 */
function deriveSourcePrefix(manuscriptFileName: string): string {
  return manuscriptFileName
    .replace(/\.txt$/i, '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * List manuscript files for merge tool file selector.
 * Returns .txt files that are NOT chapter files (*_c####.txt)
 */
export async function listManuscriptsForMergeAction(projectName: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    if (!projectName) {
      return { success: false, error: 'Project name is required' };
    }

    // List all files in the project folder
    const allFiles = await listProjectFiles(userId, projectName);

    // Filter for .txt files that are NOT chapters (*_c####.txt)
    const chapterPattern = /_c\d{4}\.txt$/;
    const manuscriptFiles = allFiles.filter(f =>
      f.name.toLowerCase().endsWith('.txt') && !chapterPattern.test(f.name)
    );

    // Map to format expected by UI
    const formattedFiles = manuscriptFiles.map(file => ({
      id: `${projectName}/${file.name}`,
      name: file.name,
      path: `${projectName}/${file.name}`,
      mimeType: 'text/plain'
    }));

    return {
      success: true,
      data: { files: formattedFiles },
      message: `Found ${formattedFiles.length} manuscript files`
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to list manuscript files';
    return { success: false, error: errorMessage };
  }
}

/**
 * Merge chapter files back into a single manuscript.
 *
 * @param projectName - The project folder name
 * @param manuscriptPath - Path to manuscript file (e.g., "ProjectName/Ovids_Tenth.txt")
 *
 * Process:
 * 1. Derive source prefix from manuscript filename
 * 2. Find all chapter files with same prefix
 * 3. Sort by chapter number
 * 4. Concatenate contents
 * 5. Save as {source}_edited.txt
 * 6. Delete chapter files
 */
export async function mergeChaptersAction(
  projectName: string,
  manuscriptPath: string
): Promise<ActionResult<ChapterMergeResult>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    if (!projectName || !manuscriptPath) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Extract filename from path (path might be "projectName/filename.txt")
    const pathParts = manuscriptPath.split('/');
    const manuscriptFileName = pathParts.length > 1 ? pathParts.slice(1).join('/') : manuscriptPath;

    // Derive source prefix from manuscript filename: Ovids_Tenth.txt → ovids_tenth
    const sourcePrefix = deriveSourcePrefix(manuscriptFileName);

    // List all files and find matching chapters
    const allFiles = await listProjectFiles(userId, projectName);
    const chapterPattern = new RegExp(`^${sourcePrefix}_c\\d{4}\\.txt$`);
    const chapterFiles = allFiles.filter(f => chapterPattern.test(f.name));

    if (chapterFiles.length === 0) {
      return { success: false, error: `No chapter files found for source: ${sourcePrefix}` };
    }

    // Sort by chapter number
    chapterFiles.sort((a, b) => getChapterNumber(a.name) - getChapterNumber(b.name));

    // Download and concatenate all chapters
    const chapterContents: string[] = [];
    for (const file of chapterFiles) {
      const arrayBuffer = await downloadFile(userId, projectName, file.name);
      const content = new TextDecoder('utf-8').decode(arrayBuffer);
      chapterContents.push(content);
    }

    // Simple concatenation - each chapter already has proper formatting
    const mergedContent = chapterContents.join('');
    const totalWords = countWords(mergedContent);

    // Generate output filename
    const outputFileName = `${sourcePrefix}_edited.txt`;

    // Upload merged manuscript
    await uploadFileToProject(userId, projectName, outputFileName, mergedContent);

    // Delete chapter files
    let deletedCount = 0;
    for (const file of chapterFiles) {
      await deleteProjectFile(userId, projectName, file.name);
      deletedCount++;
    }

    return {
      success: true,
      data: {
        outputFileName,
        chapterCount: chapterFiles.length,
        totalWords,
        deletedCount
      },
      message: `Merged ${chapterFiles.length} chapters into ${outputFileName} (${totalWords.toLocaleString()} words)`
    };

  } catch (error: unknown) {
    console.error('Error in mergeChaptersAction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to merge chapters';
    return { success: false, error: errorMessage };
  }
}
