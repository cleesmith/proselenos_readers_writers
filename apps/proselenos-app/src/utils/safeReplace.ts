/**
 * Safe string replacement with uniqueness validation
 * Core utility for One-by-one editing feature
 */

import { SafeReplaceResult } from '@/types/oneByOne';

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Count occurrences of a passage in content
 */
export function countOccurrences(content: string, passage: string): number {
  if (!passage || passage.length === 0) return 0;

  const escapedPassage = escapeRegExp(passage);
  const regex = new RegExp(escapedPassage, 'g');
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Find and replace a unique passage in content
 *
 * Before replacing, counts occurrences of the passage:
 * - Zero matches: Error - "Passage not found" (AI may have mangled text)
 * - One match: Safe to replace
 * - Multiple matches: Error - "Not unique" (passage appears multiple times)
 *
 * @param content - The full text content
 * @param passage - The exact text to find (must be unique)
 * @param replacement - The text to replace it with
 * @returns SafeReplaceResult with success status and new content or error
 */
export function safeReplace(
  content: string,
  passage: string,
  replacement: string
): SafeReplaceResult {
  if (!passage || passage.length === 0) {
    return { success: false, error: 'Passage cannot be empty', matchCount: 0 };
  }

  if (!content || content.length === 0) {
    return { success: false, error: 'Content cannot be empty', matchCount: 0 };
  }

  // Count occurrences
  const matchCount = countOccurrences(content, passage);

  if (matchCount === 0) {
    return {
      success: false,
      error: 'Passage not found in manuscript',
      matchCount: 0,
    };
  }

  if (matchCount > 1) {
    return {
      success: false,
      error: `Passage appears ${matchCount} times - not unique enough`,
      matchCount,
    };
  }

  // Exactly one match - safe to replace
  const newContent = content.replace(passage, replacement);

  return {
    success: true,
    newContent,
    matchCount: 1,
  };
}

/**
 * Validate that a passage is unique in the content
 */
export function validatePassageUniqueness(
  content: string,
  passage: string
): { isUnique: boolean; count: number } {
  if (!passage) {
    return { isUnique: false, count: 0 };
  }

  const count = countOccurrences(content, passage);
  return { isUnique: count === 1, count };
}

/**
 * Find the position of a passage in content (for scrolling/highlighting)
 */
export function findPassagePosition(
  content: string,
  passage: string
): { start: number; end: number } | null {
  if (!passage || !content) return null;

  const index = content.indexOf(passage);
  if (index === -1) {
    return null;
  }
  return { start: index, end: index + passage.length };
}
