/**
 * Types for One-by-one editing feature
 * Works with ANY AI tool report that follows the standard format
 * Completely separate from View-Edit functionality
 */

/**
 * A single issue parsed from an AI tool report
 */
export interface ReportIssue {
  /** The original text from manuscript (verbatim, must be unique for replacement) */
  passage: string;
  /** What's wrong with it */
  issues: string;
  /** The suggested replacement text */
  replacement: string;
  /** Why this change improves the text */
  explanation: string;
}

/**
 * Status of a single issue during editing session
 */
export type IssueStatus = 'pending' | 'accepted' | 'custom';

/**
 * Issue with tracking state for the editing session
 */
export interface ReportIssueWithStatus extends ReportIssue {
  /** Unique ID (index in array) */
  id: number;
  /** Current status */
  status: IssueStatus;
  /** User's custom replacement if status is 'custom' */
  customReplacement?: string;
}

/**
 * A complete One-by-one session stored in IndexedDB
 */
export interface OneByOneSession {
  /** Unique session ID (UUID) */
  id: string;
  /** Project name */
  projectName: string;
  /** File name (e.g., "manuscript.txt") */
  fileName: string;
  /** File path for saving */
  filePath: string;
  /** Original manuscript content (untouched backup) */
  originalContent: string;
  /** Working content (modified as user accepts changes) */
  workingContent: string;
  /** All issues parsed from the AI report */
  issues: ReportIssueWithStatus[];
  /** Current issue index (0-based) */
  currentIndex: number;
  /** Session creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Stats for display in UI
 */
export interface OneByOneStats {
  total: number;
  accepted: number;
  custom: number;
  pending: number;
}

/**
 * Result from safeReplace function
 */
export interface SafeReplaceResult {
  success: boolean;
  newContent?: string;
  error?: string;
  matchCount?: number;
}
