// lib/chapter-extraction-actions.ts
// Extract chapters from manuscript - uses Supabase storage

'use server';

import { listProjectFiles, downloadFile, uploadFileToProject, deleteProjectFile } from '@/lib/project-storage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { extractChaptersFromManuscript } from '@/lib/chapter-extractor';

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export interface ChapterExtractionResult {
  chapterCount: number;
  chapterFiles: string[];
  totalWords: number;
}

/**
 * Delete existing chapter files for a specific source manuscript before extraction.
 * Only deletes chapters from the same source (e.g., ovids_tenth_c0001.txt).
 * Ensures clean slate each time the tool runs for that manuscript.
 */
async function deleteExistingChapterFiles(
  userId: string,
  projectName: string,
  sourcePrefix: string
): Promise<number> {
  const allFiles = await listProjectFiles(userId, projectName);

  // Match only chapters from this source: e.g., ovids_tenth_c0001.txt
  const pattern = new RegExp(`^${sourcePrefix}_c\\d{4}\\.txt$`);
  const chapterFiles = allFiles.filter(f => pattern.test(f.name));

  for (const file of chapterFiles) {
    await deleteProjectFile(userId, projectName, file.name);
  }

  return chapterFiles.length;
}

/**
 * Extract chapters from a manuscript file and save as individual chapter files.
 *
 * Manuscript format rules:
 * - 2 blank lines before each chapter (chapter separator)
 * - 1 blank line between paragraphs within a chapter
 * - Split pattern: '\n\n\n' (3 consecutive newlines)
 *
 * Output:
 * - Creates {source}_c0001.txt, {source}_c0002.txt, etc. in the project folder
 * - Each file starts with 2 blank lines, ends with single newline
 * - Concatenating all files recreates the original manuscript
 */
export async function extractChaptersAction(
  projectName: string,
  fileName: string
): Promise<ActionResult<ChapterExtractionResult>> {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    if (!projectName || !fileName) {
      return { success: false, error: 'Missing required parameters' };
    }

    try {
      // Extract filename from path if needed (path might be "projectName/filename.txt")
      const pathParts = fileName.split('/');
      const actualFileName = pathParts.length > 1 ? pathParts.slice(1).join('/') : fileName;

      // Compute source prefix for chapter filenames: "Ovids_Tenth.txt" → "ovids_tenth"
      const sourcePrefix = actualFileName
        .replace(/\.txt$/i, '')
        .toLowerCase()
        .replace(/\s+/g, '_');

      // Delete existing chapter files for this source only (clean slate)
      await deleteExistingChapterFiles(userId, projectName, sourcePrefix);

      // Download the manuscript file from Supabase storage
      const arrayBuffer = await downloadFile(userId, projectName, actualFileName);
      const manuscript = new TextDecoder('utf-8').decode(arrayBuffer);

      if (!manuscript || manuscript.trim().length === 0) {
        return { success: false, error: 'Manuscript file is empty' };
      }

      // Extract chapters using the pure utility function
      const result = extractChaptersFromManuscript(manuscript, actualFileName);

      if (result.chapterCount === 0) {
        return { success: false, error: 'No chapters found in manuscript. Ensure chapters are separated by 2 blank lines.' };
      }

      // Upload each chapter file to the project
      const chapterFiles: string[] = [];

      for (const chapter of result.chapters) {
        await uploadFileToProject(userId, projectName, chapter.fileName, chapter.content);
        chapterFiles.push(chapter.fileName);
      }

      return {
        success: true,
        data: {
          chapterCount: result.chapterCount,
          chapterFiles,
          totalWords: result.totalWords
        },
        message: `Extracted ${result.chapterCount} chapters (${result.totalWords.toLocaleString()} words). Files: ${result.chapters[0]?.fileName} through ${result.chapters[result.chapters.length - 1]?.fileName}`
      };

    } catch (extractionError: unknown) {
      console.error('Chapter extraction error:', extractionError);
      const errorMessage = extractionError instanceof Error ? extractionError.message : 'Unknown error';
      return {
        success: false,
        error: `Extraction failed: ${errorMessage}`
      };
    }

  } catch (error: unknown) {
    console.error('Error in extractChaptersAction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract chapters';
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * List .txt files in a project folder for the file selector.
 */
export async function listTxtFilesAction(projectName: string): Promise<ActionResult> {
  try {
    // Get session
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

    // Filter for .txt files
    const txtFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.txt'));

    // Map to format expected by UI
    const formattedFiles = txtFiles.map(file => ({
      id: `${projectName}/${file.name}`,
      name: file.name,
      path: `${projectName}/${file.name}`,
      mimeType: 'text/plain'
    }));

    return {
      success: true,
      data: { files: formattedFiles },
      message: `Found ${formattedFiles.length} text files`
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to list text files';
    return { success: false, error: errorMessage };
  }
}
