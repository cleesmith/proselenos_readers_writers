/**
 * Parser for AI tool reports
 * Extracts structured issues from the standard report format
 * Works with line_editing, copy_editing, or any tool using this format
 */

import { ReportIssueWithStatus } from '@/types/oneByOne';

/**
 * Clean report text by removing separator lines
 * - Lines of just dashes (---)
 * - Lines of equals signs or with text between them (=== SUMMARY ===)
 */
function cleanReportText(text: string): string {
  return text
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      // Remove lines that are just dashes (3 or more)
      if (/^-{3,}$/.test(trimmed)) return false;
      // Remove lines that start with 3+ equals signs (section headers)
      if (/^={3,}/.test(trimmed)) return false;
      return true;
    })
    .join('\n');
}

/**
 * Parse an AI tool report into structured issues
 *
 * Each issue starts with "ORIGINAL TEXT:" and contains:
 * - ORIGINAL TEXT: [verbatim passage]
 * - ISSUES IDENTIFIED: [what's wrong]
 * - SUGGESTED CHANGES: [the fix]
 * - EXPLANATION: [why it helps]
 *
 * We split on "ORIGINAL TEXT:" so each chunk is one complete issue.
 * This naturally bounds EXPLANATION to end at the next issue.
 */
export function parseToolReport(reportText: string): ReportIssueWithStatus[] {
  const issues: ReportIssueWithStatus[] = [];

  // Clean the report text first (remove --- and === lines)
  const cleanedText = cleanReportText(reportText);

  // Split by "ORIGINAL TEXT:" - each chunk after the first is one issue
  // The first chunk is header content (before any issues)
  const chunks = cleanedText.split(/ORIGINAL TEXT:\s*/);

  let idCounter = 0;

  // Skip first chunk (it's content before the first ORIGINAL TEXT:)
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i] ?? '';

    // Skip empty chunks
    if (!chunk.trim()) continue;

    // Skip chunks that say "No edits suggested"
    if (chunk.includes('No edits suggested')) continue;

    // Skip chunks without SUGGESTED CHANGES (no actual edit)
    if (!chunk.includes('SUGGESTED CHANGES:')) continue;

    // Extract the parts from this chunk
    // The passage is everything before ISSUES IDENTIFIED:
    const passage = extractBefore(chunk, 'ISSUES IDENTIFIED:');
    const issuesText = extractBetween(chunk, 'ISSUES IDENTIFIED:', 'SUGGESTED CHANGES:');
    const replacement = extractBetween(chunk, 'SUGGESTED CHANGES:', 'EXPLANATION:');
    // EXPLANATION runs to end of chunk (naturally bounded by next ORIGINAL TEXT:)
    const explanation = extractAfter(chunk, 'EXPLANATION:');

    // Only add if we have the required fields (passage and replacement)
    if (passage && replacement) {
      issues.push({
        id: idCounter++,
        passage: passage.trim(),
        issues: issuesText?.trim() || '',
        replacement: replacement.trim(),
        explanation: explanation?.trim() || '',
        status: 'pending',
      });
    }
  }

  return issues;
}

/**
 * Extract text before a marker
 */
function extractBefore(text: string, marker: string): string | null {
  const index = text.indexOf(marker);
  if (index === -1) {
    // No marker found, return entire text
    return text.trim();
  }
  return text.slice(0, index).trim();
}

/**
 * Extract text between two markers
 */
function extractBetween(text: string, startMarker: string, endMarker: string): string | null {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) return null;

  const contentStart = startIndex + startMarker.length;
  const endIndex = text.indexOf(endMarker, contentStart);

  if (endIndex === -1) {
    // No end marker found, return everything after start marker
    return text.slice(contentStart).trim();
  }

  return text.slice(contentStart, endIndex).trim();
}

/**
 * Extract text after a marker to end of text
 */
function extractAfter(text: string, marker: string): string | null {
  const index = text.indexOf(marker);
  if (index === -1) return null;

  return text.slice(index + marker.length).trim();
}

/**
 * Validate that a report has parseable content
 */
export function isValidToolReport(reportText: string): boolean {
  if (!reportText) return false;

  // Must have at least one ORIGINAL TEXT section
  if (!reportText.includes('ORIGINAL TEXT:')) return false;

  // Must have at least one SUGGESTED CHANGES section
  if (!reportText.includes('SUGGESTED CHANGES:')) return false;

  return true;
}

/**
 * Get count of parseable issues in a report (for preview)
 */
export function countParseableIssues(reportText: string): number {
  const issues = parseToolReport(reportText);
  return issues.length;
}
