/**
 * Chapter Extractor - Pure utility functions for extracting chapters from manuscripts.
 *
 * Manuscript format rules:
 * - 2 blank lines before each chapter (chapter separator)
 * - 1 blank line between paragraphs within a chapter
 * - Split pattern: '\n\n\n' (3 consecutive newlines = 2 blank lines)
 *
 * Output format:
 * - Each chapter file starts with 2 blank lines ('\n\n')
 * - Content preserved verbatim with paragraph spacing intact
 * - Ends with single '\n'
 * - Rejoining = simple concatenation: cat manuscript_c*.txt > manuscript.txt
 */

export interface ExtractedChapter {
  index: number;
  fileName: string;
  content: string;
  wordCount: number;
  firstLine: string;
}

export interface ExtractionResult {
  chapters: ExtractedChapter[];
  totalWords: number;
  chapterCount: number;
  sourcePrefix: string;
}

/**
 * Generate chapter filename with source prefix and 4-digit zero padding.
 * e.g., manuscript_c0001.txt, ovids_tenth_c0001.txt
 */
export function generateChapterFileName(index: number, sourcePrefix: string): string {
  return `${sourcePrefix}_c${String(index + 1).padStart(4, '0')}.txt`;
}

/**
 * Count words in a text string.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extract chapters from a manuscript string.
 *
 * @param manuscript - The full manuscript text
 * @param sourceFileName - The source filename (e.g., "Ovids_Tenth.txt") for naming chapter files
 * @returns Array of extracted chapters with metadata
 */
export function extractChaptersFromManuscript(
  manuscript: string,
  sourceFileName: string = 'manuscript.txt'
): ExtractionResult {
  // Convert filename to prefix: "Ovids_Tenth.txt" → "ovids_tenth"
  const sourcePrefix = sourceFileName
    .replace(/\.txt$/i, '')
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (!manuscript || manuscript.trim().length === 0) {
    return {
      chapters: [],
      totalWords: 0,
      chapterCount: 0,
      sourcePrefix
    };
  }

  // Split on 2 blank lines (3 consecutive newlines)
  const chunks = manuscript
    .split('\n\n\n')
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);

  const chapters: ExtractedChapter[] = chunks.map((chunk, index) => {
    // Each chapter file starts with 2 blank lines and ends with single newline
    const content = '\n\n' + chunk + '\n';
    const firstLine = (chunk.split('\n')[0] ?? '').substring(0, 80);
    const wordCount = countWords(chunk);

    return {
      index,
      fileName: generateChapterFileName(index, sourcePrefix),
      content,
      wordCount,
      firstLine
    };
  });

  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  return {
    chapters,
    totalWords,
    chapterCount: chapters.length,
    sourcePrefix
  };
}

/**
 * Validate that rejoining extracted chapters produces the original manuscript.
 * Useful for testing.
 */
export function rejoinChapters(chapters: ExtractedChapter[]): string {
  return chapters.map(ch => ch.content).join('');
}
