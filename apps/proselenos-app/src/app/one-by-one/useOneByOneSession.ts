'use client';

/**
 * React hook for managing One-by-one editing sessions
 * Handles state, IndexedDB sync, and issue navigation
 */

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  OneByOneSession,
  ReportIssueWithStatus,
  OneByOneStats,
} from '@/types/oneByOne';
import {
  saveSession,
  getSession,
  getSessionForFile,
  clearAllSessions,
  isIndexedDBAvailable,
} from '@/services/oneByOne/oneByOneCache';
import { parseToolReport, isValidToolReport } from '@/utils/parseToolReport';

interface UseOneByOneSessionReturn {
  // State
  session: OneByOneSession | null;
  currentIssue: ReportIssueWithStatus | null;
  isLoading: boolean;
  error: string | null;
  stats: OneByOneStats;
  hasIndexedDB: boolean;

  // Actions
  initSession: (
    projectName: string,
    fileName: string,
    filePath: string,
    manuscriptContent: string,
    reportContent: string
  ) => Promise<boolean>;
  resumeSession: (sessionId: string) => Promise<boolean>;
  checkForExistingSession: (
    projectName: string,
    filePath: string
  ) => Promise<OneByOneSession | null>;

  // Issue actions (all client-side, instant)
  acceptCurrentIssue: () => Promise<boolean>;
  applyCustomReplacement: (customText: string) => Promise<boolean>;
  goToIssue: (index: number) => void;
  goToNextIssue: () => void;
  goToPrevIssue: () => void;

  // Session actions
  getWorkingContent: () => string;
  generateFinalContent: () => { success: boolean; content: string; errors?: string[] };
  closeAndCleanup: () => Promise<void>;
}

/**
 * Calculate stats from issues array
 */
function calculateStats(issues: ReportIssueWithStatus[]): OneByOneStats {
  return {
    total: issues.length,
    accepted: issues.filter((i) => i.status === 'accepted').length,
    custom: issues.filter((i) => i.status === 'custom').length,
    pending: issues.filter((i) => i.status === 'pending').length,
  };
}

export function useOneByOneSession(): UseOneByOneSessionReturn {
  const [session, setSession] = useState<OneByOneSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasIndexedDB] = useState(() => isIndexedDBAvailable());

  // Get current issue
  const currentIssue: ReportIssueWithStatus | null =
    session && session.currentIndex < session.issues.length
      ? session.issues[session.currentIndex] ?? null
      : null;

  // Calculate stats
  const stats = session ? calculateStats(session.issues) : {
    total: 0,
    accepted: 0,
    skipped: 0,
    custom: 0,
    pending: 0,
  };

  // Save to IndexedDB (non-blocking)
  const saveToIndexedDB = useCallback(async (sessionToSave: OneByOneSession) => {
    if (!hasIndexedDB) return;
    try {
      await saveSession(sessionToSave);
    } catch (err) {
      console.error('Failed to save to IndexedDB:', err);
    }
  }, [hasIndexedDB]);

  // Initialize a new session
  const initSession = useCallback(
    async (
      projectName: string,
      fileName: string,
      filePath: string,
      manuscriptContent: string,
      reportContent: string
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        // Validate report
        if (!isValidToolReport(reportContent)) {
          setError('Report does not contain readable issues');
          return false;
        }

        // Parse issues from report
        const issues = parseToolReport(reportContent);

        if (issues.length === 0) {
          setError('No issues found in report');
          return false;
        }

        // Create new session
        const newSession: OneByOneSession = {
          id: uuidv4(),
          projectName,
          fileName,
          filePath,
          originalContent: manuscriptContent,
          workingContent: manuscriptContent,
          issues,
          currentIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        setSession(newSession);

        // Save to IndexedDB
        await saveToIndexedDB(newSession);

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize session');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [saveToIndexedDB]
  );

  // Resume an existing session
  const resumeSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const existingSession = await getSession(sessionId);
        if (existingSession) {
          setSession(existingSession);
          return true;
        }

        setError('Session not found');
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to resume session');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Check for existing session for a file
  const checkForExistingSession = useCallback(
    async (
      projectName: string,
      filePath: string
    ): Promise<OneByOneSession | null> => {
      try {
        return await getSessionForFile(projectName, filePath);
      } catch {
        return null;
      }
    },
    []
  );

  // Accept current issue (deferred - just marks status, applies on Save)
  const acceptCurrentIssue = useCallback(async (): Promise<boolean> => {
    if (!session || !currentIssue) return false;

    // Just mark as accepted - actual replacement happens at Save time
    const updatedIssues = [...session.issues];
    updatedIssues[session.currentIndex] = {
      ...currentIssue,
      status: 'accepted',
    };

    const updatedSession: OneByOneSession = {
      ...session,
      issues: updatedIssues,
      updatedAt: Date.now(),
    };

    setSession(updatedSession);
    setError(null);
    await saveToIndexedDB(updatedSession);

    return true;
  }, [session, currentIssue, saveToIndexedDB]);

  // Apply custom replacement (deferred - just stores custom text, applies on Save)
  const applyCustomReplacement = useCallback(
    async (customText: string): Promise<boolean> => {
      if (!session || !currentIssue) return false;

      // Just mark as custom and store the text - actual replacement happens at Save time
      const updatedIssues = [...session.issues];
      updatedIssues[session.currentIndex] = {
        ...currentIssue,
        status: 'custom',
        customReplacement: customText,
      };

      const updatedSession: OneByOneSession = {
        ...session,
        issues: updatedIssues,
        updatedAt: Date.now(),
      };

      setSession(updatedSession);
      setError(null);
      await saveToIndexedDB(updatedSession);

      return true;
    },
    [session, currentIssue, saveToIndexedDB]
  );

  // Go to specific issue
  const goToIssue = useCallback(
    (index: number) => {
      if (!session || index < 0 || index >= session.issues.length) return;

      const updatedSession: OneByOneSession = {
        ...session,
        currentIndex: index,
        updatedAt: Date.now(),
      };

      setSession(updatedSession);
      saveToIndexedDB(updatedSession);
    },
    [session, saveToIndexedDB]
  );

  // Go to next issue
  const goToNextIssue = useCallback(() => {
    if (!session) return;
    const nextIndex = Math.min(session.currentIndex + 1, session.issues.length - 1);
    goToIssue(nextIndex);
  }, [session, goToIssue]);

  // Go to previous issue
  const goToPrevIssue = useCallback(() => {
    if (!session) return;
    const prevIndex = Math.max(session.currentIndex - 1, 0);
    goToIssue(prevIndex);
  }, [session, goToIssue]);

  // Get current working content
  const getWorkingContent = useCallback((): string => {
    return session?.workingContent || '';
  }, [session]);

  // Close and cleanup - clears all sessions from IndexedDB
  const closeAndCleanup = useCallback(async () => {
    if (hasIndexedDB) {
      try {
        await clearAllSessions();
      } catch (err) {
        console.error('Failed to clear sessions:', err);
      }
    }
    setSession(null);
    setError(null);
  }, [hasIndexedDB]);

  // Generate final content by applying all accepted/custom changes to original
  // Called at Save time - this is where all deferred replacements actually happen
  const generateFinalContent = useCallback((): { success: boolean; content: string; errors?: string[] } => {
    if (!session) {
      return { success: false, content: '', errors: ['No session'] };
    }

    // Get all accepted and custom issues
    const changesToApply = session.issues.filter(
      (issue) => issue.status === 'accepted' || issue.status === 'custom'
    );

    // If nothing to apply, return original unchanged
    if (changesToApply.length === 0) {
      return { success: true, content: session.originalContent };
    }

    // Apply each replacement sequentially to the original content
    // Each passage was unique in the original, so string.replace finds exactly one match
    let content = session.originalContent;
    const errors: string[] = [];

    for (const issue of changesToApply) {
      const replacement = issue.status === 'custom' && issue.customReplacement
        ? issue.customReplacement
        : issue.replacement;

      // Check if passage exists in current content
      if (!content.includes(issue.passage)) {
        errors.push(`Could not find: "${issue.passage.substring(0, 40)}..."`);
        continue;
      }

      // Apply the replacement
      content = content.replace(issue.passage, replacement);
    }

    return {
      success: errors.length === 0,
      content,
      errors: errors.length > 0 ? errors : undefined,
    };
  }, [session]);

  return {
    session,
    currentIssue,
    isLoading,
    error,
    stats,
    hasIndexedDB,
    initSession,
    resumeSession,
    checkForExistingSession,
    acceptCurrentIssue,
    applyCustomReplacement,
    goToIssue,
    goToNextIssue,
    goToPrevIssue,
    getWorkingContent,
    generateFinalContent,
    closeAndCleanup,
  };
}
